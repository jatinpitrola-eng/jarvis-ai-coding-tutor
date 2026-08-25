import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/sessions?learnerId=<id>
 *
 * Returns the most recent 50 chat sessions for a learner.
 *
 * Response: { sessions: [{ id, title, language, mode, updatedAt }] }
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const learnerId = (url.searchParams.get('learnerId') || '').trim()

    if (!learnerId) {
      return NextResponse.json(
        { error: 'learnerId query parameter is required' },
        { status: 400 },
      )
    }

    const sessions = await db.chatSession.findMany({
      where: { learnerId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        language: true,
        mode: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        title: s.title,
        language: s.language,
        mode: s.mode,
        updatedAt: s.updatedAt,
      })),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
