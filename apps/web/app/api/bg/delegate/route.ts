import { runBgAgent } from "@rhc/agents";
import { listUiMessages } from "@rhc/db";
import { logEvent } from "@rhc/obs";
import { buildMemoryContext, getSessionMemory } from "@rhc/rag";
import type { BgPromptMessage } from "@rhc/types";
import { NextRequest, NextResponse } from "next/server";

type DelegateRequestBody = {
  sessionId?: string;
  query?: string;
  patientAge?: number;
  patientWeightKg?: number;
};

function normalizeNumeric(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  if (value < min || value > max) {
    return undefined;
  }

  return value;
}

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

  const model = process.env.BG_MODEL;
  if (!model) {
    throw new Error("BG_MODEL is not defined in the environment.");
  }
  const memory = await getSessionMemory(sessionId);
  const patientAge = normalizeNumeric(body.patientAge, 1, 120) ?? memory.rootDetails?.age;
  const patientWeightKg = normalizeNumeric(body.patientWeightKg, 1, 350) ?? memory.rootDetails?.weightKg;
  const uiMessages = await listUiMessages(sessionId, 20);

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
    patientAge,
    patientWeightKg,
    enableTools: true
  });

  logEvent({
    category: "bg",
    action: "delegate",
    sessionId,
    details: {
      model,
      actionCount: result.actions.length,
      maxContextTokens: result.budget.maxContextTokens,
      routeDecision: result.routeDecision,
      fdaLookupStatus: result.lookupStatus,
      dosingInsightCount: result.dosingInsights.length
    }
  });

  logEvent({
    category: "triage",
    action: "route_decision",
    level: result.routeDecision === "emergency_escalation" ? "warn" : "info",
    sessionId,
    details: {
      decision: result.routeDecision,
      fdaLookupStatus: result.lookupStatus
    }
  });

  if (result.safetyInterventions.length > 0) {
    logEvent({
      category: "safety",
      action: "bg_safety_intervention",
      level: "warn",
      sessionId,
      details: {
        interventions: result.safetyInterventions,
        decision: result.routeDecision
      }
    });
  }

  return NextResponse.json({
    ok: true,
    route: "/api/bg/delegate",
    sessionId,
    bg: result
  });
}
