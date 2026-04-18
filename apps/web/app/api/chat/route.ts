import { addUiMessage, listUiMessages } from "@rhc/db/index";
import { fetchDrugData } from "@rhc/medical/fda";
import { logEvent } from "@rhc/obs/index";
import { assertChatModel } from "@rhc/policy/routing";
import { getSessionMemory, patchSessionMemory } from "@rhc/rag/index";
import { containsEmergencySignal, sanitizeAssistantResponse } from "@rhc/safety/index";
import { classifySymptoms } from "@rhc/triage/engine";
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_CHAT_MODEL = "openai/gpt-4o-mini";

type ChatRequestBody = {
  sessionId?: string;
  text?: string;
  symptoms?: string[] | string;
};

function normalizeSessionId(sessionId: unknown) {
  if (typeof sessionId !== "string") return "default";
  const value = sessionId.trim();
  return value.length > 0 ? value : "default";
}

function normalizeSymptoms(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function extractDrugQuery(text: string): string | undefined {
  const match = text.match(/drug\s*:\s*([^\n]+)/i)?.[1]?.trim();
  if (!match) return undefined;
  return match.length > 0 ? match : undefined;
}

export async function POST(request: NextRequest) {
  let body: ChatRequestBody;

  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        route: "/api/chat",
        error: "Invalid JSON body."
      },
      { status: 400 }
    );
  }

  const sessionId = normalizeSessionId(body.sessionId);
  const model = process.env.CHAT_MODEL ?? DEFAULT_CHAT_MODEL;
  assertChatModel(model);

  const userText = typeof body.text === "string" ? body.text.trim() : "";
  const symptoms = normalizeSymptoms(body.symptoms);

  if (!userText && symptoms.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        route: "/api/chat",
        error: "Provide either text or symptoms."
      },
      { status: 400 }
    );
  }

  const triageInput = symptoms.length > 0 ? symptoms : [userText];
  const triage = classifySymptoms(triageInput);
  const emergencySignal = triage.level === "emergency" || containsEmergencySignal(userText);

  if (userText) {
    addUiMessage({
      sessionId,
      role: "user",
      content: userText
    });
  }

  const memoryBefore = getSessionMemory(sessionId);
  const riskFlags = [...memoryBefore.riskFlags];

  if (emergencySignal) {
    riskFlags.push("emergency_signal");
  } else if (triage.level === "moderate") {
    riskFlags.push("moderate_symptom_pattern");
  }

  let medicalReference: string | undefined;
  const drugQuery = extractDrugQuery(userText);
  if (drugQuery) {
    try {
      const data = await fetchDrugData(drugQuery, 1);
      const first = data[0]?.openfda?.generic_name?.[0];
      if (typeof first === "string") {
        medicalReference = `Reference from openFDA label records: ${first}.`;
      }
    } catch {
      medicalReference = "openFDA lookup is currently unavailable.";
    }
  }

  let assistantText = emergencySignal
    ? "Your symptoms may need urgent in-person care. Please contact local emergency services or go to the nearest hospital now."
    : "Thanks for sharing this. I can help you track symptoms, suggest safe next steps, and flag warning signs early.";

  if (!emergencySignal && medicalReference) {
    assistantText = `${assistantText} ${medicalReference}`;
  }

  assistantText = sanitizeAssistantResponse(assistantText);

  addUiMessage({
    sessionId,
    role: "assistant",
    content: assistantText
  });

  const updatedMemory = patchSessionMemory(sessionId, {
    currentIllness: userText || memoryBefore.currentIllness,
    pastIllnesses: userText
      ? unique([...memoryBefore.pastIllnesses, userText]).slice(-10)
      : memoryBefore.pastIllnesses,
    riskFlags: unique(riskFlags)
  });

  logEvent({
    category: "chat",
    action: "message_processed",
    level: emergencySignal ? "warn" : "info",
    sessionId,
    details: {
      triage: triage.level,
      usedDrugLookup: Boolean(drugQuery)
    }
  });

  return NextResponse.json({
    ok: true,
    route: "/api/chat",
    sessionId,
    model,
    triage,
    assistant: {
      role: "assistant",
      content: assistantText
    },
    memory: updatedMemory,
    uiMessageCount: listUiMessages(sessionId).length
  });
}
