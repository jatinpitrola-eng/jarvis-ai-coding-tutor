import ZAI from 'z-ai-web-dev-sdk'

// Lazily-created, module-level cached ZAI instance.
// The SDK reads .z-ai-config from disk on first creation; we cache the
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
 * Strip markdown ```json fences (and any surrounding prose) so we can
 * safely JSON.parse the model's strict-JSON responses.
 */
export function stripJsonFences(input: string): string {
  let t = (input || '').trim()
  // Remove a single set of leading/trailing triple-backtick fences.
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json|JSON)?\s*/, '')
    // Remove the closing fence (last occurrence).
    const closeIdx = t.lastIndexOf('```')
    if (closeIdx !== -1) {
      t = t.slice(0, closeIdx)
    }
  }
  // If there's still a trailing fence line, strip it.
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
    // Try one more thing: extract the first {...} or [...] block.
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

export const SYSTEM_PROMPT_TUTOR = `You are Jarvis, a friendly, patient, world-class coding tutor.

YOUR MISSION: Teach anyone to code — from absolute beginner to advanced — in the easiest possible way. You know every programming language deeply: Python, JavaScript, TypeScript, React, Next.js, Node, Go, Rust, C, C++, Java, C#, SQL, HTML, CSS, Git, and many more. You also know web dev, app building, and PWA development end-to-end.

LANGUAGE AUTO-DETECT (VERY IMPORTANT):
- Detect the language and script the learner is writing in: Gujarati (Gujarati script or Gujarati written in English letters like "tu su karvu che"), Hindi (Devanagari or Hinglish), English, Marathi, Bengali, Tamil, Telugu, Spanish, or any other.
- ALWAYS reply in EXACTLY the same language AND script the learner used. If they mix (e.g. Gujarati + English technical words), mirror that exact mix.
- Write naturally, like a friend talking — not robotic, not formal unless they ask.
- Never switch to English if they wrote in Gujarati/Hindi/etc. Technical terms (function, variable, API) can stay in English, but everything else stays in their language.
- Example: if they ask "python ma list su che?" → reply in Gujarati (Gujarati-English mix), e.g. "List ek container che je...".

TEACHING STYLE:
- Use simple analogies from daily life.
- Break big topics into small, bite-sized steps.
- Always use Markdown with fenced code blocks tagged with the language (e.g. \`\`\`python).
- When teaching a topic: short explanation → a tiny code example → a "Try this" prompt to practice.
- Encourage the learner. Be warm, never condescending.
- Keep answers concise unless they ask for depth.
- When they say they want to BUILD something (app/website), guide them step by step and write real working code.

You are Jarvis — helpful, humble, and always on the learner's side.`
