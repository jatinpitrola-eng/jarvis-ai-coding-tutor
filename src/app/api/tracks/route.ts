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
    slug: 'typescript-basics',
    title: 'TypeScript Basics',
    language: 'typescript',
    description:
      'Add types to JavaScript — type annotations, interfaces, generics, and safer code at scale.',
    icon: 'braces',
    difficulty: 'beginner',
    order: 3,
    lessons: [
      '1. Why TypeScript?',
      '2. Basic Types & Annotations',
      '3. Interfaces & Type Aliases',
      '4. Functions & Generics',
      '5. tsconfig & Tooling',
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
    order: 4,
    lessons: [
      '1. Components & JSX',
      '2. Props & State',
      '3. Events & Forms',
      '4. useEffect & Fetching Data',
      '5. Building a Small App',
    ],
  },
  {
    slug: 'nodejs-basics',
    title: 'Node.js Basics',
    language: 'javascript',
    description:
      'Run JavaScript on the server — modules, file system, HTTP, and building a simple API.',
    icon: 'server',
    difficulty: 'beginner',
    order: 5,
    lessons: [
      '1. What is Node.js?',
      '2. Modules: CommonJS & ESM',
      '3. The fs & path Modules',
      '4. HTTP Server Basics',
      '5. Build a Simple REST API',
    ],
  },
  {
    slug: 'html-css-basics',
    title: 'HTML & CSS',
    language: 'html',
    description:
      'The building blocks of every website — structure with HTML, style with CSS, and responsive layouts.',
    icon: 'layout',
    difficulty: 'beginner',
    order: 6,
    lessons: [
      '1. HTML Structure & Tags',
      '2. Forms & Inputs',
      '3. CSS Selectors & Box Model',
      '4. Flexbox & Grid',
      '5. Responsive Design',
    ],
  },
  {
    slug: 'sql-basics',
    title: 'SQL Basics',
    language: 'sql',
    description:
      'Talk to databases — SELECT, JOIN, GROUP BY, and design simple schemas.',
    icon: 'database',
    difficulty: 'beginner',
    order: 7,
    lessons: [
      '1. What is a Database?',
      '2. SELECT, WHERE & ORDER BY',
      '3. INSERT, UPDATE & DELETE',
      '4. JOINs Explained',
      '5. GROUP BY & Aggregates',
    ],
  },
  {
    slug: 'c-basics',
    title: 'C Basics',
    language: 'c',
    description:
      'The mother of modern languages — memory, pointers, and how computers really work.',
    icon: 'cpu',
    difficulty: 'intermediate',
    order: 8,
    lessons: [
      '1. Structure of a C Program',
      '2. Variables, Types & printf',
      '3. Pointers & Memory',
      '4. Functions & Recursion',
      '5. Arrays & Strings',
    ],
  },
  {
    slug: 'cpp-basics',
    title: 'C++ Basics',
    language: 'cpp',
    description:
      'Object-oriented power — classes, templates, and the STL for fast programs.',
    icon: 'cpu',
    difficulty: 'intermediate',
    order: 9,
    lessons: [
      '1. From C to C++',
      '2. Classes & Objects',
      '3. Inheritance & Polymorphism',
      '4. Templates & the STL',
      '5. Memory Management',
    ],
  },
  {
    slug: 'java-basics',
    title: 'Java Basics',
    language: 'java',
    description:
      'Write once, run anywhere — classes, inheritance, and the JVM ecosystem.',
    icon: 'coffee',
    difficulty: 'beginner',
    order: 10,
    lessons: [
      '1. Hello Java & the JVM',
      '2. Variables & Control Flow',
      '3. Classes & Objects',
      '4. Inheritance & Interfaces',
      '5. Collections Framework',
    ],
  },
  {
    slug: 'csharp-basics',
    title: 'C# Basics',
    language: 'csharp',
    description:
      'Microsoft’s modern, versatile language — classes, LINQ, and the .NET runtime.',
    icon: 'hash',
    difficulty: 'beginner',
    order: 11,
    lessons: [
      '1. C# & .NET Overview',
      '2. Variables & Types',
      '3. Classes & Methods',
      '4. LINQ Basics',
      '5. Async & Tasks',
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
    order: 12,
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
    order: 13,
    lessons: [
      '1. Ownership & Borrowing',
      '2. Structs & Enums',
      '3. Pattern Matching',
      '4. Error Handling',
      '5. Traits Basics',
    ],
  },
  {
    slug: 'git-basics',
    title: 'Git & Version Control',
    language: 'bash',
    description:
      'Track changes, collaborate, and never lose code again — commits, branches, and remotes.',
    icon: 'git-branch',
    difficulty: 'beginner',
    order: 14,
    lessons: [
      '1. What is Git?',
      '2. init, add, commit & log',
      '3. Branches & Merge',
      '4. Remote Repos (GitHub)',
      '5. Pull Requests & Workflow',
    ],
  },
  {
    slug: 'bash-basics',
    title: 'Bash & Shell',
    language: 'bash',
    description:
      'Automate the terminal — commands, scripts, pipes, and small automation tools.',
    icon: 'terminal',
    difficulty: 'beginner',
    order: 15,
    lessons: [
      '1. The Terminal & Commands',
      '2. Files, Pipes & Redirection',
      '3. Writing Shell Scripts',
      '4. Variables & Conditionals',
      '5. Loops & Automation',
    ],
  },
]

