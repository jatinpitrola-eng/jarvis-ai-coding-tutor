'use client'

import * as React from 'react'
import { MessageSquare, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { SessionInfo } from '@/hooks/use-chat'

interface SessionListProps {
  sessions: SessionInfo[]
  currentId: string | null
  loading: boolean
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
}

function formatTime(iso?: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const now = new Date()
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    return sameDay
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

export function SessionList({
  sessions,
  currentId,
  loading,
  onSelect,
  onNew,
  onDelete,
}: SessionListProps) {
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="px-3 pt-3">
        <Button
          onClick={onNew}
          className="w-full justify-start gap-2"
          variant="default"
        >
          <Plus className="size-4" />
          New chat
        </Button>
      </div>
      <div className="px-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <MessageSquare className="size-3.5" />
          Recent
        </div>
      </div>
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-1 pb-3">
          {loading && sessions.length === 0
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-2 py-1">
                  <Skeleton className="h-10 w-full rounded-md" />
                </div>
              ))
            : sessions.length === 0
              ? (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                  No chats yet. Start by saying hi to your tutor.
                </p>
              )
              : sessions.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    'group flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors',
                    'hover:bg-accent/60',
                    currentId === s.id && 'bg-accent text-accent-foreground'
                  )}
                  onClick={() => onSelect(s.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(s.id)
                    }
                  }}
                >
                  <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium leading-tight">
                      {s.title || 'New chat'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.language ? `${s.language} · ` : ''}
                      {formatTime(s.updatedAt)}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Delete session"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(s.id)
                    }}
                  >
                    <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              ))}
        </div>
      </ScrollArea>
    </div>
  )
}

export { formatTime }
