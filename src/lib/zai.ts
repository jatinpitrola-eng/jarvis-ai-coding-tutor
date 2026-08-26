import ZAI from 'z-ai-web-dev-sdk'
import OpenAI from 'openai'

// Lazily-created, module-level cached ZAI instance (sandbox only).
// The SDK reads /etc/.z-ai-config on first creation; we cache the
// configured instance so we only pay that cost once per server process.
let _zai: ZAI | null = null
let _zaiPromise: Promise<ZAI> | null = null

export async function getZai(): Promise<ZAI> {
  if (_zai) return _zai
  if (_zaiPromise) return _zaiPromise
  _zaiPromise = ZAI.create().then((instance) => {
    _zai = instance
    _zaiPromise = null
    return instance
  })
  return _zaiPromise
}

/**
 * Whether we should use the public OpenAI-compatible API (e.g. Groq/OpenAI)
 * instead of the sandbox-only z-ai SDK. Controlled by AI_API_KEY env var.
 *
 * - Sandbox (no AI_API_KEY): uses z-ai SDK (internal backend, works here only).
 * - Vercel (AI_API_KEY set): uses OpenAI-compatible API (Groq/OpenAI/etc.).
 */
export function shouldUsePublicAI(): boolean {
  // Use public AI if a key is set, OR if we're NOT in the z-ai sandbox.
  // The z-ai SDK only works inside the sandbox (internal-api.z.ai is private).
  // On Vercel/any public host with no key, fall back to Pollinations (free, no key).
  if (process.env.AI_API_KEY) return true
  // Detect sandbox: the z-ai config file exists at /etc/.z-ai-config.
  // In production (Vercel) that file won't exist.
  return process.env.NODE_ENV === 'production'
}

let _openai: OpenAI | null = null
export function getOpenAIClient(): OpenAI {
  if (_openai) return _openai
  // If a key is set, use the configured provider (Groq/OpenAI/Gemini).
  // Otherwise use Pollinations.ai (free, no key, OpenAI-compatible).
  if (process.env.AI_API_KEY) {
    _openai = new OpenAI({
      apiKey: process.env.AI_API_KEY,
      baseURL: process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1',
    })
  } else {
    _openai = new OpenAI({
      apiKey: 'pollinations-anonymous',
      baseURL: 'https://text.pollinations.ai/openai',
    })
  }
  return _openai
}

// Model fallback chain — if the primary model 404s (deprecated/no access),
// try the next one. Covers all current + recently-deprecated Groq models.
// For Pollinations (no key), the primary is 'openai' (free).
const GROQ_FALLBACKS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'deepseek-r1-distill-llama-70b',
  'qwen-2.5-coder-32b',
  'qwen-2.5-32b',
  'llama-3.2-3b-preview',
  'llama-3.2-1b-preview',
  'llama3-70b-8192',
  'llama3-8b-8192',
  'gemma2-9b-it',
  'mixtral-8x7b-32768',
  'llama-3.1-70b-versatile',
]

const POLLINATIONS_FALLBACKS = ['openai', 'openai-fast', 'mistral', 'llama']

export function getModel(): string {
  if (process.env.AI_API_KEY) {
    return process.env.AI_MODEL || 'llama-3.3-70b-versatile'
  }
  // Pollinations default
  return process.env.AI_MODEL || 'openai'
}

/** Returns the list of models to try, primary first then fallbacks. */
export function getModelChain(): string[] {
  const primary = getModel()
  const fallbacks = process.env.AI_API_KEY ? GROQ_FALLBACKS : POLLINATIONS_FALLBACKS
  return [primary, ...fallbacks.filter((m) => m !== primary)]
}

/**
 * Strip markdown ```json fences (and any surrounding prose) so we can
 * safely JSON.parse the model's strict-JSON responses.
 */
