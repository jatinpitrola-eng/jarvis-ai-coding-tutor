#!/usr/bin/env bash
# Local launcher that runs the app with the PRODUCTION env (Turso + Groq),
# exactly simulating how Vercel will run it. Used for testing only.
# DO NOT COMMIT the env values — they are gitignored in .env.prod-test.
set -a
. "$(dirname "$0")/../.env.prod-test"
set +a
cd /home/z/my-project
exec bun run dev
