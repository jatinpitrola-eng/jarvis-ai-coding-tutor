import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateLearner } from '@/lib/learner'

/**
 * GET /api/tracks/[slug] — single track with lessons + learner progress.
 *
 * Returns:
 *   { track: {...}, lessons: [{ id, order, title, summary, status }] }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params

    const track = await db.learningTrack.findUnique({
      where: { slug },
      include: { lessons: { orderBy: { order: 'asc' } } },
    })
    if (!track) {
      return NextResponse.json(
        { error: 'Track not found' },
        { status: 404 },
      )
    }

    let learnerId = ''
    try {
      learnerId = await getOrCreateLearner(req)
    } catch {
      learnerId = ''
    }

    let progressMap: Record<string, string> = {}
    if (learnerId) {
      const progress = await db.lessonProgress.findMany({
        where: { learnerId, lessonId: { in: track.lessons.map((l) => l.id) } },
        select: { lessonId: true, status: true },
      })
      progressMap = Object.fromEntries(
        progress.map((p) => [p.lessonId, p.status]),
      )
    }

    const lessons = track.lessons.map((l) => ({
      id: l.id,
      order: l.order,
      title: l.title,
      summary: l.summary,
      status: progressMap[l.id] || 'not_started',
    }))

    return NextResponse.json({
      track: {
        id: track.id,
        slug: track.slug,
        title: track.title,
        language: track.language,
        description: track.description,
        icon: track.icon,
        difficulty: track.difficulty,
        order: track.order,
      },
      lessons,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