export function stripJsonFences(input: string): string {
  let t = (input || '').trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json|JSON)?\s*/, '')
    const closeIdx = t.lastIndexOf('```')
    if (closeIdx !== -1) {
      t = t.slice(0, closeIdx)
    }
  }
  t = t.replace(/```\s*$/m, '').trim()
  return t
}

/**
 * Try to parse a strict-JSON model response. Returns null on failure.
 */
export function tryParseJson(input: string): unknown | null {
  try {
    return JSON.parse(stripJsonFences(input))
  } catch {
    const match = input.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
    if (match) {
      try {
        return JSON.parse(match[1])
      } catch {
        return null
      }
    }
    return null
  }
}

export const SYSTEM_PROMPT_TUTOR = `You are Jarvis, a friendly coding tutor built by Jatin Pitroda. Teach any language (Python/JS/React/Go/Rust/C/C++/Java/C#/SQL/HTML/CSS/Git/Bash). Reply in the SAME language the learner uses (Gujarati-English mix default, e.g. "bhai python ma variable su che?"). Use Markdown with fenced code blocks. Keep replies short: explanation + tiny code example + "Try this". You're warm and encouraging, never robotic. If asked who made you, say Jatin Pitroda.`

/**
 * Stream a chat completion. Yields text deltas (string chunks).
 * Works with both z-ai SDK (sandbox) and OpenAI-compatible API (Vercel).
 */
export async function* streamChat(
  messages: Array<{ role: string; content: string }>,
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  if (shouldUsePublicAI()) {
    const client = getOpenAIClient()
    const models = getModelChain()
    let lastErr: unknown = null
    for (const model of models) {
      try {
        // Try streaming first.
        let yieldedAny = false
        const stream = await client.chat.completions.create(
          {
            model,
            messages: messages as never,
            stream: true,
          },
          signal ? { signal } : undefined
        )
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content
          if (delta) {
            yieldedAny = true
            yield delta
          }
        }
        if (yieldedAny) return // success
        // Stream yielded nothing — fall back to non-streaming for this model.
        const res = await client.chat.completions.create({
          model,
          messages: messages as never,
        })
        const text = res.choices[0]?.message?.content || ''
        if (text) {
          yield text
          return
        }
        // Nothing from this model either — try next.
        continue
      } catch (err: unknown) {
        lastErr = err
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('404') || msg.includes('does not exist') || msg.includes('403') || msg.includes('Forbidden') || msg.includes('400') || msg.includes('decommissioned') || msg.includes('deprecation')) {
          continue // try next model
        }
        throw err // other errors (auth, rate limit, etc.) — don't retry
      }
    }
    throw lastErr || new Error('All models failed')
  }

  // Sandbox path: z-ai SDK
  const zai = await getZai()
  const completion = await zai.chat.completions.create({
    messages: messages as never,
    thinking: { type: 'disabled' },
    stream: true,
  } as never)

  // The SDK returns a ReadableStream (SSE) when stream:true. Parse it.
  if (completion instanceof ReadableStream) {
    const reader = (completion as ReadableStream<Uint8Array>).getReader()
    const decoder = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() || ''
      for (const line of lines) {
        const t = line.trim()
        if (!t.startsWith('data:')) continue
        const json = t.slice(5).trim()
        if (json === '[DONE]') return
        try {
          const evt = JSON.parse(json)
          const delta = evt.choices?.[0]?.delta?.content
          if (delta) yield delta
        } catch {
          // skip malformed lines
        }
      }
    }
    return
  }

  // Fallback: non-streaming response object
  const text =
    (completion as { choices?: Array<{ message?: { content?: string } }> })
      .choices?.[0]?.message?.content || ''
  if (text) yield text
}

/**
 * Non-streaming chat completion (for lesson generation, exercises, reviews).
 * Returns the full text.
 */
export async function completeChat(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  if (shouldUsePublicAI()) {
    const client = getOpenAIClient()
    const models = getModelChain()
    let lastErr: unknown = null
    for (const model of models) {
      try {
        const res = await client.chat.completions.create({
          model,
          messages: messages as never,
        })
        return res.choices[0]?.message?.content || ''
      } catch (err: unknown) {
        lastErr = err
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('404') || msg.includes('does not exist') || msg.includes('403') || msg.includes('Forbidden') || msg.includes('400') || msg.includes('decommissioned') || msg.includes('deprecation')) {
          continue
        }
        throw err
      }
    }
    throw lastErr || new Error('All models failed')
  }

  const zai = await getZai()
  const completion = await zai.chat.completions.create({
    messages: messages as never,
    thinking: { type: 'disabled' },
  })
  return completion.choices[0]?.message?.content || ''
}
