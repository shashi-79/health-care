import { runBgAgent } from "@rhc/agents/bg-agent";
import { listUiMessages } from "@rhc/db/index";
import { logEvent } from "@rhc/obs/index";
import { buildMemoryContext, getSessionMemory, patchSessionMemory } from "@rhc/rag/index";
import type { BgPromptMessage } from "@rhc/types/index";
import type { LoopState } from "@rhc/agents/loop-guard";
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_BG_MODEL = "anthropic/claude-haiku-4.5";

type BgRunRequestBody = {
  sessionId?: string;
  query?: string;
  loopState?: Partial<LoopState>;
};

function normalizeSessionId(value: unknown) {
  if (typeof value !== "string") return "default";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "default";
}

function buildLoopState(value: Partial<LoopState> | undefined): LoopState {
  return {
    iteration: Math.max(1, Math.floor(value?.iteration ?? 1)),
    repeatedCallCount: Math.max(0, Math.floor(value?.repeatedCallCount ?? 0)),
    noProgressCount: Math.max(0, Math.floor(value?.noProgressCount ?? 0))
  };
}

export async function POST(request: NextRequest) {
  let body: BgRunRequestBody;

  try {
    body = (await request.json()) as BgRunRequestBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        route: "/api/bg/run",
        error: "Invalid JSON body."
      },
      { status: 400 }
    );
  }

  const sessionId = normalizeSessionId(body.sessionId);
  const model = process.env.BG_MODEL ?? DEFAULT_BG_MODEL;
  const query = typeof body.query === "string" ? body.query.trim() : "";

  const memory = getSessionMemory(sessionId);
  const uiMessages = listUiMessages(sessionId, 40);

  const messages: BgPromptMessage[] = [
    {
      role: "system",
      content: "You are the background healthcare planner. Keep outputs concise, safe, and escalation-aware."
    },
    {
      role: "system",
      content: `Session memory:\n${buildMemoryContext(memory)}`
    },
    ...uiMessages.map((message) => ({ role: message.role, content: message.content }))
  ];

  if (query.length > 0) {
    messages.push({ role: "user", content: query });
  }

  const result = await runBgAgent({
    sessionId,
    model,
    messages,
    query,
    loopState: buildLoopState(body.loopState),
    enableTools: true
  });

  if (result.shouldStop) {
    const nextFlags = [...memory.riskFlags, "bg_loop_guard_stop"];
    patchSessionMemory(sessionId, { riskFlags: [...new Set(nextFlags)] });
  }

  logEvent({
    category: "bg",
    action: "run",
    level: result.shouldStop ? "warn" : "info",
    sessionId,
    details: {
      model,
      maxContextTokens: result.budget.maxContextTokens,
      usedPromptChars: result.usedPromptChars,
      actions: result.actions
    }
  });

  return NextResponse.json({
    ok: true,
    route: "/api/bg/run",
    sessionId,
    bg: result
  });
}