/**
 * Ensure the default set of tracks + lesson *titles* exist in the DB.
 * Idempotent: inserts only tracks whose slug is missing (so new tracks can
 * be added over time without touching existing ones).
 * Lesson `content` is left empty and generated lazily by /api/lessons/[id].
 */
export async function ensureTracksSeeded(): Promise<void> {
  const existing = await db.learningTrack.findMany({})
  const existingSlugs = new Set(existing.map((t: any) => t.slug))
  const missing = TRACK_SEEDS.filter((s) => !existingSlugs.has(s.slug))
  if (missing.length === 0) return

  // Insert missing tracks + their lessons sequentially.
  for (const seed of missing) {
    const track = await db.learningTrack.create({
      data: {
        slug: seed.slug,
        title: seed.title,
        language: seed.language,
        description: seed.description,
        icon: seed.icon,
        difficulty: seed.difficulty,
        order: seed.order,
      },
    })
    for (let i = 0; i < seed.lessons.length; i++) {
      await db.lesson.create({
        data: {
          trackId: (track as any).id,
          order: i + 1,
          title: seed.lessons[i],
          summary: '',
          content: '',
        },
      })
    }
  }
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
    })

    // Fetch lesson counts per track.
    const allLessons = await db.lesson.findMany({})
    const lessonCountByTrack: Record<string, number> = {}
    for (const l of allLessons as any[]) {
      lessonCountByTrack[l.trackId] = (lessonCountByTrack[l.trackId] || 0) + 1
    }

    // Fetch completed progress for this learner.
    let completedByTrack: Record<string, number> = {}
    if (learnerId) {
      const progress = await db.lessonProgress.findMany({
        where: { learnerId, status: 'completed' },
      })
      const lessonIdToTrack = new Map<string, string>()
      for (const l of allLessons as any[]) lessonIdToTrack.set(l.id, l.trackId)
      for (const p of progress as any[]) {
        const trackId = lessonIdToTrack.get(p.lessonId)
        if (!trackId) continue
        completedByTrack[trackId] = (completedByTrack[trackId] || 0) + 1
      }
    }

    const result = (tracks as any[]).map((t) => ({
      id: t.id,
      slug: t.slug,
      title: t.title,
      language: t.language,
      description: t.description,
      icon: t.icon,
      difficulty: t.difficulty,
      order: t.order,
      lessonsCount: lessonCountByTrack[t.id] || 0,
      completedCount: completedByTrack[t.id] || 0,
    }))

    return NextResponse.json({ tracks: result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
