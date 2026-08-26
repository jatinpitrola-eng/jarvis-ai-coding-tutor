import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { completeChat, stripJsonFences, tryParseJson } from '@/lib/zai'

/**
 * POST /api/playground/exercise
 * Body: { language, difficulty, topic, learnerId }
 *
 * Calls the LLM with a strict-JSON instruction to produce:
 *   { prompt, starter, solution, hints[], difficulty }
 * Persists a PlaygroundExercise and returns it WITHOUT `solution`.
 *
 * Returns:
 *   { exercise: { id, language, prompt, starter, hints[], difficulty } }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any))
    const language = (body?.language || 'python').toString().trim()
    const difficultyRaw = (body?.difficulty || 'easy').toString().trim().toLowerCase()
    const topic = body?.topic ? body.topic.toString().trim() : null
    const learnerId = (body?.learnerId || '').toString().trim()

    const allowedDifficulties = ['easy', 'medium', 'hard']
    const difficulty = allowedDifficulties.includes(difficultyRaw)
      ? difficultyRaw
      : 'easy'

    if (!language) {
      return NextResponse.json(
        { error: 'language is required' },
        { status: 400 },
      )
    }

    // Resolve learner if provided (best-effort, not required).
    let resolvedLearnerId = learnerId
    if (!resolvedLearnerId) {
      // Not required for exercise creation, but we can't infer one here.
      resolvedLearnerId = ''
    } else {
      const exists = await db.learner
        .findUnique({ where: { id: resolvedLearnerId }, select: { id: true } })
        .catch(() => null)
      if (!exists) resolvedLearnerId = ''
    }

    const generated = await generateExercise(language, difficulty, topic)

    const hintsJson = JSON.stringify(generated.hints || [])
    const exercise = await db.playgroundExercise.create({
      data: {
        language,
        prompt: generated.prompt,
        starter: generated.starter || '',
        solution: generated.solution || '',
        hints: hintsJson,
        difficulty: generated.difficulty || difficulty,
      },
    })

    return NextResponse.json({
      exercise: {
        id: exercise.id,
        language: exercise.language,
        prompt: exercise.prompt,
        starter: exercise.starter,
        hints: generated.hints || [],
        difficulty: exercise.difficulty,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

interface ExerciseJson {
  prompt: string
  starter: string
  solution: string
  hints: string[]
  difficulty: string
}

async function generateExercise(
  language: string,
  difficulty: string,
  topic: string | null,
): Promise<ExerciseJson> {
  const system =
    'You are Jarvis, an expert at designing small, focused coding exercises for beginners. ' +
    'You ALWAYS respond with ONLY valid JSON — no markdown fences, no prose, no commentary. ' +
    'The JSON must have exactly these keys: prompt, starter, solution, hints, difficulty.'

  const topicLine = topic
    ? `The exercise topic should focus on: ${topic}.`
    : 'Pick any reasonable beginner topic for the chosen language.'

  const user =
    `Design a ${difficulty} coding exercise in ${language}.\n` +
    `${topicLine}\n\n` +
    `Return STRICT JSON with this exact shape:\n` +
    `{\n` +
    `  "prompt": "A clear, beginner-friendly description of the task (1-3 sentences, in Markdown).",\n` +
    `  "starter": "Starter code the learner will see in the editor. Include a comment describing what to fill in.",\n` +
    `  "solution": "A correct reference solution. This will NOT be shown to the learner.",\n` +
    `  "hints": ["Hint 1 (subtle)", "Hint 2 (more direct)", "Hint 3 (almost the answer)"],\n` +
    `  "difficulty": "${difficulty}"\n` +
    `}\n\n` +
    `Respond with ONLY the JSON object. No markdown fences. No prose.`

  const first = await callLlmJson(system, user)
  if (first) return normalizeExercise(first, difficulty)

  // Retry once with a stronger reminder.
  const retry = await callLlmJson(
    system,
    user + '\n\nREMINDER: Return ONLY valid JSON. No backticks. No prose.',
  )
  if (retry) return normalizeExercise(retry, difficulty)

  throw new Error('Failed to generate a valid exercise (JSON parse failed twice).')
}

async function callLlmJson(
  system: string,
  user: string,
): Promise<unknown | null> {
  const raw = await completeChat([
    { role: 'system', content: system },
    { role: 'user', content: user },
  ])
  // Defensively strip fences before parsing.
  const stripped = stripJsonFences(raw)
  const parsed = tryParseJson(stripped)
  return parsed
}

function normalizeExercise(raw: unknown, fallbackDifficulty: string): ExerciseJson {
  const obj = (raw || {}) as Record<string, unknown>
  const prompt = typeof obj.prompt === 'string' ? obj.prompt : String(obj.prompt || '')
  const starter = typeof obj.starter === 'string' ? obj.starter : String(obj.starter || '')
  const solution = typeof obj.solution === 'string' ? obj.solution : String(obj.solution || '')
  const hintsRaw = obj.hints
  const hints: string[] = Array.isArray(hintsRaw)
    ? hintsRaw.map((h) => String(h)).filter(Boolean)
    : typeof hintsRaw === 'string'
      ? (() => {
          try {
            const p = JSON.parse(hintsRaw)
            return Array.isArray(p) ? p.map((h) => String(h)) : [hintsRaw]
          } catch {
            return [hintsRaw]
          }
        })()
      : []
  const difficulty = typeof obj.difficulty === 'string' ? obj.difficulty : fallbackDifficulty
  return { prompt, starter, solution, hints, difficulty }
}
