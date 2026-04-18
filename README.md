# Rural Healthcare Copilot

This repository is an npm-workspaces monorepo for a modular healthcare assistant.

## Stack
- Next.js App Router + Tailwind + shadcn (UI/app shell)
- Dockerized Postgres
- OpenRouter via OpenAI SDK (project runtime: chat GPT, BG Sonnet)
- Gemini Live via @google/genai (call mode)
- openFDA integration

## Quick start
1. Copy .env.example to .env.local and fill secrets.
2. Start Postgres: npm run db:up
3. Install deps: npm install
4. Run app: npm run dev

## Runtime model routing (project rule)
- Chat/text lane: OpenRouter GPT via CHAT_MODEL.
- BG tool-orchestration lane: OpenRouter Claude Sonnet via BG_MODEL.
- Call lane: Gemini Live via NEXT_PUBLIC_CALL_MODEL.
