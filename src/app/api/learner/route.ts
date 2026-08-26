import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/learner?deviceId=<string>
 * POST /api/learner  body { deviceId }
 *
 * Get-or-create a Learner by deviceId. The deviceId (frontend-generated
 * uuid stored in localStorage) is used directly as the Learner primary key
 * so subsequent visits from the same device resolve to the same learner.
 * If no deviceId is supplied, a new Learner with a Prisma-generated cuid
 * is created.
 *
 * Returns: { learnerId: string }
 */
async function getOrCreate(deviceId?: string | null): Promise<string> {
  const id = (deviceId || '').trim()
  if (id) {
    // Treat the supplied deviceId as the Learner primary key.
    const existing = await db.learner.findUnique({ where: { id } }).catch(() => null)
    if (existing) return existing.id
    try {
      const created = await db.learner.create({ data: { id } })
      return created.id
    } catch {
      // Race: another request created it concurrently.
      const again = await db.learner.findUnique({ where: { id } })
      if (again) return again.id
    }
  }
  // No deviceId → generate a fresh cuid via Prisma default.
  const created = await db.learner.create({ data: {} })
  return created.id
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const deviceId = url.searchParams.get('deviceId')
    const learnerId = await getOrCreate(deviceId)
    return NextResponse.json({ learnerId })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    let deviceId: string | undefined
    try {
      const body = await req.json()
      deviceId = body?.deviceId
    } catch {
      // Body not JSON or empty — treat as no deviceId.
      deviceId = undefined
    }
    const learnerId = await getOrCreate(deviceId)
    return NextResponse.json({ learnerId })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
