import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { streamChat, SYSTEM_PROMPT_TUTOR } from '@/lib/zai'
import { getOrCreateLearner } from '@/lib/learner'

/**
 * POST /api/chat — streaming AI tutor chat (Server-Sent Events).
 *
 * Body: { sessionId: string|null, message: string, language?: string, mode?: 'text'|'voice' }
 *
 * SSE events (each line: `data: <json>\n\n`):
 *   { type:'session', sessionId }
 *   { type:'delta', content }            (repeated)
 *   { type:'done', content }              (full text)
 *   { type:'error', message }             (on failure)
 */
export async function POST(req: NextRequest) {
  const encoder = new TextEncoder()

  const headers = {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  }

  // Parse body first so we can fail with JSON if it's malformed.
  let body: {
    sessionId?: string | null
    message?: string
    language?: string | null
    mode?: string
  }
  try {
    body = await req.json()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid JSON body'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const userMessage = (body.message || '').toString()
  if (!userMessage.trim()) {
    return new Response(
      JSON.stringify({ error: 'message is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const language = body.language ? body.language.toString() : null
  const mode: 'text' | 'voice' =
    body.mode === 'voice' ? 'voice' : 'text'

  // Build a ReadableStream that emits SSE events.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }

      let sessionId = (body.sessionId || '').toString().trim()
      let learnerId = ''
      let createdLearnerId: string | null = null
      let session: { id: string; title: string } | null = null

      try {
        // 1) Resolve learner (from header, creating on the fly if missing).
        learnerId = await getOrCreateLearner(req)
        // If the header was missing, surface the new id so the client can store it.
        if (req.headers.get('x-learner-id')?.trim() !== learnerId) {
          createdLearnerId = learnerId
        }

        // 2) Load or create the ChatSession.
        if (sessionId) {
          const existing = await db.chatSession.findUnique({ where: { id: sessionId } })
          if (!existing) {
            session = await db.chatSession.create({
              data: {
                learnerId,
                title: truncateTitle(userMessage),
                mode,
                language,
              },
            })
            sessionId = session.id
          } else {
            session = existing
            // Make sure session is attached to this learner.
            if (existing.learnerId !== learnerId) {
              await db.chatSession.update({
                where: { id: existing.id },
                data: { learnerId },
              })
            }
          }
        } else {
          session = await db.chatSession.create({
            data: {
              learnerId,
              title: truncateTitle(userMessage),
              mode,
              language,
            },
          })
          sessionId = session.id
        }

        // 3) Persist the user's message.
        await db.message.create({
          data: {
            sessionId,
            role: 'user',
            content: userMessage,
          },
        })

        // Auto-title if the session is still using the default title.
        if (
          session.title === 'New chat' ||
          session.title === '' ||
          (session.title || '').trim().length === 0
        ) {
          await db.chatSession.update({
            where: { id: sessionId },
            data: { title: truncateTitle(userMessage) },
          })
        }

        // 4) Emit the session event first.
        send({
          type: 'session',
          sessionId,
          ...(createdLearnerId ? { learnerId: createdLearnerId } : {}),
        })

        // 5) Build the conversation context (system + recent messages).
        const history = await db.message.findMany({
          where: { sessionId },
          orderBy: { createdAt: 'asc' },
          take: 20,
        })

        const systemContent = buildSystemPrompt(language, mode)
        const messages = [
          { role: 'system', content: systemContent },
          ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        ]

        // 6) Stream tokens from the model (z-ai SDK in sandbox, OpenAI-compat on Vercel).
        let fullText = ''

        try {
          for await (const delta of streamChat(messages)) {
            if (!delta) continue
            fullText += delta
            send({ type: 'delta', content: delta })
          }
        } catch (streamErr: unknown) {
          const msg = streamErr instanceof Error ? streamErr.message : 'stream failed'
          if (!fullText) {
            send({ type: 'error', message: `Failed to generate a reply: ${msg}` })
            controller.close()
            return
          }
        }

        // 7) Persist the assistant's final message + bump session.updatedAt.
        if (fullText.trim()) {
          await db.message.create({
            data: { sessionId, role: 'assistant', content: fullText },
          })
        }
        await db.chatSession.update({
          where: { id: sessionId },
          data: { updatedAt: new Date() },
        })

        // 8) Emit done.
        send({ type: 'done', content: fullText })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        try {
          send({ type: 'error', message })
        } catch {
          /* controller may be closed */
        }
      } finally {
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }
    },
  })

  return new Response(stream, { headers })
}

function truncateTitle(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ')
  if (t.length <= 40) return t
  return t.slice(0, 40).trimEnd() + '…'
}

function buildSystemPrompt(
  language: string | null,
  mode: 'text' | 'voice',
): string {
  let p = SYSTEM_PROMPT_TUTOR
  if (language) {
    p += `\n\nThe learner is currently focusing on ${language}. Prefer ${language} examples when relevant, but you may still use other languages if the learner asks.`
  }
  if (mode === 'voice') {
    p +=
      '\n\nThis is a VOICE conversation. Keep replies short, conversational, and easy to read aloud. Avoid long code blocks unless explicitly asked.'
  }
  return p
}
