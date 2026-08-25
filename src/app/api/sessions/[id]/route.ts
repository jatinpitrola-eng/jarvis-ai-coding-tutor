import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/sessions/[id]
 *   Returns the full session with its messages (oldest first).
 *   Response: { session: {...}, messages: [{ role, content, createdAt }] }
 *
 * DELETE /api/sessions/[id]
 *   Deletes the session + its messages (cascade).
 *   Response: { success: true }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const session = await db.chatSession.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 },
      )
    }
    return NextResponse.json({
      session: {
        id: session.id,
        title: session.title,
        language: session.language,
        mode: session.mode,
        learnerId: session.learnerId,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      messages: session.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    // findUnique first so we can return a 404 if it never existed.
    const existing = await db.chatSession.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 },
      )
    }
    await db.chatSession.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
