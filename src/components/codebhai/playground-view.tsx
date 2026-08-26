'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Code2,
  Lightbulb,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  XCircle,
  Wand2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Skeleton } from '@/components/ui/skeleton'
import { Markdown } from '@/components/codebhai/markdown'
import { apiFetch, getLearnerId } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type PlaygroundLanguage =
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'go'
  | 'rust'
  | 'c'
  | 'cpp'
  | 'java'
  | 'csharp'
  | 'sql'
  | 'html'
  | 'css'
  | 'bash'
  | 'php'
  | 'ruby'
  | 'swift'
  | 'kotlin'
type Difficulty = 'easy' | 'medium' | 'hard'

interface Exercise {
  id: string
  language: PlaygroundLanguage
  prompt: string
  starter: string | null
  hints: string[]
  difficulty: Difficulty
}

interface ReviewResult {
  feedback: string
  score: number
  passed: boolean
}

const LANGUAGES: PlaygroundLanguage[] = [
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

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-500 border-emerald-500/50 bg-emerald-500/10'
  if (score >= 50) return 'text-amber-500 border-amber-500/50 bg-amber-500/10'
  return 'text-rose-500 border-rose-500/50 bg-rose-500/10'
}

export function PlaygroundView() {
  const [language, setLanguage] = React.useState<PlaygroundLanguage>('python')
  const [difficulty, setDifficulty] = React.useState<Difficulty>('easy')
  const [topic, setTopic] = React.useState('')
  const [exercise, setExercise] = React.useState<Exercise | null>(null)
  const [code, setCode] = React.useState('')
  const [review, setReview] = React.useState<ReviewResult | null>(null)
  const [generating, setGenerating] = React.useState(false)
  const [reviewing, setReviewing] = React.useState(false)

  const onGenerate = async () => {
    if (generating) return
    setGenerating(true)
    setReview(null)
    try {
      const learnerId = await getLearnerId().catch(() => '')
      const res = await apiFetch('/api/playground/exercise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          difficulty,
          topic: topic.trim() || null,
          learnerId,
        }),
      })
      if (!res.ok) throw new Error('Failed to generate exercise')
      const data = await res.json()
      const ex = data.exercise as Exercise
      if (!ex) throw new Error('No exercise returned')
      setExercise(ex)
      setCode(ex.starter || '')
      setReview(null)
      toast.success('New exercise ready! 💪')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate exercise')
    } finally {
      setGenerating(false)
    }
  }

  const onReview = async () => {
    if (!exercise || reviewing) return
    if (!code.trim()) {
      toast.error('Write some code first!')
      return
    }
    setReviewing(true)
    setReview(null)
    try {
      const learnerId = await getLearnerId().catch(() => '')
      const res = await apiFetch('/api/playground/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exerciseId: exercise.id,
          code,
          learnerId,
        }),
      })
      if (!res.ok) throw new Error('Failed to review code')
      const data = await res.json()
      setReview({
        feedback: data.feedback || '',
        score: typeof data.score === 'number' ? data.score : 0,
        passed: !!data.passed,
      })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to review code')
    } finally {
      setReviewing(false)
    }
  }

  return (
    <div className="cb-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-5 flex items-center gap-2">
          <Code2 className="size-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Playground</h2>
            <p className="text-xs text-muted-foreground">
              Generate a coding challenge, write your solution, and get AI
              feedback.
            </p>
          </div>
        </div>

        {/* Controls */}
        <Card className="gap-0 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Language
              </label>
              <Select
                value={language}
                onValueChange={(v) => setLanguage(v as PlaygroundLanguage)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l} value={l} className="capitalize">
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Difficulty
              </label>
              <Select
                value={difficulty}
                onValueChange={(v) => setDifficulty(v as Difficulty)}
              >
                <SelectTrigger className="w-full capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d} value={d} className="capitalize">
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Topic (optional)
              </label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. loops, recursion, sorting…"
                className="w-full"
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              onClick={onGenerate}
              disabled={generating}
              className="gap-1.5"
            >
              {generating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              {exercise ? 'New exercise' : 'Generate exercise'}
            </Button>
            {exercise && (
              <Button
                variant="ghost"
                onClick={onGenerate}
                disabled={generating}
                className="gap-1.5 text-xs"
              >
                <RefreshCw className="size-3.5" />
                Reset
              </Button>
            )}
          </div>
        </Card>

        {/* Exercise */}
        <AnimatePresence mode="wait">
          {generating && !exercise && (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-4 space-y-3"
            >
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </motion.div>
          )}

          {exercise && (
            <motion.div
              key={exercise.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-4 space-y-3"
            >
              {/* Prompt */}
              <Card className="gap-0 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {exercise.language}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      'capitalize',
                      scoreColor(
                        exercise.difficulty === 'easy'
                          ? 90
                          : exercise.difficulty === 'medium'
                            ? 65
                            : 30
                      )
                    )}
                  >
                    {exercise.difficulty}
                  </Badge>
                </div>
                <Markdown content={exercise.prompt} />
              </Card>

              {/* Hints */}
              {exercise.hints && exercise.hints.length > 0 && (
                <Accordion
                  type="single"
                  collapsible
                  className="rounded-xl border border-border bg-card/60 px-4"
                >
                  <AccordionItem value="hints" className="border-b-0">
                    <AccordionTrigger className="gap-2 py-3 text-sm">
                      <span className="flex items-center gap-2">
                        <Lightbulb className="size-4 text-amber-500" />
                        Hints ({exercise.hints.length})
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="text-sm">
                      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                        {exercise.hints.map((h, i) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}

              {/* Code editor */}
              <Card className="gap-0 p-3">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Code2 className="size-3.5" />
                    Your code
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {language}
                  </span>
                </div>
                <Textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="// Write your solution here…"
                  spellCheck={false}
                  className={cn(
                    'cb-scroll min-h-[280px] resize-y rounded-md border-border/60 bg-[#1a1f1d] font-mono text-sm leading-relaxed text-foreground/90',
                    'focus-visible:ring-primary/40'
                  )}
                  style={{
                    fontFamily:
                      'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace',
                  }}
                />
                <div className="mt-2 flex items-center justify-between px-1">
                  <span className="text-[11px] text-muted-foreground">
                    {code.split('\n').length} lines · {code.length} chars
                  </span>
                  <Button
                    onClick={onReview}
                    disabled={reviewing}
                    className="gap-1.5"
                    size="sm"
                  >
                    {reviewing ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Play className="size-4" />
                    )}
                    Review my code
                  </Button>
                </div>
              </Card>

              {/* Review result */}
              <AnimatePresence>
                {review && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <Card className="gap-0 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="flex items-center gap-2 text-sm font-semibold">
                          <Sparkles className="size-4 text-primary" />
                          AI Review
                        </h3>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn('gap-1', scoreColor(review.score))}
                          >
                            Score: {review.score}/100
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              'gap-1',
                              review.passed
                                ? 'text-emerald-500 border-emerald-500/50 bg-emerald-500/10'
                                : 'text-rose-500 border-rose-500/50 bg-rose-500/10'
                            )}
                          >
                            {review.passed ? (
                              <CheckCircle2 className="size-3.5" />
                            ) : (
                              <XCircle className="size-3.5" />
                            )}
                            {review.passed ? 'Passed' : 'Try again'}
                          </Badge>
                        </div>
                      </div>
                      <Markdown content={review.feedback} />
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {!exercise && !generating && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6 flex flex-col items-center justify-center gap-3 py-12 text-center"
            >
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Wand2 className="size-7" />
              </div>
              <h3 className="text-lg font-semibold">Ready to code?</h3>
              <p className="max-w-md text-sm text-muted-foreground">
                Pick a language and difficulty, then tap{' '}
                <span className="font-medium text-foreground">
                  Generate exercise
                </span>{' '}
                to get a fresh challenge with starter code and AI review.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
