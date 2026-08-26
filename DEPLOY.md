# Jarvis — AI Coding Tutor (PWA)

An AI coding tutor you can chat with, talk to (voice), learn from (15 tracks), and practice with (playground). Built by **Jatin Pitroda**.

## Deploy to Vercel (free, ~10 minutes)

The app is **Vercel-ready**. It auto-switches between the sandbox AI backend (z-ai SDK) and any public OpenAI-compatible API (Groq/OpenAI) based on env vars.

### What you need (all free)

1. **Groq API key** (free, for AI chat) — https://console.groq.com/keys
2. **Turso database** (free, networked SQLite that works on serverless) — https://turso.tech

### Steps

#### 1. Create a Turso database
```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Sign up + create a DB
turso auth signup
turso db create jarvis
turso db show jarvis --url      # → copy this URL (libsql://...)
turso db tokens create jarvis    # → copy this token
```

#### 2. Create a GitHub repo + push this code
```bash
# In the project folder:
git remote add origin https://github.com/<your-username>/jarvis.git
git push -u origin main
```

#### 3. Import to Vercel
- Go to https://vercel.com/new
- Import your `jarvis` GitHub repo
- Framework preset: **Next.js** (auto-detected)
- Build command is already set in `vercel.json` (`prisma generate && next build`)

#### 4. Add Environment Variables in Vercel
Go to Project → Settings → Environment Variables, add these 4:

| Name | Value |
|---|---|
| `DATABASE_URL` | `libsql://jarvis-xxxx.turso.io` (from step 1) |
| `DATABASE_AUTH_TOKEN` | your Turso token (from step 1) |
| `AI_API_KEY` | `gsk_xxx` (your Groq key) |
| `AI_BASE_URL` | `https://api.groq.com/openai/v1` |
| `AI_MODEL` | `llama-3.3-70b-versatile` |

#### 5. Deploy + push the schema
After the first deploy, run this once to create the DB tables on Turso:
```bash
turso db shell jarvis < prisma/migrations.sql
```
(Or simpler: the app auto-seeds tracks on first `/api/tracks` call. For other tables, run `DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=... bunx prisma db push`.)

#### 6. Your live link!
Vercel gives you `https://jarvis-xxx.vercel.app` — share it. ✅

### Notes

- **Voice (TTS/ASR):** Uses the browser's built-in Web Speech API — **no server keys needed**. Works on Chrome/Edge/Safari. (Voice quality depends on the browser's installed voices.)
- **Sandbox vs Vercel:** In the sandbox, the app uses the internal z-ai SDK (no key needed). On Vercel, it uses Groq (set `AI_API_KEY`). The same code handles both — it checks env vars.
- **DB:** Local dev uses a SQLite file (`DATABASE_URL=file:./db/custom.db`). Vercel uses Turso (networked SQLite, free tier). Same Prisma schema, same code.

## Local development
```bash
bun install
bun run db:push    # creates the local SQLite file
bun run dev        # http://localhost:3000
```

## Features
- 💬 **Chat** — streaming AI tutor, Eng-Guj auto-detect, code blocks with copy
- 🎙️ **Voice** — ChatGpt-style continuous voice-to-voice (browser Web Speech API)
- 📚 **Learn** — 15 tracks (Python, JS, TS, React, Node, HTML/CSS, SQL, C, C++, Java, C#, Go, Rust, Git, Bash)
- 🎮 **Playground** — AI-generated exercises + code review with score (17 languages)
- 📱 **PWA** — installable, offline-ish (service worker + manifest)

## Made by Jatin Pitroda
