'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic,
  MicOff,
  Volume2,
  Loader2,
  Trash2,
  Sparkles,
  User,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Markdown } from '@/components/codebhai/markdown'
import { apiFetch, getLearnerId } from '@/lib/api'
import { useAppStore, LANGUAGE_LABELS, type Language } from '@/lib/store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type VoiceStatus =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'thinking'
  | 'speaking'
  | 'error'

interface VoiceTurn {
  id: string
  role: 'user' | 'assistant'
  content: string
  audioUrl?: string
  audioLoading?: boolean
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `t_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

const VOICE_LANGUAGES: Language[] = ['general', 'python', 'javascript']

/** Read an SSE stream from /api/chat and return the full assistant text. */
async function streamVoiceChat(
  res: Response,
  onDelta: (acc: string) => void,
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
    const normalized = buffer.replace(/\r\n/g, '\n')
    const parts = normalized.split('\n\n')
    buffer = parts.pop() || ''
    for (const part of parts) {
      const lines = part.split('\n')
      for (const line of lines) {
        const t = line.trim()
        if (!t.startsWith('data:')) continue
        const json = t.slice(5).trim()
        if (!json) continue
        let evt: {
          type?: string
          sessionId?: string
          content?: string
          message?: string
        }
        try {
          evt = JSON.parse(json)
        } catch {
          continue
        }
        if (evt.type === 'delta') {
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

const STATUS_LABELS: Record<VoiceStatus, string> = {
  idle: '',
  recording: 'Listening… tap to stop',
  transcribing: 'Transcribing your voice…',
  thinking: 'Jarvis is thinking…',
  speaking: 'Jarvis is speaking…',
  error: 'Something went wrong',
}

export function VoiceView() {
  const [status, setStatus] = React.useState<VoiceStatus>('idle')
  const [turns, setTurns] = React.useState<VoiceTurn[]>([])
  const [recording, setRecording] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const recorderRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const abortRef = React.useRef<AbortController | null>(null)
  const transcriptRef = React.useRef<HTMLDivElement>(null)

  const currentLanguage = useAppStore((s) => s.currentLanguage)
  const setCurrentLanguage = useAppStore((s) => s.setCurrentLanguage)

  // Auto-scroll
  React.useEffect(() => {
    const el = transcriptRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [turns, status])

  const stopRecording = React.useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    setRecording(false)
  }, [])

  const synthesizeAndPlay = React.useCallback(
    async (text: string): Promise<string | undefined> => {
      try {
        const learnerId = await getLearnerId().catch(() => '')
        const res = await apiFetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(learnerId ? { 'x-learner-id': learnerId } : {}),
          },
          body: JSON.stringify({ text, voice: 'tongtong', speed: 1.0 }),
        })
        if (!res.ok) throw new Error('TTS failed')
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        await audio.play().catch(() => {
          // Autoplay might be blocked; user can hit Replay
        })
        return url
      } catch {
        // Non-fatal: text still visible
        return undefined
      }
    },
    []
  )

  const runChat = React.useCallback(
    async (message: string) => {
      setStatus('thinking')
      const pendingId = newId()
      setTurns((prev) => [
        ...prev,
        { id: pendingId, role: 'assistant', content: '', audioLoading: true },
      ])
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const res = await apiFetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: null,
            message,
            language:
              currentLanguage === 'general' ? null : currentLanguage,
            mode: 'voice',
          }),
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`Chat failed (${res.status})`)
        const fullText = await streamVoiceChat(
          res,
          (acc) => {
            setTurns((prev) =>
              prev.map((t) =>
                t.id === pendingId
                  ? { ...t, content: acc, audioLoading: false }
                  : t
              )
            )
          },
          controller.signal
        )
        // Now TTS
        setStatus('speaking')
        const audioUrl = await synthesizeAndPlay(fullText)
        setTurns((prev) =>
          prev.map((t) =>
            t.id === pendingId
              ? { ...t, content: fullText, audioUrl, audioLoading: false }
              : t
          )
        )
        setStatus('idle')
      } catch (e: unknown) {
        if (
          e instanceof DOMException &&
          (e.name === 'AbortError' || e.name === 'TimeoutError')
        ) {
          setStatus('idle')
          return
        }
        const msg = e instanceof Error ? e.message : 'Failed to chat'
        setError(msg)
        setStatus('error')
        toast.error(msg)
      } finally {
        abortRef.current = null
      }
    },
    [currentLanguage, synthesizeAndPlay]
  )

  const handleAsr = React.useCallback(
    async (blob: Blob) => {
      setStatus('transcribing')
      try {
        const fd = new FormData()
        fd.append('audio', blob, 'recording.webm')
        const res = await apiFetch('/api/asr', {
          method: 'POST',
          body: fd,
        })
        if (!res.ok) throw new Error('ASR failed')
        const data = await res.json()
        const text: string = (data?.text || '').trim()
        if (!text) {
          toast.error("Couldn't catch that. Please try again.")
          setStatus('idle')
          return
        }
        const userTurnId = newId()
        setTurns((prev) => [
          ...prev,
          { id: userTurnId, role: 'user', content: text },
        ])
        await runChat(text)
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : 'Failed to transcribe audio'
        setError(msg)
        setStatus('error')
        toast.error(msg)
      }
    },
    [runChat]
  )

  const startRecording = React.useCallback(async () => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Microphone not supported on this device.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : ''
      const rec = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      )
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = async () => {
        // stop all tracks so the mic indicator turns off
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, {
          type: mimeType || 'audio/webm',
        })
        if (blob.size === 0) {
          setStatus('idle')
          return
        }
        await handleAsr(blob)
      }
      rec.start()
      recorderRef.current = rec
      setRecording(true)
      setStatus('recording')
    } catch (e: unknown) {
      if (
        e instanceof DOMException &&
        (e.name === 'NotAllowedError' || e.name === 'SecurityError')
      ) {
        toast.error('Microphone permission denied. Please allow mic access.')
      } else {
        toast.error('Could not access microphone.')
      }
      setStatus('error')
      setRecording(false)
    }
  }, [handleAsr])

  const replay = React.useCallback(
    async (turnId: string, text: string) => {
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId ? { ...t, audioLoading: true } : t
        )
      )
      try {
        const url = await synthesizeAndPlay(text)
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turnId ? { ...t, audioUrl: url, audioLoading: false } : t
          )
        )
      } catch {
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turnId ? { ...t, audioLoading: false } : t
          )
        )
      }
    },
    [synthesizeAndPlay]
  )

  const clearAll = () => {
    abortRef.current?.abort()
    stopRecording()
    setTurns([])
    setError(null)
    setStatus('idle')
  }

  const onMicClick = () => {
    if (recording) {
      stopRecording()
    } else {
      void startRecording()
    }
  }

  const busy =
    status === 'transcribing' ||
    status === 'thinking' ||
    status === 'speaking'

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Voice Tutor</h2>
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Mic className="size-3" />
            {LANGUAGE_LABELS[currentLanguage]}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={currentLanguage}
            onValueChange={(v) => setCurrentLanguage(v as Language)}
          >
            <SelectTrigger
              size="sm"
              className="h-8 w-36 gap-1 text-xs"
              aria-label="Voice language focus"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOICE_LANGUAGES.map((l) => (
                <SelectItem key={l} value={l} className="text-xs">
                  {LANGUAGE_LABELS[l]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={clearAll}
            aria-label="Clear transcript"
            disabled={turns.length === 0 && status === 'idle'}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {/* Status pill */}
      <div className="flex justify-center py-3">
        <AnimatePresence mode="wait">
          {status !== 'idle' && (
            <motion.div
              key={status}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary"
            >
              {busy && <Loader2 className="size-3 animate-spin" />}
              {STATUS_LABELS[status]}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Transcript */}
      <div
        ref={transcriptRef}
        className="cb-scroll flex-1 overflow-y-auto px-3 py-2 sm:px-6"
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {turns.length === 0 && (
            <VoiceEmptyState recording={recording} />
          )}
          {turns.map((t) => (
            <VoiceTurnCard
              key={t.id}
              turn={t}
              onReplay={() => replay(t.id, t.content)}
            />
          ))}
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Mic */}
      <div className="border-t border-border bg-background/80 px-4 py-5 backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-2">
          <div className="relative">
            {recording && (
              <>
                <span
                  className="cb-pulse-ring pointer-events-none absolute inset-0 rounded-full bg-primary/30"
                  aria-hidden="true"
                />
                <span
                  className="cb-pulse-ring pointer-events-none absolute inset-0 rounded-full bg-primary/20"
                  style={{ animationDelay: '0.4s' }}
                  aria-hidden="true"
                />
              </>
            )}
            <Button
              onClick={onMicClick}
              disabled={busy}
              aria-label={recording ? 'Stop recording' : 'Start recording'}
              className={cn(
                'codebhai-glow relative size-20 rounded-full transition-all',
                recording
                  ? 'bg-destructive text-white hover:bg-destructive/90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
                busy && 'opacity-60'
              )}
            >
              {recording ? (
                <MicOff className="size-8" />
              ) : (
                <Mic className="size-8" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {recording
              ? 'Tap to stop recording'
              : busy
                ? 'Hold on…'
                : 'Tap the mic and ask your tutor'}
          </p>
        </div>
      </div>
    </div>
  )
}

function VoiceEmptyState({ recording }: { recording: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center gap-3 py-10 text-center"
    >
      <div
        className={cn(
          'flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary transition-transform',
          recording && 'scale-110'
        )}
      >
        <Mic className="size-7" />
      </div>
      <h3 className="text-lg font-semibold">Talk to Jarvis</h3>
      <p className="max-w-md text-sm text-muted-foreground">
        Tap the mic below and ask your question out loud. Jarvis will reply
        with voice — perfect for hands-free learning.
      </p>
    </motion.div>
  )
}

function VoiceTurnCard({
  turn,
  onReplay,
}: {
  turn: VoiceTurn
  onReplay: () => void
}) {
  const isUser = turn.role === 'user'
  const showTyping =
    !isUser && turn.audioLoading === true && turn.content === ''
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex w-full gap-2',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {!isUser && (
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Sparkles className="size-4" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[88%] rounded-xl px-3.5 py-2.5 text-sm shadow-sm sm:max-w-[80%]',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-card text-card-foreground border border-border'
        )}
      >
        {isUser ? (
          <div className="flex items-start gap-2">
            <User className="mt-0.5 size-3.5 shrink-0 opacity-70" />
            <p className="whitespace-pre-wrap break-words">{turn.content}</p>
          </div>
        ) : showTyping ? (
          <span className="inline-flex items-center gap-1 py-1.5">
            <span className="cb-dot size-2 rounded-full bg-primary" />
            <span className="cb-dot size-2 rounded-full bg-primary" />
            <span className="cb-dot size-2 rounded-full bg-primary" />
          </span>
        ) : (
          <div className="flex flex-col gap-2">
            <Markdown content={turn.content} />
            <div className="flex items-center gap-2 border-t border-border/60 pt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={onReplay}
                disabled={turn.audioLoading}
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                aria-label="Replay voice"
              >
                {turn.audioLoading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Volume2 className="size-3.5" />
                )}
                Replay voice
              </Button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
