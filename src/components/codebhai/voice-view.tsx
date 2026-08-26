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
  Radio,
  Hand,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Markdown } from '@/components/codebhai/markdown'
import { apiFetch, getLearnerId } from '@/lib/api'
import { useAppStore, LANGUAGE_LABELS, type Language } from '@/lib/store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

/* ------------------------------------------------------------------ */
/* Minimal Web Speech API typings (not in default TS DOM lib)          */
/* ------------------------------------------------------------------ */

interface SRAlternative {
  readonly transcript: string
  readonly confidence: number
}
interface SRResult {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: SRAlternative
}
interface SRResultList {
  readonly length: number
  [index: number]: SRResult
}
interface SREvent extends Event {
  readonly resultIndex: number
  readonly results: SRResultList
}
interface SRErrorEvent extends Event {
  readonly error: string
  readonly message: string
}
interface SRInstance extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((this: SRInstance, ev: SREvent) => void) | null
  onerror: ((this: SRInstance, ev: SRErrorEvent) => void) | null
  onend: ((this: SRInstance, ev: Event) => void) | null
  onstart: ((this: SRInstance, ev: Event) => void) | null
}
type SRCtor = new () => SRInstance

function getSpeechRecognitionCtor(): SRCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: SRCtor
    webkitSpeechRecognition?: SRCtor
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

/* ------------------------------------------------------------------ */

type VoiceMode = 'live' | 'tap'
type VoiceStatus =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'recording'
  | 'transcribing'
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

const ALL_LANGUAGES: Language[] = [
  'general',
  'python',
  'javascript',
  'typescript',
  'go',
  'rust',
  'c',
  'cpp',
  'java',
  'csharp',
  'sql',
  'html',
  'css',
  'bash',
  'php',
  'ruby',
  'swift',
  'kotlin',
]

const MAX_TTS_CHARS = 1000
const SUGGESTIONS = [
  'Explain loops',
  'What is a variable?',
  'Teach me Python basics',
]

const STATUS_LABELS: Record<VoiceStatus, string> = {
  idle: '',
  listening: 'Listening… tap to stop',
  thinking: 'Jarvis is thinking…',
  speaking: 'Jarvis is speaking…',
  recording: 'Recording… tap to stop',
  transcribing: 'Transcribing your voice…',
  error: 'Something went wrong',
}

/* ------------------------------------------------------------------ */
/* SSE chat stream reader                                              */
/* ------------------------------------------------------------------ */

