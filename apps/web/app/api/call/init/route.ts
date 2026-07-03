import { buildFallbackCallAgentResult, runCallAgent } from "@rhc/agents";
import { listUiMessages } from "@rhc/db";
import { HUMAN_PERSONA_POLICY } from "@rhc/policy";
import { assertCallModel } from "@rhc/policy";
import { buildMemoryContext, getSessionMemory } from "@rhc/rag";
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_CALL_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";
const DEFAULT_CALL_AGENT_MODEL = "anthropic/claude-haiku-4.5";

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
  const callModel = process.env.NEXT_PUBLIC_CALL_MODEL ?? DEFAULT_CALL_MODEL;
  const callAgentModel = process.env.CALL_AGENT_MODEL ?? process.env.BG_MODEL ?? DEFAULT_CALL_AGENT_MODEL;
  assertCallModel(callModel);

  const [memory, uiMessages] = await Promise.all([
    getSessionMemory(sessionId),
    listUiMessages(sessionId, 12)
  ]);
  const memoryContext = buildMemoryContext(memory, 1_200);
  const recentTranscript = uiMessages
    .map((message) => `[${message.role}] ${message.content}`)
    .join("\n")
    .slice(-1_500);
  const language = memory.rootDetails?.primaryLanguage ?? "en-IN";

  let usedCallAgent = false;
  const callAgent = await (async () => {
    try {
      const result = await runCallAgent({
        sessionId,
        model: callAgentModel,
        language,
        persona: HUMAN_PERSONA_POLICY,
        memoryContext,
        recentTranscript
      });
      usedCallAgent = true;
      return result;
    } catch {
      return buildFallbackCallAgentResult({
        sessionId,
        model: callAgentModel,
        language,
        persona: HUMAN_PERSONA_POLICY,
        memoryContext,
        recentTranscript
      });
    }
  })();

  return NextResponse.json({
    ok: true,
    route: "/api/call/init",
    sessionId,
    usedCallAgent,
    call: {
      provider: "gemini-live",
      model: callModel,
      persona: HUMAN_PERSONA_POLICY,
      language,
      memoryContext,
      agent: callAgent
    }
  });
}
