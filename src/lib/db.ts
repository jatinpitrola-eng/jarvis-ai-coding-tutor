import { PrismaClient } from '@prisma/client'
import { createClient } from '@libsql/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

// Database client setup.
// - Local file SQLite (sandbox, DATABASE_URL=file:...) → plain PrismaClient (native sqlite).
// - Remote Turso (DATABASE_URL=libsql://...) → PrismaClient + libsql driver adapter.
// This way the sandbox keeps working with a local file, and Vercel uses Turso.

function createPrismaClient() {
  const url = process.env.DATABASE_URL || 'file:./db/custom.db'
  const isTurso =
    url.startsWith('libsql:') || url.startsWith('https:') || url.startsWith('http:')

  if (isTurso) {
    const authToken = process.env.DATABASE_AUTH_TOKEN || undefined
    const libsql = createClient({ url, authToken })
    const adapter = new PrismaLibSQL(libsql)
    return new PrismaClient({ adapter, log: ['error', 'warn'] })
  }

  // Local SQLite file: plain PrismaClient with native sqlite provider.
  return new PrismaClient({ log: ['error', 'warn'] })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
