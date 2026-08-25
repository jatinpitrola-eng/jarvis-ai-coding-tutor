import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/lessons/[id]/progress
 * Body: { learnerId: string, status: 'in_progress' | 'completed' | 'not_started' }
 *
 * Upserts a LessonProgress row.
 *
 * Returns: { success: true, status }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: lessonId } = await params
    const body = await req.json().catch(() => ({} as any))
    const learnerId = (body?.learnerId || '').toString().trim()
    const status = (body?.status || '').toString().trim()

    if (!learnerId) {
      return NextResponse.json(
        { error: 'learnerId is required' },
        { status: 400 },
      )
    }
    const validStatuses = ['not_started', 'in_progress', 'completed']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 },
      )
    }

    // Verify the lesson + learner exist (defensive).
    const [lesson, learner] = await Promise.all([
      db.lesson.findUnique({ where: { id: lessonId }, select: { id: true } }),
      db.learner.findUnique({ where: { id: learnerId }, select: { id: true } }),
    ])
    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }
    if (!learner) {
      return NextResponse.json({ error: 'Learner not found' }, { status: 404 })
    }

    await db.lessonProgress.upsert({
      where: { learnerId_lessonId: { learnerId, lessonId } },
      create: { learnerId, lessonId, status },
      update: { status },
    })

    return NextResponse.json({ success: true, status })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
