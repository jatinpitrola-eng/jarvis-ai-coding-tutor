'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Code2,
  GraduationCap,
  MessageCircle,
  Mic,
  Terminal,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { InstallPrompt } from '@/components/codebhai/install-prompt'
import { ChatView } from '@/components/codebhai/chat-view'
import { VoiceView } from '@/components/codebhai/voice-view'
import { LearnView } from '@/components/codebhai/learn-view'
import { PlaygroundView } from '@/components/codebhai/playground-view'
import { useAppStore, type Tab } from '@/lib/store'
import { cn } from '@/lib/utils'

const TABS: Array<{
  id: Tab
  label: string
  short: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { id: 'chat', label: 'Chat', short: 'Chat', icon: MessageCircle },
  { id: 'voice', label: 'Voice', short: 'Voice', icon: Mic },
  { id: 'learn', label: 'Learn', short: 'Learn', icon: GraduationCap },
  { id: 'playground', label: 'Playground', short: 'Code', icon: Code2 },
]

const VALID_TABS: Tab[] = ['chat', 'voice', 'learn', 'playground']

export default function Home() {
  const router = useRouter()
  const activeTab = useAppStore((s) => s.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)

  // Read ?tab= on mount (PWA shortcuts) — uses window.location so we don't
  // need a Suspense boundary around useSearchParams.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('tab')
    if (t && (VALID_TABS as string[]).includes(t)) {
      setActiveTab(t as Tab)
    }
  }, [])

  // Keep URL query in sync with activeTab (so refresh keeps you on the tab)
  React.useEffect(() => {
    const url = new URL(window.location.href)
    if (activeTab === 'chat') {
      url.searchParams.delete('tab')
    } else {
      url.searchParams.set('tab', activeTab)
    }
    router.replace(url.pathname + (url.search || '') + (url.hash || ''), {
      scroll: false,
    })
  }, [activeTab, router])

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <div className="flex items-center gap-2">
            <div className="codebhai-glow flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Terminal className="size-5" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-semibold tracking-tight">
                Jarvis
              </span>
              <span className="hidden text-[10px] text-muted-foreground sm:block">
                AI Coding Tutor
              </span>
            </div>
          </div>

          {/* Desktop tab switcher */}
          <nav
            aria-label="Sections"
            className="ml-2 hidden flex-1 items-center justify-center md:flex"
          >
            <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card/60 p-1">
              {TABS.map((t) => {
                const Icon = t.icon
                const active = activeTab === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                    )}
                  >
                    <Icon className="size-4" />
                    {t.label}
                  </button>
                )
              })}
            </div>
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <InstallPrompt />
          </div>
        </div>
      </header>

      {/* Main area */}
      <main
        className="codebhai-grid relative min-h-0 flex-1"
        aria-label="Jarvis content"
      >
        {/* All views stay mounted so their state persists across tab switches.
            We just toggle visibility via CSS. */}
        <ViewSlot active={activeTab === 'chat'}>
          <ChatView />
        </ViewSlot>
        <ViewSlot active={activeTab === 'voice'}>
          <VoiceView />
        </ViewSlot>
        <ViewSlot active={activeTab === 'learn'}>
          <LearnView />
        </ViewSlot>
        <ViewSlot active={activeTab === 'playground'}>
          <PlaygroundView />
        </ViewSlot>
      </main>

      {/* Footer (sticky-bottom via mt-auto in flex-col wrapper) */}
      <footer className="mt-auto hidden border-t border-border bg-background/80 px-4 py-3 backdrop-blur md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            Built with <span className="text-rose-400">❤</span> — Jarvis
            learns with you.
          </span>
          <span className="text-[11px]">
            Tip: install Jarvis as an app for offline access.
          </span>
        </div>
      </footer>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="mx-auto grid max-w-md grid-cols-4">
          {TABS.map((t) => {
            const Icon = t.icon
            const active = activeTab === t.id
            return (
              <Button
                key={t.id}
                type="button"
                variant="ghost"
                onClick={() => setActiveTab(t.id)}
                aria-current={active ? 'page' : undefined}
                aria-label={t.label}
                className={cn(
                  'relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-none text-[11px] font-medium',
                  active
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {active && (
                  <motion.span
                    layoutId="mobile-tab-active"
                    className="absolute top-0 h-0.5 w-10 rounded-full bg-primary"
                    transition={{
                      type: 'spring',
                      stiffness: 400,
                      damping: 30,
                    }}
                  />
                )}
                <Icon className="size-5" />
                <span>{t.short}</span>
              </Button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

function ViewSlot({
  active,
  children,
}: {
  active: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'absolute inset-x-0 top-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom,0px))] overflow-hidden md:bottom-0',
        active ? 'block' : 'hidden'
      )}
      aria-hidden={!active}
    >
      {children}
    </div>
  )
}
