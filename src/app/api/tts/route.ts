import { NextRequest, NextResponse } from 'next/server'
import { getZai } from '@/lib/zai'

/**
 * POST /api/tts — text to speech.
 * Body: { text: string, voice?: string, speed?: number }
 *
 * Splits text into <=1000-char chunks by sentence (max 3 chunks / 3000 chars)
 * and concatenates the raw wav buffers returned by the SDK.
 *
 * Returns: audio/wav binary with `Cache-Control: no-cache`.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any))
    const rawText = (body?.text || '').toString()
    const voice = (body?.voice || 'tongtong').toString()
    const speed = Number.isFinite(Number(body?.speed)) ? Number(body.speed) : 1.0

    if (!rawText.trim()) {
      return NextResponse.json(
        { error: 'text is required' },
        { status: 400 },
      )
    }

    const chunks = splitIntoChunks(rawText, 1000, 3)
    if (chunks.length === 0) {
      return NextResponse.json(
        { error: 'Text too short to synthesize' },
        { status: 400 },
      )
    }

    const zai = await getZai()
    const buffers: Buffer[] = []

    for (const chunk of chunks) {
      if (!chunk.trim()) continue
      const response: any = await zai.audio.tts.create({
        input: chunk,
        voice,
        speed,
        response_format: 'wav',
        stream: false,
      })
      if (!response) continue
      // The SDK returns the raw fetch Response object for TTS.
      const ab = await response.arrayBuffer()
      buffers.push(Buffer.from(new Uint8Array(ab)))
    }

    if (buffers.length === 0) {
      return NextResponse.json(
        { error: 'TTS returned no audio' },
        { status: 500 },
      )
    }

    const combined = Buffer.concat(buffers)

    return new Response(new Uint8Array(combined), {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'no-cache',
        'Content-Length': combined.length.toString(),
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'TTS failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * Split text into chunks of at most `maxChars` characters, breaking on
 * sentence boundaries (., !, ?, newlines). At most `maxChunks` chunks.
 */
function splitIntoChunks(text: string, maxChars: number, maxChunks: number): string[] {
  // Cap total input length.
  const capped = text.slice(0, maxChars * maxChunks)
  // Split on sentence-ending punctuation followed by whitespace, keeping the
  // punctuation; also break on newlines.
  const sentences = capped
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const chunks: string[] = []
  let current = ''
  for (const sentence of sentences) {
    if (!current) {
      current = sentence
    } else if ((current + ' ' + sentence).length <= maxChars) {
      current += ' ' + sentence
    } else {
      chunks.push(current)
      current = sentence
    }
    if (chunks.length >= maxChunks - 1 && current) {
      // Reserve the last slot for whatever is left.
      break
    }
  }
  if (current && chunks.length < maxChunks) {
    chunks.push(current)
  }
  // Hard cap each chunk to maxChars in case a single sentence exceeded it.
  return chunks.map((c) => c.slice(0, maxChars)).slice(0, maxChunks)
}
