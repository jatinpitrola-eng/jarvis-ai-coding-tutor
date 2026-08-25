import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateLearner } from '@/lib/learner'

interface TrackSeed {
  slug: string
  title: string
  language: string
  description: string
  icon: string
  difficulty: string
  order: number
  lessons: string[]
}

const TRACK_SEEDS: TrackSeed[] = [
  {
    slug: 'python-basics',
    title: 'Python Basics',
    language: 'python',
    description:
      'Learn the fundamentals of Python — variables, control flow, functions, and data structures — by building small programs.',
    icon: 'snake',
    difficulty: 'beginner',
    order: 1,
    lessons: [
      '1. Variables & Data Types',
      '2. Conditionals & Loops',
      '3. Functions',
      '4. Lists & Dictionaries',
      '5. Your First Program',
    ],
  },
  {
    slug: 'javascript-basics',
    title: 'JavaScript Basics',
    language: 'javascript',
    description:
      'Get started with the language of the web — variables, functions, data structures, the DOM, and async.',
    icon: 'braces',
    difficulty: 'beginner',
    order: 2,
    lessons: [
      '1. Variables: let/const/var',
      '2. Functions & Arrow Functions',
      '3. Arrays & Objects',
      '4. DOM Basics',
      '5. Async with Promises',
    ],
  },
  {
    slug: 'react-fundamentals',
    title: 'React Fundamentals',
    language: 'javascript',
    description:
      'Build modern UIs with React — components, props, state, effects, and a small real-world app.',
    icon: 'component',
    difficulty: 'beginner',
    order: 3,
    lessons: [
      '1. Components & JSX',
      '2. Props & State',
      '3. Events & Forms',
      '4. useEffect & Fetching Data',
      '5. Building a Small App',
    ],
  },
  {
    slug: 'go-basics',
    title: 'Go Basics',
    language: 'go',
    description:
      'Discover Go — packages, types, multiple return values, structs, methods, and goroutines.',
    icon: 'gopher',
    difficulty: 'beginner',
    order: 4,
    lessons: [
      '1. Packages & Hello World',
      '2. Variables & Types',
      '3. Functions & Multiple Returns',
      '4. Structs & Methods',
      '5. Goroutines Basics',
    ],
  },
  {
    slug: 'rust-basics',
    title: 'Rust Basics',
    language: 'rust',
    description:
      'Step into Rust — ownership, structs, enums, pattern matching, error handling, and traits.',
    icon: 'gear',
    difficulty: 'intermediate',
    order: 5,
    lessons: [
      '1. Ownership & Borrowing',
      '2. Structs & Enums',
      '3. Pattern Matching',
      '4. Error Handling',
      '5. Traits Basics',
    ],
  },
]

/**
 * Ensure the default set of tracks + lesson *titles* exist in the DB.
 * Lesson `content` is left empty and generated lazily by /api/lessons/[id].
 * Idempotent — safe to call on every GET.
 */
export async function ensureTracksSeeded(): Promise<void> {
  const existingCount = await db.learningTrack.count()
  if (existingCount > 0) return

  // Create all tracks + lessons in a single DB round-trip via nested writes.
  await db.$transaction(
    TRACK_SEEDS.map((seed) =>
      db.learningTrack.create({
        data: {
          slug: seed.slug,
          title: seed.title,
          language: seed.language,
          description: seed.description,
          icon: seed.icon,
          difficulty: seed.difficulty,
          order: seed.order,
          lessons: {
            create: seed.lessons.map((title, idx) => ({
              order: idx + 1,
              title,
              summary: '',
              content: '',
            })),
          },
        },
      }),
    ),
  )
}

/**
 * GET /api/tracks — list learning tracks (with progress counts per learner).
 * Header `x-learner-id` recommended.
 *
 * Returns: { tracks: [{ id, slug, title, language, description, icon,
 *                       difficulty, order, lessonsCount, completedCount }] }
 */
export async function GET(req: NextRequest) {
  try {
    await ensureTracksSeeded()

    let learnerId = ''
    try {
      learnerId = await getOrCreateLearner(req)
    } catch {
      learnerId = ''
    }

    const tracks = await db.learningTrack.findMany({
      orderBy: { order: 'asc' },
      include: {
        lessons: { select: { id: true } },
      },
    })

    // Fetch completed progress for this learner in one query.
    let completedByTrack: Record<string, number> = {}
    if (learnerId) {
      const progress = await db.lessonProgress.findMany({
        where: { learnerId, status: 'completed' },
        select: { lessonId: true },
      })
      const completedLessonIds = new Set(progress.map((p) => p.lessonId))
      const lessonIdToTrack = new Map<string, string>()
      const allLessons = await db.lesson.findMany({ select: { id: true, trackId: true } })
      for (const l of allLessons) lessonIdToTrack.set(l.id, l.trackId)
      for (const p of progress) {
        const trackId = lessonIdToTrack.get(p.lessonId)
        if (!trackId) continue
        completedByTrack[trackId] = (completedByTrack[trackId] || 0) + 1
      }
      void completedLessonIds
    }

    const result = tracks.map((t) => ({
      id: t.id,
      slug: t.slug,
      title: t.title,
      language: t.language,
      description: t.description,
      icon: t.icon,
      difficulty: t.difficulty,
      order: t.order,
      lessonsCount: t.lessons.length,
      completedCount: completedByTrack[t.id] || 0,
    }))

    return NextResponse.json({ tracks: result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
