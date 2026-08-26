'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Menu,
  Send,
  Sparkles,
  Square,
  Trash2,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Markdown } from '@/components/codebhai/markdown'
import { SessionList } from '@/components/codebhai/session-list'
import { useChat, type ChatMessage } from '@/hooks/use-chat'
import { useLearner } from '@/hooks/use-learner'
import { useAppStore, LANGUAGE_LABELS, type Language } from '@/lib/store'
import { cn } from '@/lib/utils'

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1.5" aria-label="Typing">
      <span className="cb-dot size-2 rounded-full bg-primary" />
      <span className="cb-dot size-2 rounded-full bg-primary" />
      <span className="cb-dot size-2 rounded-full bg-primary" />
    </span>
  )
}

function MessageBubble({
  message,
}: {
  message: ChatMessage
}) {
  const isUser = message.role === 'user'
  const showTyping = !isUser && message.streaming && message.content === ''
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
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
          'max-w-[88%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm sm:max-w-[78%]',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-card text-card-foreground border border-border'
        )}
      >
        {showTyping ? (
          <TypingDots />
        ) : isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <Markdown content={message.content} />
        )}
      </div>
    </motion.div>
  )
}

export function ChatView() {
  const {
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
  } = useChat()
  const { learnerId, loading: learnerLoading } = useLearner()
  const [input, setInput] = React.useState('')
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  const currentLanguage = useAppStore((s) => s.currentLanguage)
  const setCurrentLanguage = useAppStore((s) => s.setCurrentLanguage)
  const chatPrefill = useAppStore((s) => s.chatPrefill)
  const consumePrefill = useAppStore((s) => s.consumePrefill)

  // Load sessions on mount
  React.useEffect(() => {
    if (learnerId) loadSessions()
  }, [learnerId, loadSessions])

  // Auto-scroll to bottom on new content
  React.useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  // Consume a prefill (e.g. "Ask the tutor" from Learn tab)
  React.useEffect(() => {
    if (chatPrefill && !streaming) {
      setInput(chatPrefill)
      consumePrefill()
      // focus input so the user can hit enter
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [chatPrefill, streaming, consumePrefill])

  const onSubmit = async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    await send(text)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div className="flex h-full min-h-0 gap-0">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar/50 md:flex md:flex-col">
        <div className="border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" />
            Conversations
          </h2>
        </div>
        <SessionList
          sessions={sessions}
          currentId={sessionId}
          loading={loadingSessions}
          onSelect={(id) => {
            loadSession(id)
          }}
          onNew={newChat}
          onDelete={deleteSession}
        />
      </aside>

      {/* Mobile sidebar via Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-3 top-3 z-10 size-10 md:hidden"
            aria-label="Open conversations"
          >
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="px-4 pt-4">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              Conversations
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <SessionList
              sessions={sessions}
              currentId={sessionId}
              loading={loadingSessions}
              onSelect={(id) => {
                loadSession(id)
                setSheetOpen(false)
              }}
              onNew={() => {
                newChat()
                setSheetOpen(false)
              }}
              onDelete={deleteSession}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main chat area */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5 pl-14 md:pl-4">
          <div className="flex min-w-0 items-center gap-2">
            {loadingSession ? (
              <Skeleton className="h-5 w-32" />
            ) : (
              <span className="truncate text-sm font-medium text-foreground/90">
                {sessionId
                  ? (sessions.find((s) => s.id === sessionId)?.title ||
                      'Conversation')
                  : 'New conversation'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={currentLanguage}
              onValueChange={(v) => setCurrentLanguage(v as Language)}
            >
              <SelectTrigger
                size="sm"
                className="h-8 w-32 gap-1 text-xs"
                aria-label="Focus language"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(LANGUAGE_LABELS) as Language[]).map((l) => (
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
              onClick={newChat}
              aria-label="New chat"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="cb-scroll flex-1 overflow-y-auto px-3 py-4 sm:px-6"
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            {messages.length === 0 && !learnerLoading && (
              <EmptyState language={currentLanguage} />
            )}
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </AnimatePresence>
            {error && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Input area */}
        <div className="border-t border-border bg-background/80 px-3 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto max-w-3xl">
            <div className="relative flex items-end gap-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask your coding tutor anything…"
                className="cb-scroll min-h-[52px] max-h-48 flex-1 resize-none bg-card/60 pr-2"
                rows={1}
                disabled={streaming}
                aria-label="Chat input"
              />
              {streaming ? (
                <Button
                  size="icon"
                  variant="outline"
                  onClick={stop}
                  aria-label="Stop"
                  className="size-10 shrink-0"
                >
                  <Square className="size-4" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  onClick={onSubmit}
                  disabled={!input.trim() || streaming}
                  aria-label="Send"
                  className="size-10 shrink-0"
                >
                  <Send className="size-4" />
                </Button>
              )}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                Enter to send · Shift+Enter for newline
              </span>
              <Badge variant="outline" className="gap-1 text-[10px]">
                {LANGUAGE_LABELS[currentLanguage]}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ language }: { language: Language }) {
  const examples: Record<Language, string[]> = {
    python: [
      'Explain list comprehensions with an example',
      'Difference between a tuple and a list?',
      'How do I read a CSV file?',
    ],
    javascript: [
      'What are closures in JS?',
      'Explain async/await with an example',
      'How does `this` work?',
    ],
    typescript: [
      'What are generics in TypeScript?',
      'Difference between interface and type?',
      'When should I use `unknown` vs `any`?',
    ],
    go: [
      'Explain goroutines vs threads',
      'How do channels work?',
      'What is a pointer in Go?',
    ],
    rust: [
      'Explain ownership in Rust',
      'What is borrowing?',
      'When do I use `match`?',
    ],
    general: [
      'What is the best first language to learn?',
      'Explain Big-O notation simply',
      'How does Git branching work?',
    ],
  }
  const list = examples[language] || examples.general
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center gap-3 py-10 text-center"
    >
      <div className="codebhai-glow flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        <Sparkles className="size-7" />
      </div>
      <h3 className="text-lg font-semibold">Hi, I&apos;m Jarvis 👋</h3>
      <p className="max-w-md text-sm text-muted-foreground">
        Your patient AI coding tutor. Ask me anything — I&apos;ll explain with
        small steps, real code, and a friendly tone.
      </p>
      <div className="mt-2 flex flex-col gap-1.5">
        {list.map((q) => (
          <SamplePrompt key={q} text={q} />
        ))}
      </div>
    </motion.div>
  )
}

function SamplePrompt({ text }: { text: string }) {
  const { send, streaming } = useChat()
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={streaming}
      onClick={() => send(text)}
      className="justify-start gap-2 border-border/60 text-left text-xs text-muted-foreground hover:text-foreground"
    >
      <Sparkles className="size-3.5 shrink-0 text-primary" />
      {text}
    </Button>
  )
}
