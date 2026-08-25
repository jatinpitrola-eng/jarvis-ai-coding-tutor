import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getZai } from '@/lib/zai'

/**
 * GET /api/lessons/[id]?learnerId=<id>
 *
 * If lesson.content is empty, generate a beginner-friendly Markdown lesson
 * via the LLM and persist it to the DB.
 *
 * Returns: { lesson: { id, title, content, language, trackTitle } }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const url = new URL(req.url)
    const learnerIdQuery = url.searchParams.get('learnerId')?.trim() || ''

    const lesson = await db.lesson.findUnique({
      where: { id },
      include: { track: true },
    })
    if (!lesson) {
      return NextResponse.json(
        { error: 'Lesson not found' },
        { status: 404 },
      )
    }

    // Lazily generate content if empty.
    if (!lesson.content || lesson.content.trim() === '') {
      const generated = await generateLessonContent(
        lesson.title,
        lesson.track?.language || 'python',
        lesson.track?.title || '',
      )
      await db.lesson.update({
        where: { id: lesson.id },
        data: { content: generated, summary: extractSummary(generated) },
      })
      lesson.content = generated
      if (!lesson.summary) lesson.summary = extractSummary(generated)
    }

    // Optionally mark as in_progress for the learner (if supplied).
    if (learnerIdQuery) {
      try {
        const existing = await db.lessonProgress.findUnique({
          where: { learnerId_lessonId: { learnerId: learnerIdQuery, lessonId: lesson.id } },
        })
        if (!existing) {
          await db.lessonProgress.create({
            data: {
              learnerId: learnerIdQuery,
              lessonId: lesson.id,
              status: 'in_progress',
            },
          })
        }
      } catch {
        // Non-fatal: progress write is best-effort.
      }
    }

    return NextResponse.json({
      lesson: {
        id: lesson.id,
        title: lesson.title,
        content: lesson.content,
        summary: lesson.summary,
        language: lesson.track?.language || '',
        trackTitle: lesson.track?.title || '',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function generateLessonContent(
  lessonTitle: string,
  language: string,
  trackTitle: string,
): Promise<string> {
  const zai = await getZai()
  const system =
    "You are Jarvis, a friendly coding tutor. Write a beginner-friendly Markdown lesson. Use short paragraphs, an analogy, a fenced code block tagged with the language, and end with a 'Try this' section. Do not wrap the entire response in fences; output Markdown directly."
  const user =
    `Write a beginner coding lesson.\n\n` +
    `Track: ${trackTitle}\n` +
    `Language: ${language}\n` +
    `Lesson title: ${lessonTitle}\n\n` +
    `Structure the lesson in Markdown with:\n` +
    `1) A short intro paragraph.\n` +
    `2) An analogy that makes the concept click.\n` +
    `3) A small fenced code block (tagged with ${language}) showing a minimal example.\n` +
    `4) A brief explanation of the example.\n` +
    `5) A "## Try this" section with 1-2 small challenges the learner can attempt on their own.\n`

  const completion: any = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    thinking: { type: 'disabled' },
  } as any)

  const text: string =
    completion?.choices?.[0]?.message?.content ||
    `# ${lessonTitle}\n\nLesson content is unavailable right now. Please try again.`

  return text
}

function extractSummary(markdown: string): string {
  // First non-heading paragraph, truncated.
  const lines = markdown.split('\n')
  for (const line of lines) {
    const t = line.trim()
    if (!t || t.startsWith('#') || t.startsWith('```')) continue
    return t.slice(0, 140)
  }
  return ''
}
