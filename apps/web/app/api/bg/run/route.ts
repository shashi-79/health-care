import { runBgAgent } from "@rhc/agents";
import { listUiMessages } from "@rhc/db";
import { logEvent } from "@rhc/obs";
import { buildMemoryContext, getSessionMemory, patchSessionMemory } from "@rhc/rag";
import type { BgPromptMessage } from "@rhc/types";
import type { LoopState } from "@rhc/agents";
import { NextRequest, NextResponse } from "next/server";

type BgRunRequestBody = {
  sessionId?: string;
  query?: string;
  patientAge?: number;
  patientWeightKg?: number;
  loopState?: Partial<LoopState>;
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
  const model = process.env.BG_MODEL;
  if (!model) {
    throw new Error("BG_MODEL is not defined in the environment.");
  }
  const query = typeof body.query === "string" ? body.query.trim() : "";

  const memory = await getSessionMemory(sessionId);
  const patientAge = normalizeNumeric(body.patientAge, 1, 120) ?? memory.rootDetails?.age;
  const patientWeightKg = normalizeNumeric(body.patientWeightKg, 1, 350) ?? memory.rootDetails?.weightKg;
  const uiMessages = await listUiMessages(sessionId, 40);

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
    patientAge,
    patientWeightKg,
    loopState: buildLoopState(body.loopState),
    enableTools: true
  });

  if (result.shouldStop) {
    const nextFlags = [...memory.riskFlags, "bg_loop_guard_stop"];
    await patchSessionMemory(sessionId, { riskFlags: [...new Set(nextFlags)] });
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
      actions: result.actions,
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
      fdaLookupStatus: result.lookupStatus,
      shouldStop: result.shouldStop
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
    route: "/api/bg/run",
    sessionId,
    bg: result
  });
}
