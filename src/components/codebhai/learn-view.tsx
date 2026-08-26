'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Circle,
  CircleDot,
  Code2,
  Database,
  GitBranch,
  GraduationCap,
  Layout,
  Terminal,
  Trophy,
  Cpu,
  Globe,
  Braces,
  Wrench,
  Sparkles,
  Loader2,
  Server,
  Coffee,
  Hash,
  Component,
  Cog,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Markdown } from '@/components/codebhai/markdown'
import { apiFetch } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Track {
  id: string
  slug: string
  title: string
  language: string
  description: string
  icon: string
  difficulty: string
  order: number
  lessonsCount: number
  completedCount: number
}

interface Lesson {
  id: string
  order: number
  title: string
  summary: string
  status: 'not_started' | 'in_progress' | 'completed'
}

interface LessonDetail {
  id: string
  title: string
  content: string
  language: string
  trackTitle: string
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  terminal: Terminal,
  code: Code2,
  database: Database,
  git: GitBranch,
  'git-branch': GitBranch,
  layout: Layout,
  cpu: Cpu,
  globe: Globe,
  braces: Braces,
  wrench: Wrench,
  trophy: Trophy,
  graduation: GraduationCap,
  book: BookOpen,
  sparkles: Sparkles,
  snake: Code2,
  component: Component,
  server: Server,
  coffee: Coffee,
  hash: Hash,
  gopher: Terminal,
  gear: Cog,
}

function getIcon(name?: string) {
  if (!name) return Terminal
  return ICONS[name.toLowerCase()] || Terminal
}

function difficultyColor(d: string): string {
  switch (d?.toLowerCase()) {
    case 'beginner':
      return 'text-emerald-500 border-emerald-500/40 bg-emerald-500/10'
    case 'intermediate':
      return 'text-amber-500 border-amber-500/40 bg-amber-500/10'
    case 'advanced':
      return 'text-rose-500 border-rose-500/40 bg-rose-500/10'
    default:
      return 'text-muted-foreground border-border'
  }
}

