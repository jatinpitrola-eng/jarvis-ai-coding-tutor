import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const count = await db.learningTrack.count()
    return NextResponse.json({
      DATABASE_URL_set: !!process.env.DATABASE_URL,
      DATABASE_URL_starts: process.env.DATABASE_URL?.slice(0, 25) || 'undefined',
      db_test: 'ok',
      track_count: count,
    })
  } catch (err: unknown) {
    return NextResponse.json({
      DATABASE_URL_set: !!process.env.DATABASE_URL,
      DATABASE_URL_starts: process.env.DATABASE_URL?.slice(0, 25) || 'undefined',
      db_test: 'FAILED',
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }
}
