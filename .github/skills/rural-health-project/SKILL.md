---
name: rural-health-project
description: Create, plan, and implement this rural healthcare copilot in modular npm-workspaces architecture with strict model-routing and safety constraints.
argument-hint: Describe feature or planning task to execute in this project.
---

Use this skill for project-specific planning and implementation.

## Project defaults
- Monorepo: npm workspaces
- UI/App: Next.js App Router + Tailwind + shadcn
- DB: Postgres in Docker Compose
- AI: OpenRouter backend, Gemini Live browser call mode, openFDA backend

## Model-selection rule
- For this skill authoring workflow: use GPT-5.3-Codex for nearly all tasks.
- Use OpenRouter Claude Sonnet only for rare top-level deep planning tasks.
- Restrict Sonnet invocations and avoid repeated loops.

## Runtime model-selection rule (project, keep unchanged)
- Chat/text runtime lane: OpenRouter GPT via `CHAT_MODEL`.
- BG/tool orchestration runtime lane: OpenRouter Claude Sonnet via `BG_MODEL`.
- Call runtime lane: Gemini Live only via `NEXT_PUBLIC_CALL_MODEL`.
- Do not replace these runtime routes unless explicitly requested.

## Required architecture rules
1. Chat/text routes must not use Gemini Live.
2. Call routes must use Gemini Live only.
3. Tool calls must be centralized in BG agent lane.
4. AI memory context must come from vectorless structured RAG.
5. Full transcript storage is UI-facing and isolated from AI context.

## Execution pattern
1. Confirm scope and impacted packages.
2. Freeze contracts and routing guards.
3. Implement in modular packages.
4. Add tests for triage, routing, safety, and persistence.
5. Verify with scenario-based API demo script.

## Outputs expected from this skill
- Phased implementation plan with dependencies.
- File-level change map.
- Safety and verification checklist.
- Explicit assumptions and residual risks.