async function streamVoiceChat(
  res: Response,
  onDelta: (acc: string) => void,
  onSession: (sessionId: string) => void,
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

/* ------------------------------------------------------------------ */

export function VoiceView() {
  const currentLanguage = useAppStore((s) => s.currentLanguage)
  const setCurrentLanguage = useAppStore((s) => s.setCurrentLanguage)

  // Feature detection: does the browser support SpeechRecognition?
  const [supported, setSupported] = React.useState<boolean>(true)
  React.useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null)
  }, [])

  const [mode, setMode] = React.useState<VoiceMode>('live')
  React.useEffect(() => {
    if (!supported && mode === 'live') setMode('tap')
  }, [supported, mode])

  const [status, setStatus] = React.useState<VoiceStatus>('idle')
  const [turns, setTurns] = React.useState<VoiceTurn[]>([])
  const [interim, setInterim] = React.useState<string>('')
  const [error, setError] = React.useState<string | null>(null)

  // Refs
  const recognitionRef = React.useRef<SRInstance | null>(null)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const activeRef = React.useRef<boolean>(false) // is live conversation active?
  const speakingRef = React.useRef<boolean>(false) // is Jarvis busy (thinking/speaking)?
  const sessionIdRef = React.useRef<string | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)

  // Tap-mode MediaRecorder refs
  const recorderRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const tapStreamRef = React.useRef<MediaStream | null>(null)

  const transcriptRef = React.useRef<HTMLDivElement>(null)

  // Auto-scroll to the latest turn / interim bubble
  React.useEffect(() => {
    const el = transcriptRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [turns, status, interim])

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      activeRef.current = false
      speakingRef.current = false
      try {
        recognitionRef.current?.abort()
      } catch {
        // noop
      }
      recognitionRef.current = null
      if (audioRef.current) {
        try {
          audioRef.current.pause()
        } catch {
          // noop
        }
        if (audioRef.current.src) URL.revokeObjectURL(audioRef.current.src)
        audioRef.current = null
      }
      abortRef.current?.abort()
      try {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
          recorderRef.current.stop()
        }
      } catch {
        // noop
      }
      tapStreamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  /* ---- TTS fetch helper ---- */
  const synthesizeBlobUrl = React.useCallback(
    async (text: string): Promise<string | undefined> => {
      try {
        const learnerId = await getLearnerId().catch(() => '')
        const res = await apiFetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(learnerId ? { 'x-learner-id': learnerId } : {}),
          },
          body: JSON.stringify({
            text: text.slice(0, MAX_TTS_CHARS),
            voice: 'tongtong',
            speed: 1.0,
          }),
        })
        if (!res.ok) throw new Error('TTS failed')
        const buf = await res.arrayBuffer()
        const blob = new Blob([buf], { type: 'audio/wav' })
        return URL.createObjectURL(blob)
      } catch {
        return undefined
      }
    },
    []
  )

  /* ---- Restart recognition (with double-start guard) ---- */
  const restartRecognition = React.useCallback(() => {
    const rec = recognitionRef.current
    if (!rec) return
    if (!activeRef.current) return
    if (speakingRef.current) return
    try {
      rec.start()
    } catch {
      // already started or stopped — ignore
    }
  }, [])

  /* ---- Called when Jarvis finishes speaking (audio ended) ---- */
  const onSpeakingEnd = React.useCallback(() => {
    speakingRef.current = false
    if (activeRef.current) {
      setStatus('listening')
      // Resume recognition so the conversation continues
      restartRecognition()
    } else {
      setStatus('idle')
    }
  }, [restartRecognition])

  /* ---- Play an audio blob URL via a fresh Audio element ---- */
  const playAudio = React.useCallback(
    async (url: string) => {
      // Cleanup any previously playing audio
      if (audioRef.current) {
        try {
          audioRef.current.pause()
        } catch {
          // noop
        }
        if (audioRef.current.src) URL.revokeObjectURL(audioRef.current.src)
        audioRef.current = null
      }
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        if (audio.src) URL.revokeObjectURL(audio.src)
        if (audioRef.current === audio) audioRef.current = null
        onSpeakingEnd()
      }
      audio.onerror = () => {
        if (audio.src) URL.revokeObjectURL(audio.src)
        if (audioRef.current === audio) audioRef.current = null
        onSpeakingEnd()
      }
      try {
        await audio.play()
      } catch {
        // Autoplay blocked or audio error — end the speaking phase gracefully
        if (audio.src) URL.revokeObjectURL(audio.src)
        if (audioRef.current === audio) audioRef.current = null
        onSpeakingEnd()
      }
    },
    [onSpeakingEnd]
  )

  /* ---- Stop the live conversation (user tapped the button) ---- */
  const stopLiveConversation = React.useCallback(() => {
    activeRef.current = false
    speakingRef.current = false
    try {
      recognitionRef.current?.abort()
    } catch {
      // noop
    }
    recognitionRef.current = null
    if (audioRef.current) {
      try {
        audioRef.current.pause()
      } catch {
        // noop
      }
      if (audioRef.current.src) URL.revokeObjectURL(audioRef.current.src)
      audioRef.current = null
    }
    abortRef.current?.abort()
    abortRef.current = null
    setInterim('')
    setStatus('idle')
  }, [])

  /* ---- Handle a finalized user utterance (live final result, chip, or ASR text) ---- */
  const handleUserUtterance = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      if (speakingRef.current) return // already busy, ignore

      speakingRef.current = true
      setInterim('')
      // Pause recognition during thinking + speaking so the mic doesn't
      // pick up Jarvis's own voice.
      try {
        recognitionRef.current?.abort()
      } catch {
        // noop
      }

      // Add the user turn
      const userTurnId = newId()
      setTurns((prev) => [
        ...prev,
        { id: userTurnId, role: 'user', content: trimmed },
      ])

      // Add a pending assistant turn (will stream in)
      const pendingId = newId()
      setTurns((prev) => [
        ...prev,
        { id: pendingId, role: 'assistant', content: '', audioLoading: true },
      ])

      setStatus('thinking')
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const res = await apiFetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            message: trimmed,
            language: currentLanguage === 'general' ? null : currentLanguage,
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
          (sessionId) => {
            sessionIdRef.current = sessionId
          },
          controller.signal
        )
        setTurns((prev) =>
          prev.map((t) =>
            t.id === pendingId
              ? { ...t, content: fullText, audioLoading: false }
              : t
          )
        )

        // TTS + play
        setStatus('speaking')
        const audioUrl = await synthesizeBlobUrl(fullText)
        setTurns((prev) =>
          prev.map((t) =>
            t.id === pendingId ? { ...t, audioUrl } : t
          )
        )
        if (audioUrl) {
          await playAudio(audioUrl)
          // onSpeakingEnd() will be called by audio.onended
        } else {
          // TTS failed — text is still visible; reset and keep listening
          onSpeakingEnd()
        }
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          // User stopped — silently reset
          onSpeakingEnd()
          return
        }
        const msg = e instanceof Error ? e.message : 'Failed to chat'
        setError(msg)
        setStatus('error')
        toast.error(msg)
        speakingRef.current = false
        if (activeRef.current) {
          setStatus('listening')
          restartRecognition()
        }
      } finally {
        abortRef.current = null
      }
    },
    [
      currentLanguage,
      synthesizeBlobUrl,
      playAudio,
      onSpeakingEnd,
      restartRecognition,
    ]
  )

  /* ---- Start the continuous live conversation ---- */
  const startLiveConversation = React.useCallback(() => {
    const ctor = getSpeechRecognitionCtor()
    if (!ctor) {
      toast.error("Your browser doesn't support live voice. Using tap mode.")
      setSupported(false)
      setMode('tap')
      return
    }
    setError(null)
    setInterim('')
    activeRef.current = true
    speakingRef.current = false

    const rec = new ctor()
    // en-IN handles the Eng-Guj mix well enough for v1
    rec.lang = 'en-IN'
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onresult = (ev: SREvent) => {
      // Ignore results while Jarvis is speaking (his own voice would leak in)
      if (speakingRef.current) return
      if (!activeRef.current) return
      let interimText = ''
      let finalText: string | null = null
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i]
        const txt = r[0]?.transcript || ''
        if (r.isFinal) {
          if (txt.trim()) finalText = (finalText || '') + txt
        } else {
          interimText += txt
        }
      }
      setInterim(interimText)
      if (finalText && finalText.trim()) {
        void handleUserUtterance(finalText.trim())
      }
    }

    rec.onerror = (ev: SRErrorEvent) => {
      const err = ev.error
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        toast.error('Microphone permission denied. Switching to tap mode.')
        stopLiveConversation()
        setSupported(false)
        setMode('tap')
        return
      }
      // no-speech, aborted, network, audio-capture — just let onend restart
    }

    rec.onend = () => {
      // Browsers stop recognition after a pause. If the conversation is still
      // active and Jarvis isn't speaking, auto-restart to keep it continuous.
      if (activeRef.current && !speakingRef.current) {
        restartRecognition()
      }
    }

    recognitionRef.current = rec
    setStatus('listening')
    try {
      rec.start()
    } catch {
      // already started — ignore
    }
  }, [handleUserUtterance, restartRecognition, stopLiveConversation])

  /* ---- Tap mode: stop recording ---- */
  const stopTapRecording = React.useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }, [])

  /* ---- Tap mode: transcribe the recorded blob ---- */
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
        await handleUserUtterance(text)
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : 'Failed to transcribe audio'
        setError(msg)
        setStatus('error')
        toast.error(msg)
      }
    },
    [handleUserUtterance]
  )

  /* ---- Tap mode: start recording via MediaRecorder ---- */
  const startTapRecording = React.useCallback(async () => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Microphone not supported on this device.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      tapStreamRef.current = stream
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
        stream.getTracks().forEach((t) => t.stop())
        tapStreamRef.current = null
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
    }
  }, [handleAsr])

  /* ---- Replay an assistant turn's audio ---- */
  const replayAudio = React.useCallback(
    async (turnId: string, text: string) => {
      if (speakingRef.current) return // already busy
      // Pause recognition while replaying so the mic doesn't pick up Jarvis
      if (activeRef.current) {
        speakingRef.current = true
        try {
          recognitionRef.current?.abort()
        } catch {
          // noop
        }
      }
      setTurns((prev) =>
        prev.map((t) => (t.id === turnId ? { ...t, audioLoading: true } : t))
      )
      setStatus('speaking')
      const url = await synthesizeBlobUrl(text)
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId ? { ...t, audioLoading: false, audioUrl: url } : t
        )
      )
      if (url) {
        await playAudio(url)
      } else {
        onSpeakingEnd()
      }
    },
    [synthesizeBlobUrl, playAudio, onSpeakingEnd]
  )

  /* ---- Suggestion chip handler ---- */
  const onSuggestion = React.useCallback(
    (text: string) => {
      if (speakingRef.current) return
      void handleUserUtterance(text)
    },
    [handleUserUtterance]
  )

  /* ---- Clear the whole conversation ---- */
  const clearAll = React.useCallback(() => {
    if (mode === 'live') stopLiveConversation()
    else stopTapRecording()
    abortRef.current?.abort()
    abortRef.current = null
    setTurns([])
    setInterim('')
    setError(null)
    setStatus('idle')
    sessionIdRef.current = null
  }, [mode, stopLiveConversation, stopTapRecording])

  /* ---- Mode switch (Live <-> Tap) ---- */
  const onModeChange = React.useCallback(
    (v: string) => {
      if (!v) return // don't allow deselect
      if (v === mode) return
      if (mode === 'live') stopLiveConversation()
      else stopTapRecording()
      abortRef.current?.abort()
      abortRef.current = null
      setInterim('')
      setError(null)
      setStatus('idle')
      setMode(v as VoiceMode)
    },
    [mode, stopLiveConversation, stopTapRecording]
  )

  /* ---- Big mic button click ---- */
  const onMicClick = React.useCallback(() => {
    if (mode === 'live') {
      if (activeRef.current) {
        stopLiveConversation()
      } else {
        startLiveConversation()
      }
    } else {
      // Tap mode
      if (status === 'recording') {
        stopTapRecording()
      } else if (status === 'idle' || status === 'error') {
        void startTapRecording()
      }
      // Ignore during thinking/speaking/transcribing
    }
  }, [
    mode,
    status,
    startLiveConversation,
    stopLiveConversation,
    startTapRecording,
    stopTapRecording,
  ])

  /* ---- Derived button state ---- */
  const isBusy =
    status === 'thinking' ||
    status === 'speaking' ||
    status === 'transcribing'

  const micButtonColor = cn(
    'codebhai-glow relative size-20 rounded-full transition-all',
    status === 'idle' && 'bg-primary text-primary-foreground hover:bg-primary/90',
    status === 'listening' &&
      'bg-primary text-primary-foreground hover:bg-primary/90',
    status === 'thinking' && 'bg-amber-500 text-white hover:bg-amber-500/90',
    status === 'speaking' &&
      'bg-primary text-primary-foreground hover:bg-primary/90',
    status === 'recording' &&
      'bg-destructive text-white hover:bg-destructive/90',
    status === 'transcribing' &&
      'bg-amber-500 text-white hover:bg-amber-500/90',
    status === 'error' &&
      'bg-primary text-primary-foreground hover:bg-primary/90'
  )

  const micButtonIcon =
    status === 'listening' ? (
      <Mic className="size-8" />
    ) : status === 'thinking' ? (
      <Loader2 className="size-8 animate-spin" />
    ) : status === 'speaking' ? (
      <Volume2 className="size-8" />
    ) : status === 'recording' ? (
      <MicOff className="size-8" />
    ) : status === 'transcribing' ? (
      <Loader2 className="size-8 animate-spin" />
    ) : (
      <Mic className="size-8" />
    )

  const micHint =
    mode === 'live'
      ? activeRef.current
        ? 'Tap to stop the conversation'
        : 'Tap to start a conversation'
      : status === 'recording'
        ? 'Tap to stop recording'
        : isBusy
          ? 'Hold on…'
          : 'Tap the mic and ask your tutor'

  const micAriaLabel =
    mode === 'live'
      ? activeRef.current
        ? 'Stop conversation'
        : 'Start conversation'
      : status === 'recording'
        ? 'Stop recording'
        : 'Start recording'

  const showRings =
    status === 'listening' ||
    status === 'speaking' ||
    status === 'recording'

  const buttonDisabled = mode === 'tap' && isBusy

  /* ---- Render ---- */
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-semibold">Voice Tutor</h2>
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={onModeChange}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem
              value="live"
              className="gap-1.5 text-xs"
              disabled={!supported}
              aria-label="Live mode"
            >
              <Radio className="size-3.5" />
              Live
            </ToggleGroupItem>
            <ToggleGroupItem
              value="tap"
              className="gap-1.5 text-xs"
              aria-label="Tap mode"
            >
              <Hand className="size-3.5" />
              Tap
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={currentLanguage}
            onValueChange={(v) => setCurrentLanguage(v as Language)}
          >
            <SelectTrigger
              size="sm"
              className="h-8 w-32 gap-1 text-xs sm:w-36"
              aria-label="Voice language focus"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_LANGUAGES.map((l) => (
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
            disabled={turns.length === 0 && status === 'idle' && !interim}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {/* Unsupported note */}
      {!supported && (
        <div className="px-4 py-2 text-center">
          <p className="text-xs text-muted-foreground">
            Your browser doesn&apos;t support live voice — using tap mode.
          </p>
        </div>
      )}

      {/* Transcript */}
      <div
        ref={transcriptRef}
        className="cb-scroll flex-1 overflow-y-auto px-3 py-3 sm:px-6"
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {turns.length === 0 && !interim && (
            <VoiceEmptyState onSuggestion={onSuggestion} />
          )}
          {turns.map((t) => (
            <VoiceTurnCard
              key={t.id}
              turn={t}
              busy={isBusy}
              onReplay={() => replayAudio(t.id, t.content)}
            />
          ))}
          {/* Live interim bubble */}
          <AnimatePresence>
            {mode === 'live' && interim ? (
              <motion.div
                key="interim"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex w-full justify-end"
              >
                <div className="max-w-[80%] rounded-xl bg-primary/10 px-3.5 py-2.5 text-sm italic text-muted-foreground">
                  {interim}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Status pill + mic */}
      <div className="border-t border-border bg-background/80 px-4 py-4 backdrop-blur sm:py-5">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-2.5">
          {/* Status pill */}
          <AnimatePresence mode="wait">
            {status !== 'idle' ? (
              <motion.div
                key={status}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className={cn(
                  'flex items-center gap-2 rounded-full px-3 py-1 text-xs',
                  status === 'listening' && 'bg-primary/10 text-primary',
                  status === 'thinking' && 'bg-amber-500/10 text-amber-500',
                  status === 'speaking' && 'bg-primary/10 text-primary',
                  status === 'recording' &&
                    'bg-destructive/10 text-destructive',
                  status === 'transcribing' &&
                    'bg-amber-500/10 text-amber-500',
                  status === 'error' && 'bg-destructive/10 text-destructive'
                )}
              >
                {status === 'thinking' || status === 'transcribing' ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : null}
                {status === 'listening' ? (
                  <span className="cb-dot size-2 rounded-full bg-primary" />
                ) : null}
                {status === 'speaking' ? (
                  <Volume2 className="size-3" />
                ) : null}
                {status === 'recording' ? (
                  <span className="cb-dot size-2 rounded-full bg-destructive" />
                ) : null}
                {status === 'error' ? (
                  <AlertCircle className="size-3" />
                ) : null}
                {STATUS_LABELS[status]}
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Mic button with pulse rings */}
          <div className="relative flex items-center justify-center">
            {showRings ? (
              <>
                <span
                  className={cn(
                    'cb-pulse-ring pointer-events-none absolute inset-0 rounded-full',
                    status === 'recording' ? 'bg-destructive/30' : 'bg-primary/30'
                  )}
                  aria-hidden="true"
                />
                {status !== 'speaking' ? (
                  <span
                    className={cn(
                      'cb-pulse-ring pointer-events-none absolute inset-0 rounded-full',
                      status === 'recording'
                        ? 'bg-destructive/20'
                        : 'bg-primary/20'
                    )}
                    style={{ animationDelay: '0.4s' }}
                    aria-hidden="true"
                  />
                ) : null}
              </>
            ) : null}
            <Button
              onClick={onMicClick}
              disabled={buttonDisabled}
              aria-label={micAriaLabel}
              className={micButtonColor}
            >
              {micButtonIcon}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{micHint}</p>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Empty state with suggestion chips                                   */
/* ------------------------------------------------------------------ */

function VoiceEmptyState({
  onSuggestion,
}: {
  onSuggestion: (text: string) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center gap-4 py-8 text-center"
    >
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        <Mic className="size-7" />
      </div>
      <div>
        <h3 className="text-lg font-semibold">Talk to Jarvis</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Hands-free voice conversation. Just talk — I&apos;ll reply and keep
          listening.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggestion(s)}
            className="min-h-[36px] rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            {s}
          </button>
        ))}
      </div>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/* Turn card                                                           */
/* ------------------------------------------------------------------ */

function VoiceTurnCard({
  turn,
  busy,
  onReplay,
}: {
  turn: VoiceTurn
  busy: boolean
  onReplay: () => void
}) {
  const isUser = turn.role === 'user'
  const showTyping =
    !isUser && turn.audioLoading === true && turn.content === ''
  const replayDisabled = busy || !!turn.audioLoading
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex w-full gap-2',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {!isUser ? (
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Sparkles className="size-4" />
        </div>
      ) : null}
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
                disabled={replayDisabled}
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