export function LearnView() {
  const [view, setView] = React.useState<'tracks' | 'track' | 'lesson'>(
    'tracks'
  )
  const [selectedSlug, setSelectedSlug] = React.useState<string | null>(null)
  const [selectedLessonId, setSelectedLessonId] = React.useState<string | null>(
    null
  )

  const goTracks = () => {
    setView('tracks')
    setSelectedSlug(null)
    setSelectedLessonId(null)
  }
  const goTrack = (slug: string) => {
    setSelectedSlug(slug)
    setView('track')
  }
  const goLesson = (id: string) => {
    setSelectedLessonId(id)
    setView('lesson')
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {view !== 'tracks' && (
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={view === 'lesson' ? () => setView('track') : goTracks}
            className="gap-1.5"
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </div>
      )}
      <div className="cb-scroll flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="h-full"
          >
            {view === 'tracks' && <TracksGrid onOpen={goTrack} />}
            {view === 'track' && selectedSlug && (
              <TrackDetail
                slug={selectedSlug}
                onOpenLesson={goLesson}
              />
            )}
            {view === 'lesson' && selectedLessonId && (
              <LessonReader
                lessonId={selectedLessonId}
                onBackToTrack={() => setView('track')}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function TracksGrid({ onOpen }: { onOpen: (slug: string) => void }) {
  const [tracks, setTracks] = React.useState<Track[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const res = await apiFetch('/api/tracks')
        if (!res.ok) throw new Error('Failed to load tracks')
        const data = await res.json()
        if (mounted) setTracks(data.tracks || [])
      } catch (e: unknown) {
        if (mounted)
          setError(e instanceof Error ? e.message : 'Failed to load tracks')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button
          variant="outline"
          className="mt-3"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5 flex items-center gap-2">
        <GraduationCap className="size-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Learning tracks</h2>
          <p className="text-xs text-muted-foreground">
            Pick a path and learn one step at a time.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tracks.map((t) => {
          const Icon = getIcon(t.icon)
          const total = t.lessonsCount || 0
          const done = t.completedCount || 0
          const pct = total > 0 ? Math.round((done / total) * 100) : 0
          return (
            <Card
              key={t.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(t.slug)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onOpen(t.slug)
                }
              }}
              className="group cursor-pointer gap-0 p-4 transition-all hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary transition-transform group-hover:scale-110">
                  <Icon className="size-5" />
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] capitalize',
                    difficultyColor(t.difficulty)
                  )}
                >
                  {t.difficulty}
                </Badge>
              </div>
              <h3 className="mt-3 text-base font-semibold leading-tight">
                {t.title}
              </h3>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {t.description}
              </p>
              <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="capitalize">{t.language}</span>
                <span>
                  {done}/{total} lessons
                </span>
              </div>
              <Progress value={pct} className="mt-1.5 h-1.5" />
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function TrackDetail({
  slug,
  onOpenLesson,
}: {
  slug: string
  onOpenLesson: (id: string) => void
}) {
  const [track, setTrack] = React.useState<Track | null>(null)
  const [lessons, setLessons] = React.useState<Lesson[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/tracks/${slug}`)
      if (!res.ok) throw new Error('Failed to load track')
      const data = await res.json()
      setTrack(data.track || null)
      setLessons(data.lessons || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load track')
    } finally {
      setLoading(false)
    }
  }, [slug])

  React.useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-72" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !track) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center">
        <p className="text-sm text-destructive">
          {error || 'Track not found'}
        </p>
        <Button variant="outline" className="mt-3" onClick={load}>
          Retry
        </Button>
      </div>
    )
  }

  const Icon = getIcon(track.icon)
  const done = lessons.filter((l) => l.status === 'completed').length

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Icon className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold">{track.title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {track.description}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <Badge
              variant="outline"
              className={cn('capitalize', difficultyColor(track.difficulty))}
            >
              {track.difficulty}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {track.language}
            </Badge>
            <span className="text-muted-foreground">
              {done}/{lessons.length} completed
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {lessons.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No lessons in this track yet.
          </p>
        ) : (
          lessons.map((lesson) => <LessonRow key={lesson.id} lesson={lesson} onOpen={() => onOpenLesson(lesson.id)} />)
        )}
      </div>
    </div>
  )
}

function LessonRow({
  lesson,
  onOpen,
}: {
  lesson: Lesson
  onOpen: () => void
}) {
  const StatusIcon =
    lesson.status === 'completed'
      ? CheckCircle2
      : lesson.status === 'in_progress'
        ? CircleDot
        : Circle
  const statusColor =
    lesson.status === 'completed'
      ? 'text-primary'
      : lesson.status === 'in_progress'
        ? 'text-amber-500'
        : 'text-muted-foreground'
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-lg border border-border bg-card/60 px-3 py-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-xs font-semibold text-muted-foreground">
        {lesson.order}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{lesson.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {lesson.summary}
        </p>
      </div>
      <StatusIcon className={cn('size-5 shrink-0', statusColor)} />
    </button>
  )
}

function LessonReader({
  lessonId,
  onBackToTrack,
}: {
  lessonId: string
  onBackToTrack: () => void
}) {
  const [lesson, setLesson] = React.useState<LessonDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [completing, setCompleting] = React.useState(false)
  const [completed, setCompleted] = React.useState(false)
  const setChatPrefill = useAppStore((s) => s.setChatPrefill)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const setCurrentLanguage = useAppStore((s) => s.setCurrentLanguage)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const learnerId =
        (await import('@/lib/api').then((m) => m.getLearnerId()).catch(
          () => ''
        )) || ''
      const res = await apiFetch(
        `/api/lessons/${lessonId}?learnerId=${encodeURIComponent(learnerId)}`
      )
      if (!res.ok) throw new Error('Failed to load lesson')
      const data = await res.json()
      setLesson(data.lesson || null)
      setCompleted(data.lesson?.status === 'completed')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load lesson')
    } finally {
      setLoading(false)
    }
  }, [lessonId])

  React.useEffect(() => {
    load()
  }, [load])

  const onMarkComplete = async () => {
    if (!lesson || completing) return
    setCompleting(true)
    try {
      const learnerId =
        (await getLearnerIdSafe()) || ''
      const res = await apiFetch(`/api/lessons/${lesson.id}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          learnerId,
          status: 'completed',
        }),
      })
      if (!res.ok) throw new Error('Failed to update progress')
      setCompleted(true)
      toast.success('Lesson marked complete! 🎉')
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : 'Failed to mark lesson complete'
      )
    } finally {
      setCompleting(false)
    }
  }

  const onAskTutor = () => {
    if (!lesson) return
    const msg = `I'm currently learning the lesson "${lesson.title}" (${lesson.language}) in the ${lesson.trackTitle} track. Can you explain it to me in more depth with an example?`
    setChatPrefill(msg)
    setCurrentLanguage(
      (lesson.language as 'python' | 'javascript' | 'typescript' | 'go' | 'rust' | 'general') ||
        'general'
    )
    setActiveTab('chat')
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="mt-3 h-4 w-32" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !lesson) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center">
        <p className="text-sm text-destructive">
          {error || 'Lesson not found'}
        </p>
        <Button variant="outline" className="mt-3" onClick={load}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="cb-scroll flex-1 overflow-y-auto px-4 pb-32 pt-4 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex items-start gap-2">
            <BookOpen className="mt-1 size-5 shrink-0 text-primary" />
            <div>
              <h1 className="text-xl font-semibold leading-tight">
                {lesson.title}
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                {lesson.trackTitle} ·{' '}
                <span className="capitalize">{lesson.language}</span>
              </p>
            </div>
          </div>
          <Markdown content={lesson.content} />
        </div>
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {completed ? (
              <>
                <CheckCircle2 className="size-4 text-primary" />
                <span>Completed</span>
              </>
            ) : (
              <>
                <Circle className="size-4" />
                <span>Not yet completed</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onAskTutor}
              className="gap-1.5"
            >
              <Sparkles className="size-4 text-primary" />
              Ask the tutor
            </Button>
            <Button
              size="sm"
              onClick={onMarkComplete}
              disabled={completing || completed}
              className="gap-1.5"
            >
              {completing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              {completed ? 'Completed' : 'Mark as complete'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

async function getLearnerIdSafe(): Promise<string> {
  try {
    const { getLearnerId } = await import('@/lib/api')
    return await getLearnerId()
  } catch {
    return ''
  }
}
