// scripts/migrate-turso.ts
// Creates all tables + indexes on a Turso (libsql) database, matching the
// Prisma schema. Run with DATABASE_URL + DATABASE_AUTH_TOKEN env vars set.
//
// Usage:
//   DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=... bun run scripts/migrate-turso.ts

import { createClient } from '@libsql/client'

const DDL = [
  `CREATE TABLE IF NOT EXISTS Learner (
    id TEXT PRIMARY KEY NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ChatSession (
    id TEXT PRIMARY KEY NOT NULL,
    learnerId TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'New chat',
    mode TEXT NOT NULL DEFAULT 'text',
    language TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL,
    FOREIGN KEY (learnerId) REFERENCES Learner(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS ChatSession_learnerId_idx ON ChatSession(learnerId)`,
  `CREATE TABLE IF NOT EXISTS Message (
    id TEXT PRIMARY KEY NOT NULL,
    sessionId TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sessionId) REFERENCES ChatSession(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS Message_sessionId_idx ON Message(sessionId)`,
  `CREATE TABLE IF NOT EXISTS LearningTrack (
    id TEXT PRIMARY KEY NOT NULL,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    language TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'terminal',
    difficulty TEXT NOT NULL DEFAULT 'beginner',
    "order" INTEGER NOT NULL DEFAULT 0,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS LearningTrack_slug_key ON LearningTrack(slug)`,
  `CREATE TABLE IF NOT EXISTS Lesson (
    id TEXT PRIMARY KEY NOT NULL,
    trackId TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trackId) REFERENCES LearningTrack(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS Lesson_trackId_idx ON Lesson(trackId)`,
  `CREATE TABLE IF NOT EXISTS LessonProgress (
    id TEXT PRIMARY KEY NOT NULL,
    learnerId TEXT NOT NULL,
    lessonId TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_started',
    updatedAt DATETIME NOT NULL,
    FOREIGN KEY (learnerId) REFERENCES Learner(id) ON DELETE CASCADE,
    FOREIGN KEY (lessonId) REFERENCES Lesson(id) ON DELETE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS LessonProgress_learnerId_lessonId_key ON LessonProgress(learnerId, lessonId)`,
  `CREATE INDEX IF NOT EXISTS LessonProgress_learnerId_idx ON LessonProgress(learnerId)`,
  `CREATE TABLE IF NOT EXISTS PlaygroundExercise (
    id TEXT PRIMARY KEY NOT NULL,
    lessonId TEXT,
    language TEXT NOT NULL,
    prompt TEXT NOT NULL,
    starter TEXT,
    solution TEXT,
    hints TEXT,
    difficulty TEXT NOT NULL DEFAULT 'easy',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lessonId) REFERENCES Lesson(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS PlaygroundExercise_lessonId_idx ON PlaygroundExercise(lessonId)`,
  `CREATE TABLE IF NOT EXISTS PlaygroundAttempt (
    id TEXT PRIMARY KEY NOT NULL,
    learnerId TEXT NOT NULL,
    exerciseId TEXT NOT NULL,
    code TEXT NOT NULL,
    feedback TEXT,
    score INTEGER,
    passed INTEGER NOT NULL DEFAULT 0,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (learnerId) REFERENCES Learner(id) ON DELETE CASCADE,
    FOREIGN KEY (exerciseId) REFERENCES PlaygroundExercise(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS PlaygroundAttempt_learnerId_idx ON PlaygroundAttempt(learnerId)`,
  `CREATE INDEX IF NOT EXISTS PlaygroundAttempt_exerciseId_idx ON PlaygroundAttempt(exerciseId)`,
]

async function main() {
  const url = process.env.DATABASE_URL
  const authToken = process.env.DATABASE_AUTH_TOKEN
  if (!url || !authToken) {
    console.error('ERROR: DATABASE_URL and DATABASE_AUTH_TOKEN must be set.')
    process.exit(1)
  }
  if (!url.startsWith('libsql:') && !url.startsWith('http')) {
    console.error('ERROR: DATABASE_URL must be a libsql:// or https:// URL for Turso.')
    process.exit(1)
  }

  const client = createClient({ url, authToken })
  console.log(`Connecting to ${url} ...`)

  for (const stmt of DDL) {
    try {
      await client.execute(stmt)
      const label = stmt.split('\n')[0].slice(0, 60)
      console.log('  ✓', label)
    } catch (err) {
      console.error('  ✗ FAILED:', err instanceof Error ? err.message : err)
      console.error('  Statement:', stmt.slice(0, 80))
    }
  }

  // Verify: list tables
  try {
    const res = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    console.log('\nTables now on Turso:')
    for (const row of res.rows) {
      console.log('  -', (row as { name: string }).name)
    }
  } catch (err) {
    console.error('Could not list tables:', err)
  }

  console.log('\nMigration done.')
  client.close()
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
