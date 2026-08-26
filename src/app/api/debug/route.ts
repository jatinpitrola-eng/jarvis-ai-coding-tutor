import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { shouldUsePublicAI, getOpenAIClient, getModel, getModelChain, streamChat } from '@/lib/zai'

export async function GET() {
  // Test the DB connection directly
  let dbOk = 'not-run'
  let trackCount = -1
  try {
    trackCount = await db.learningTrack.count()
    dbOk = 'ok'
  } catch (err: unknown) {
    dbOk = err instanceof Error ? err.message : String(err)
  }

  // Test the AI client directly (non-stream)
  let aiOk = 'not-run'
  let aiReply = ''
  try {
    const client = getOpenAIClient()
    const res = await client.chat.completions.create({
      model: getModel(),
      messages: [
        { role: 'system', content: 'You are Jarvis, a friendly coding tutor built by Jatin Pitroda. Reply in English-Gujarati mix.' },
        { role: 'user', content: 'bhai tame kene banavya? python ma variable su che?' },
      ],
    })
    aiReply = res.choices[0]?.message?.content || '(empty)'
    aiOk = 'ok'
  } catch (err: unknown) {
    aiOk = err instanceof Error ? err.message.slice(0, 300) : String(err)
  }

  // Test streaming
  let streamOk = 'not-run'
  let streamReply = ''
  try {
    let acc = ''
    for await (const d of streamChat([
      { role: 'system', content: 'You are Jarvis. Reply briefly.' },
      { role: 'user', content: 'say hi' },
    ])) {
      acc += d
    }
    streamReply = acc.slice(0, 200)
    streamOk = acc ? 'ok' : 'empty-stream'
  } catch (err: unknown) {
    streamOk = err instanceof Error ? err.message.slice(0, 300) : String(err)
  }

  return NextResponse.json({
    NODE_ENV: process.env.NODE_ENV || 'undefined',
    AI_API_KEY_set: !!process.env.AI_API_KEY,
    shouldUsePublicAI: shouldUsePublicAI(),
    model: getModel(),
    modelChain: getModelChain(),
    db_test: dbOk,
    track_count: trackCount,
    ai_test: aiOk,
    ai_reply: aiReply,
    stream_test: streamOk,
    stream_reply: streamReply,
  })
}
