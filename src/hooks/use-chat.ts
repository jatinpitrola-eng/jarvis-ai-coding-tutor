'use client'

import { useCallback, useRef, useState } from 'react'
import { apiFetch, getLearnerId } from '@/lib/api'
import { useAppStore, type Language } from '@/lib/store'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
  streaming?: boolean
}

export interface SessionInfo {
  id: string
  title: string
  language?: string | null
  mode?: string
  updatedAt?: string
}

interface UseChatReturn {
  messages: ChatMessage[]
  streaming: boolean
  sessionId: string | null
  sessions: SessionInfo[]
  loadingSessions: boolean
  loadingSession: boolean
  error: string | null
  send: (message: string, opts?: { mode?: 'text' | 'voice' }) => Promise<string>
  newChat: () => void
  loadSession: (id: string) => Promise<void>
  loadSessions: () => Promise<void>
  deleteSession: (id: string) => Promise<void>
  stop: () => void
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `msg_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

/**
 * Reads an SSE stream from /api/chat and parses `data: {...}` events.
 * Returns the full accumulated assistant text.
 */
async function streamChat(
  res: Response,
  onSession: (id: string) => void,
  onDelta: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  if (!res.body) throw new Error('No response body')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let acc = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    // SSE events are separated by a blank line. We split on double newlines.
    // Some servers send `\n\n`, some `\r\n\r\n` — normalize first.
    const normalized = buffer.replace(/\r\n/g, '\n')
    const parts = normalized.split('\n\n')
    buffer = parts.pop() || ''
    for (const part of parts) {
      const lines = part.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const jsonStr = trimmed.slice(5).trim()
        if (!jsonStr) continue
        let evt: { type?: string; sessionId?: string; content?: string; message?: string }
        try {
          evt = JSON.parse(jsonStr)
        } catch {
          continue
        }
        if (evt.type === 'session' && evt.sessionId) {
          onSession(evt.sessionId)
        } else if (evt.type === 'delta') {
          acc += evt.content || ''
          onDelta(acc)
        } else if (evt.type === 'done') {
          acc = evt.content || acc
          onDelta(acc)
        } else if (evt.type === 'error') {
          throw new Error(evt.message || 'Chat error')
        }
      }
    }
    if (signal?.aborted) break
  }

  return acc
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [loadingSession, setLoadingSession] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const currentLanguage = useAppStore((s) => s.currentLanguage)

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true)
    try {
      const learnerId = await getLearnerId()
      const res = await apiFetch(
        `/api/sessions?learnerId=${encodeURIComponent(learnerId)}`
      )
      if (!res.ok) throw new Error('Failed to load sessions')
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch {
      // silent
    } finally {
      setLoadingSessions(false)
    }
  }, [])

  const loadSession = useCallback(async (id: string) => {
    setError(null)
    setLoadingSession(true)
    try {
      const res = await apiFetch(`/api/sessions/${id}`)
      if (!res.ok) throw new Error('Failed to load session')
      const data = await res.json()
      setSessionId(data.session?.id || id)
      setMessages(
        (data.messages || []).map(
          (m: { id?: string; role: string; content: string; createdAt?: string }) => ({
            id: m.id || newId(),
            role: m.role as 'user' | 'assistant',
            content: m.content,
            createdAt: m.createdAt,
          })
        )
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load session')
    } finally {
      setLoadingSession(false)
    }
  }, [])

  const deleteSession = useCallback(
    async (id: string) => {
      try {
        await apiFetch(`/api/sessions/${id}`, { method: 'DELETE' })
        setSessions((s) => s.filter((x) => x.id !== id))
        if (sessionId === id) {
          setSessionId(null)
          setMessages([])
        }
      } catch {
        // silent
      }
    },
    [sessionId]
  )

  const newChat = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setSessionId(null)
    setMessages([])
    setError(null)
    setStreaming(false)
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStreaming(false)
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
    )
  }, [])

  const send = useCallback(
    async (
      message: string,
      opts: { mode?: 'text' | 'voice' } = {}
    ): Promise<string> => {
      const text = message.trim()
      const mode = opts.mode || 'text'
      if (!text || streaming) return ''
      setError(null)

      const userMsg: ChatMessage = {
        id: newId(),
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      }
      const pendingId = newId()
      const pendingMsg: ChatMessage = {
        id: pendingId,
        role: 'assistant',
        content: '',
        streaming: true,
      }
      setMessages((prev) => [...prev, userMsg, pendingMsg])
      setStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller

      let newSessionId: string | null = null
      try {
        const res = await apiFetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionId,
            message: text,
            language:
              (currentLanguage as Language) === 'general'
                ? null
                : currentLanguage,
            mode,
          }),
          signal: controller.signal,
        })
        if (!res.ok) {
          throw new Error(`Chat failed (${res.status})`)
        }

        const fullText = await streamChat(
          res,
          (sid) => {
            newSessionId = sid
            setSessionId(sid)
          },
          (acc) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === pendingId ? { ...m, content: acc } : m
              )
            )
          },
          controller.signal
        )

        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? { ...m, content: fullText, streaming: false }
              : m
          )
        )

        if (newSessionId) {
          // refresh session list so the sidebar shows the new conversation
          loadSessions()
        }
        return fullText
      } catch (e: unknown) {
        if (
          e instanceof DOMException &&
          (e.name === 'AbortError' || e.name === 'TimeoutError')
        ) {
          // user aborted — keep the partial message, just stop streaming
          setMessages((prev) =>
            prev.map((m) =>
              m.id === pendingId ? { ...m, streaming: false } : m
            )
          )
          return ''
        }
        const msg = e instanceof Error ? e.message : 'Failed to send message'
        setError(msg)
        // remove the empty pending assistant message on hard error
        setMessages((prev) =>
          prev.filter((m) => {
            if (m.id !== pendingId) return true
            return m.content.trim().length > 0
          })
        )
        return ''
      } finally {
        setStreaming(false)
        abortRef.current = null
      }
    },
    [sessionId, streaming, currentLanguage, loadSessions]
  )

  return {
    messages,
    streaming,
    sessionId,
    sessions,
    loadingSessions,
    loadingSession,
    error,
    send,
    newChat,
    loadSession,
    loadSessions,
    deleteSession,
    stop,
  }
}
