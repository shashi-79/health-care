import { runBgAgent } from "@rhc/agents/bg-agent";
import { listUiMessages } from "@rhc/db/index";
import { logEvent } from "@rhc/obs/index";
import { buildMemoryContext, getSessionMemory } from "@rhc/rag/index";
import type { BgPromptMessage } from "@rhc/types/index";
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_BG_MODEL = "anthropic/claude-haiku-4.5";

type DelegateRequestBody = {
  sessionId?: string;
  query?: string;
};

function normalizeSessionId(value: unknown) {
  if (typeof value !== "string") return "default";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "default";
}

export async function POST(request: NextRequest) {
  let body: DelegateRequestBody;

  try {
    body = (await request.json()) as DelegateRequestBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        route: "/api/bg/delegate",
        error: "Invalid JSON body."
      },
      { status: 400 }
    );
  }

  const sessionId = normalizeSessionId(body.sessionId);
  const query = typeof body.query === "string" ? body.query.trim() : "";

  if (!query) {
    return NextResponse.json(
      {
        ok: false,
        route: "/api/bg/delegate",
        error: "query is required."
      },
      { status: 400 }
    );
  }

  const model = process.env.BG_MODEL ?? DEFAULT_BG_MODEL;
  const memory = getSessionMemory(sessionId);
  const uiMessages = listUiMessages(sessionId, 20);

  const messages: BgPromptMessage[] = [
    {
      role: "system",
      content: `Session memory:\n${buildMemoryContext(memory, 1_500)}`
    },
    ...uiMessages.map((message) => ({ role: message.role, content: message.content })),
    { role: "user", content: query }
  ];

  const result = await runBgAgent({
    sessionId,
    model,
    messages,
    query,
    enableTools: true
  });

  logEvent({
    category: "bg",
    action: "delegate",
    sessionId,
    details: {
      model,
      actionCount: result.actions.length,
      maxContextTokens: result.budget.maxContextTokens
    }
  });

  return NextResponse.json({
    ok: true,
    route: "/api/bg/delegate",
    sessionId,
    bg: result
  });
}
