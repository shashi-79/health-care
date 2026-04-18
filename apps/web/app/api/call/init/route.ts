import { HUMAN_PERSONA_POLICY } from "@rhc/policy/persona";
import { assertCallModel } from "@rhc/policy/routing";
import { buildMemoryContext, getSessionMemory } from "@rhc/rag/index";
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_CALL_MODEL = "gemini-live-2.5-flash-preview";

type CallInitRequestBody = {
  sessionId?: string;
};

function normalizeSessionId(value: unknown) {
  if (typeof value !== "string") return "default";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "default";
}

export async function POST(request: NextRequest) {
  let body: CallInitRequestBody = {};

  try {
    body = (await request.json()) as CallInitRequestBody;
  } catch {
    body = {};
  }

  const sessionId = normalizeSessionId(body.sessionId);
  const model = process.env.NEXT_PUBLIC_CALL_MODEL ?? DEFAULT_CALL_MODEL;
  assertCallModel(model);

  const memory = getSessionMemory(sessionId);
  const memoryContext = buildMemoryContext(memory, 1_200);

  return NextResponse.json({
    ok: true,
    route: "/api/call/init",
    sessionId,
    call: {
      provider: "gemini-live",
      model,
      persona: HUMAN_PERSONA_POLICY,
      language: memory.rootDetails?.primaryLanguage ?? "en-IN",
      memoryContext
    }
  });
}
