import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { completeChat, stripJsonFences, tryParseJson } from '@/lib/zai'

/**
 * POST /api/playground/review
 * Body: { exerciseId, code, learnerId }
 *
 * Loads the exercise (which has a reference solution), calls the LLM to
 * review the learner's code, returns strict JSON:
 *   { feedback, score, passed }
 * Persists a PlaygroundAttempt.
 *
 * Returns: { feedback, score, passed }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any))
    const exerciseId = (body?.exerciseId || '').toString().trim()
    const code = (body?.code || '').toString()
    const learnerId = (body?.learnerId || '').toString().trim()

    if (!exerciseId) {
      return NextResponse.json(
        { error: 'exerciseId is required' },
        { status: 400 },
      )
    }
    if (!code.trim()) {
      return NextResponse.json(
        { error: 'code is required' },
        { status: 400 },
      )
    }

    const exercise = await db.playgroundExercise.findUnique({
      where: { id: exerciseId },
    })
    if (!exercise) {
      return NextResponse.json(
        { error: 'Exercise not found' },
        { status: 404 },
      )
    }

    // Resolve a learner id (create on the fly if missing).
    let resolvedLearnerId = learnerId
    if (!resolvedLearnerId) {
      const created = await db.learner.create({ data: {} })
      resolvedLearnerId = created.id
    } else {
      const exists = await db.learner
        .findUnique({ where: { id: resolvedLearnerId }, select: { id: true } })
        .catch(() => null)
      if (!exists) {
        const created = await db.learner.create({ data: { id: resolvedLearnerId } })
        resolvedLearnerId = created.id
      }
    }

    const review = await generateReview(
      exercise.prompt,
      exercise.starter || '',
      exercise.solution || '',
      exercise.language,
      code,
    )

    await db.playgroundAttempt.create({
      data: {
        learnerId: resolvedLearnerId,
        exerciseId,
        code,
        feedback: review.feedback,
        score: review.score,
        passed: review.passed,
      },
    })

    return NextResponse.json({
      feedback: review.feedback,
      score: review.score,
      passed: review.passed,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

interface ReviewJson {
  feedback: string
  score: number
  passed: boolean
}

async function generateReview(
  prompt: string,
  starter: string,
  solution: string,
  language: string,
  code: string,
): Promise<ReviewJson> {
  const system =
    'You are Jarvis, a patient code reviewer for beginners. ' +
    'You ALWAYS respond with ONLY valid JSON — no markdown fences, no prose. ' +
    'The JSON must have exactly these keys: feedback (a Markdown string), score (integer 0-100), passed (boolean).'

  const user =
    `Review the learner's ${language} code against the exercise.\n\n` +
    `## Exercise prompt\n${prompt}\n\n` +
    `## Reference solution (hidden from learner — use only to judge correctness)\n\`\`\`${language}\n${solution}\n\`\`\`\n\n` +
    `## Learner's submitted code\n\`\`\`${language}\n${code || '(empty)'}\n\`\`\`\n\n` +
    `Return STRICT JSON with this exact shape:\n` +
    `{\n` +
    `  "feedback": "Markdown feedback. Start with a one-line verdict, then 2-4 short bullet points of what's good and what to improve. Be encouraging.",\n` +
    `  "score": <integer 0-100>,\n` +
    `  "passed": <true if score >= 60, else false>\n` +
    `}\n\n` +
    `Respond with ONLY the JSON object. No markdown fences. No prose.`

  const first = await callLlmJson(system, user)
  if (first) return normalizeReview(first)

  const retry = await callLlmJson(
    system,
    user + '\n\nREMINDER: Return ONLY valid JSON. No backticks. No prose.',
  )
  if (retry) return normalizeReview(retry)

  throw new Error('Failed to generate a valid review (JSON parse failed twice).')
}

async function callLlmJson(
  system: string,
  user: string,
): Promise<unknown | null> {
  const raw = await completeChat([
    { role: 'system', content: system },
    { role: 'user', content: user },
  ])
  const stripped = stripJsonFences(raw)
  return tryParseJson(stripped)
}

function normalizeReview(raw: unknown): ReviewJson {
  const obj = (raw || {}) as Record<string, unknown>
  const feedback =
    typeof obj.feedback === 'string' ? obj.feedback : String(obj.feedback || '')
  let score = Number(obj.score)
  if (!Number.isFinite(score)) score = 0
  score = Math.max(0, Math.min(100, Math.round(score)))
  let passed = obj.passed
  if (typeof passed !== 'boolean') {
    // Accept truthy strings/numbers; default to score-based judgment.
    passed = passed === 'true' || passed === 1 || passed === '1' || score >= 60
  }
  return { feedback, score, passed: Boolean(passed) }
}
