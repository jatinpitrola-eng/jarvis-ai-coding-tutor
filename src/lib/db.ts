import { createClient, type Client } from '@libsql/client'
import { randomBytes } from 'crypto'

// Lightweight DB wrapper using @libsql/client.
// Works with local file: URLs (sandbox) AND remote libsql:// Turso URLs (Vercel).
// Provides a Prisma-like API for simple CRUD operations.

function createDbClient(): Client {
  const url = process.env.DATABASE_URL || 'file:./db/custom.db'
  const authToken = process.env.DATABASE_AUTH_TOKEN || undefined
  return createClient({ url, authToken })
}

const client = createDbClient()

function cuid(): string {
  return 'c' + Date.now().toString(36) + randomBytes(8).toString('hex')
}

function now(): string {
  return new Date().toISOString()
}

// Generic query helpers
export const raw = {
  async query(sql: string, args: unknown[] = []) {
    const res = await client.execute({ sql, args: args as never })
    return res.rows
  },
  async execute(sql: string, args: unknown[] = []) {
    const res = await client.execute({ sql, args: args as never })
    return { rowsAffected: res.rowsAffected, lastInsertRowid: res.lastInsertRowid }
  },
  async queryOne(sql: string, args: unknown[] = []) {
    const rows = await this.query(sql, args)
    return rows[0] || null
  },
}

// Helpers
function esc(s: string): string {
  return `"${s.replace(/"/g, '""')}"`
}

function whereClause(where: Record<string, unknown>): { clause: string; args: unknown[] } {
  const keys = Object.keys(where)
  if (keys.length === 0) return { clause: '', args: [] }
  const parts = keys.map((k) => `${esc(k)} = ?`)
  return { clause: 'WHERE ' + parts.join(' AND '), args: keys.map((k) => where[k]) }
}

// ---- Model builders ----

interface FindOptions {
  where?: Record<string, unknown>
  orderBy?: Record<string, 'asc' | 'desc'>
  take?: number
  select?: Record<string, boolean>
}

interface CreateOptions {
  data: Record<string, unknown> & { _nested?: Record<string, unknown> }
}

interface UpdateOptions {
  where: Record<string, unknown>
  data: Record<string, unknown>
}

interface UpsertOptions {
  where: Record<string, unknown>
  create: Record<string, unknown>
  update: Record<string, unknown>
}

function makeModel(table: string) {
  return {
    async findUnique({ where }: { where: Record<string, unknown> }) {
      const { clause, args } = whereClause(where)
      const rows = await raw.query(`SELECT * FROM ${esc(table)} ${clause} LIMIT 1`, args)
      return rows[0] || null
    },

    async findMany(opts: FindOptions = {}) {
      let sql = `SELECT * FROM ${esc(table)}`
      const args: unknown[] = []
      if (opts.where) {
        const w = whereClause(opts.where)
        sql += ' ' + w.clause
        args.push(...w.args)
      }
      if (opts.orderBy) {
        const orderParts = Object.entries(opts.orderBy).map(
          ([k, dir]) => `${esc(k)} ${dir.toUpperCase()}`
        )
        sql += ' ORDER BY ' + orderParts.join(', ')
      }
      if (opts.take) {
        sql += ` LIMIT ${opts.take}`
      }
      const rows = await raw.query(sql, args)
      return rows
    },

    async create(opts: CreateOptions) {
      const { _nested, ...data } = opts.data
      if (!data.id) data.id = cuid()
      if (!data.createdAt) data.createdAt = now()
      if (table === 'Learner' || table === 'ChatSession') {
        if (!data.updatedAt) data.updatedAt = now()
      }
      const keys = Object.keys(data)
      const placeholders = keys.map(() => '?').join(', ')
      const values = keys.map((k) => data[k])
      const res = await raw.execute(
        `INSERT INTO ${esc(table)} (${keys.map(esc).join(', ')}) VALUES (${placeholders})`,
        values
      )
      // Return the created row
      const row = await raw.queryOne(`SELECT * FROM ${esc(table)} WHERE id = ?`, [data.id])
      // Attach the insert result for nested writes
      return row || { ...data }
    },

    async update(opts: UpdateOptions) {
      const { where, data } = opts
      if (table === 'Learner' || table === 'ChatSession') {
        if (!data.updatedAt) data.updatedAt = now()
      }
      const setParts = Object.keys(data).map((k) => `${esc(k)} = ?`)
      const setArgs = Object.values(data)
      const w = whereClause(where)
      await raw.execute(
        `UPDATE ${esc(table)} SET ${setParts.join(', ')} ${w.clause}`,
        [...setArgs, ...w.args]
      )
      // Return the updated row
      const whereKey = Object.keys(where)[0]
      const whereVal = where[whereKey]
      return await raw.queryOne(`SELECT * FROM ${esc(table)} WHERE ${esc(whereKey)} = ?`, [whereVal])
    },

    async delete({ where }: { where: Record<string, unknown> }) {
      const w = whereClause(where)
      await raw.execute(`DELETE FROM ${esc(table)} ${w.clause}`, w.args)
      return { success: true }
    },

    async count(opts: { where?: Record<string, unknown> } = {}) {
      let sql = `SELECT COUNT(*) as c FROM ${esc(table)}`
      const args: unknown[] = []
      if (opts.where) {
        const w = whereClause(opts.where)
        sql += ' ' + w.clause
        args.push(...w.args)
      }
      const row = await raw.queryOne(sql, args)
      return Number((row as { c: number | string })?.c || 0)
    },

    async upsert(opts: UpsertOptions) {
      const existing = await this.findUnique({ where: opts.where })
      if (existing) {
        return await this.update({ where: opts.where, data: opts.update })
      }
      return await this.create({ data: { ...opts.create, ...opts.where } })
    },
  }
}

// ---- Transaction (simplified — just runs sequentially) ----
function transaction(operations: Array<Promise<unknown>>): Promise<unknown[]> {
  return Promise.all(operations)
}

// ---- Export the Prisma-like db object ----
export const db = {
  learner: makeModel('Learner'),
  chatSession: makeModel('ChatSession'),
  message: makeModel('Message'),
  learningTrack: makeModel('LearningTrack'),
  lesson: makeModel('Lesson'),
  lessonProgress: makeModel('LessonProgress'),
  playgroundExercise: makeModel('PlaygroundExercise'),
  playgroundAttempt: makeModel('PlaygroundAttempt'),
  $transaction: transaction,
}
