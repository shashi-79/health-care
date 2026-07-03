# Rural Health Copilot

An AI-powered telemedicine web platform designed to provide medical insights, automated background triage, FDA-verified dosage lookup, and live multilingual voice assistant features natively running through the browser.

## Architecture

This is a monorepo workspace powered by Node/NPM.

- **`@rhc/web`**: The main Next.js web application encompassing the UI and Backend API.
- **`@rhc/agents`**: The orchestration logic encapsulating the Chat Agent, Call Agent, and Background Medical Analysis Agent.
- **`@rhc/tools`**: Shared utility logic for text and markdown display.
- **Background Worker**: An asynchronous worker that processes medical analysis queries via the `BgAgent` in-process to prevent UI blocking.

## Prerequisites

- Node.js (v18+ recommended)
- `npm`

## Environment Setup

You need to configure the environment variables required by the various LLM clients before running the application.

1. Navigate to the `apps/web` directory (or wherever your `.env` is typically kept).
2. Ensure you have the following keys ready:
   - `NEXT_PUBLIC_GEMINI_API_KEY`: API Key for Google Gemini (Used for the Gemini Live Audio voice engine).
   - `OPENROUTER_API_KEY`: API Key for OpenRouter (Used for all LLM medical background, NLP triage, and orchestrator features).
   - _Optional:_ `NEXT_PUBLIC_CALL_MODEL`: E.g., `gemini-2.5-flash-native-audio-preview-12-2025`

## 🚀 Running the Project

### 1. Install Dependencies

From the root of the repository, execute:

```bash
npm install
```

### 2. Start the Development Server

This boots up the Next.js web application for the UI and background queue runner:

```bash
npm run dev
```

## Available Scripts

You can execute the following commands from the project root:

- `npm run dev`: Starts the Next.js development server.
- `npm run build`: Compiles all packages and workspaces to `/dist` and `/out`.
- `npm run typecheck`: Runs typescript validation across the entire workspace.
- `npm run lint`: Analyzes the `@rhc/web` workspace using ESLint.

## Workflow Integration Hints

- **Audio Calls**: Use the Call logo in the Chat layout to test Gemini Live Voice features.
- **Background Medical Fetching**: To observe FDA lookups, type out or say a symptom (like "headache"). The orchestrator automatically invokes the background worker asynchronously to fetch precise low-dosage instructions directly into the chat while keeping your conversational stream intact.
