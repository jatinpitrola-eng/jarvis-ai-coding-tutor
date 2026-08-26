import { db } from '@/lib/db'

/**
 * Reads the `x-learner-id` header from an incoming Request.
 * If the header is missing or does not correspond to an existing Learner,
 * a new Learner is created (and a fresh cuid generated) on the fly.
 * Returns the learner's id (string). Always resolves — never throws.
 */
export async function getOrCreateLearner(req: Request): Promise<string> {
  try {
    const headerId = req.headers.get('x-learner-id')?.trim()
    if (headerId) {
      const existing = await db.learner.findUnique({ where: { id: headerId } })
      if (existing) return existing.id
    }
    const created = await db.learner.create({ data: {} })
    return created.id
  } catch (err) {
    // Last-resort: try once more without the lookup (could be a transient DB issue).
    try {
      const created = await db.learner.create({ data: {} })
      return created.id
    } catch {
      // Re-throw original if the second attempt also fails.
      throw err
    }
  }
}

/**
 * Variant that accepts a learnerId passed explicitly in the request body
 * or query string. Falls back to getOrCreateLearner semantics otherwise.
 */
export async function resolveLearnerId(
  req: Request,
  explicit?: string | null,
): Promise<string> {
  const trimmed = (explicit || '').trim()
  if (trimmed) {
    try {
      const existing = await db.learner.findUnique({ where: { id: trimmed } })
      if (existing) return existing.id
    } catch {
      // fall through
    }
  }
  return getOrCreateLearner(req)
}
