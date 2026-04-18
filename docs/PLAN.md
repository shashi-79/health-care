# Project Plan (Synced With Migrated Demo UI)

## Objective

Use the migrated prototype UI as the functional baseline, then progressively replace mock behavior with modular backend lanes while preserving current UX flows.

## Current migration status

1. Prototype assets are stored at `apps/web/public/demo-ui`.
1. Next app shell mounts the prototype directly through an app host component (no iframe fallback).
1. Modular monorepo scaffold and API placeholders are present.

## UI sync matrix (prototype -> module/route)

1. Chat view (`message-container`, `chat-input`, send/mic toggle) -> Route: `POST /api/chat`; Modules: `packages/agents`, `packages/ingest`, `packages/safety`, `packages/rag`; Replace: direct DOM append in `app.js` with backend response stream.
1. Attachment sheet (`handleFileSelect` camera/gallery/document flow) -> Route: `POST /api/ingest/upload`; Modules: `packages/ingest`, `packages/tools`, `packages/medical`; Replace: mock upload notices with persisted file refs and ingest normalization.
1. Document viewer (`openDocument` split panel) -> Routes: `POST /api/bg/run`, `POST /api/bg/consolidate`; Modules: `packages/tools` (`ingest_document`), `packages/reporting`; Replace: static extracted table with BG-generated summary from uploaded docs.
1. Calling view (`startCall`, `answerCall`, `endCall`, timer flow) -> Route: `POST /api/call/init`; Modules: `packages/ai` (`gemini-live-client`), `packages/agents` (call lane); Replace: mock ringing/timer-only flow with real Gemini Live session state.
1. Calendar + Add Schedule popup (`openCalendar` and `saveSchedule`) -> Route: `POST /api/scheduler/tick`; Modules: `packages/scheduler`, `packages/tools`; Replace: toast-only save with BG-created scheduled job and status refresh.
1. Call history/profile/media views -> Route: `GET/PATCH /api/memory`; Modules: `packages/db`, `packages/rag`; Replace: in-memory arrays with persisted UI transcript + isolated RAG snapshot.

## Runtime lanes (locked)

1. Chat/text runtime lane: OpenRouter GPT (`CHAT_MODEL`).
1. BG orchestration runtime lane: OpenRouter Claude Sonnet (`BG_MODEL`).
1. Live call runtime lane: Gemini Live only (`NEXT_PUBLIC_CALL_MODEL`).
1. Medical data source: openFDA.

## Implementation phases

### Phase 1: Stabilize migrated UI baseline

1. Keep `/demo-ui/index.html` as the source template for direct host rendering.
1. Introduce typed event bridge from mounted prototype UI -> Next route calls.
1. Preserve all visible interactions while swapping data sources behind the scenes.

### Phase 2: Replace chat mocks with real backend

1. Wire send button and mic flow to `POST /api/chat`.
1. Run input through `packages/ingest` (`text|audio|document|image`).
1. Enforce triage preflight and emergency short-circuit in route.

### Phase 3: Replace memory and history mocks

1. Persist UI transcript to `ui_messages` via `/api/memory`.
1. Persist AI memory in vectorless RAG tables only.
1. Ensure agents cannot import/read UI transcript module directly.

### Phase 4: Replace call mocks with Gemini Live

1. Use `/api/call/init` for session config.
1. Start browser-side Gemini Live session.
1. Add side-channel `/api/bg/delegate` for lookup assistance during call.

### Phase 5: Scheduler and docs

1. Convert calendar save to scheduler job creation.
1. Add BG-triggered follow-up tasks and report generation.
1. Replace static document analysis panel with tool-backed summary.

## Contract checklist

1. Every route returns structured JSON with `ok`, `route`, `status`.
1. `chat` responses include message array + triage + memory delta.
1. `memory` route keeps UI transcript and RAG memory separated.
1. `call/init` never returns long-lived server secrets.
1. `scheduler/tick` is idempotent for repeated ticks.

## Safety checklist

1. Emergency signal -> immediate escalation template.
1. No dosage instructions in assistant output.
1. No diagnosis certainty claims.
1. No unnecessary PII in logs.
1. Audit trail for safety interventions and triage route decisions.

## Verification checkpoints

1. UI parity: all original prototype interactions still function.
1. Route parity: placeholders replaced one-by-one without regression.
1. Model-routing parity: no Gemini in chat route, no GPT/Sonnet in live call stream.
1. Data isolation: full transcript available for UI only, not default AI context.
1. Demo path: text, audio, document, call, schedule, emergency escalation.
1. Host integrity: page renders without iframe and still loads migrated prototype scripts/styles correctly.
