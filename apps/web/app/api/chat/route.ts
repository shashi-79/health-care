import { runBgAgent } from "@rhc/agents";
import { runChatAgent, runChatTransferAgent } from "@rhc/agents";
import { addUiMessage, listUiMessages, clearUiMessages } from "@rhc/db";
import { logEvent } from "@rhc/obs";
import { assertChatModel } from "@rhc/policy";
import { buildMemoryContext, getSessionMemory, patchSessionMemory } from "@rhc/rag";
import {
  applyAssistantGuardrails,
  buildEmergencyEscalationTemplate,
  containsEmergencySignal
} from "@rhc/safety";
import { classifySymptoms } from "@rhc/triage";
import type { BgPromptMessage } from "@rhc/types";
import { enqueueBgAnalysis } from "@rhc/worker";
import { addScheduleItem } from "../care/store";
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_CHAT_MODEL = "openai/gpt-4o-mini";
const DEFAULT_BG_MODEL = "anthropic/claude-haiku-4.5";

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
  if (match && match.length > 0) return match;

  const maybeDrug = text.match(/\b(?:medicine|drug|tablet|medication|for)\s+([a-z0-9\-\s]{3,60})/i)?.[1]?.trim();
  if (maybeDrug && maybeDrug.length > 0) {
    return maybeDrug;
  }
  return undefined;
}

function buildFallbackAssistantText(input: {
  emergencySignal: boolean;
  medicalReference?: string;
  userText: string;
  symptoms: string[];
  triageLevel: "mild" | "moderate" | "emergency";
}) {
  const briefUserText = input.userText.replace(/\s+/g, " ").trim().slice(0, 90);
  const symptomText = input.symptoms.length > 0 ? ` Symptoms tracked: ${input.symptoms.join(", ")}.` : "";

  if (input.emergencySignal) {
    return `Your symptoms may need urgent in-person care. Please contact local emergency services or go to the nearest hospital now.${symptomText}`;
  }

  const referenceText = input.medicalReference ? ` ${input.medicalReference}` : "";

  if (input.triageLevel === "moderate") {
    return `I noted your update${briefUserText ? `: "${briefUserText}"` : ""}. Please rest, hydrate, and monitor symptom progression today. If you develop breathing trouble, chest pain, or worsening fever, seek in-person care promptly.${symptomText}${referenceText}`;
  }

  return `I noted your update${briefUserText ? `: "${briefUserText}"` : ""}. Continue hydration and routine care, and share if symptoms persist or worsen so I can guide next steps.${symptomText}${referenceText}`;
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
  const memoryContext = buildMemoryContext(memoryBefore, 1_600);
  const transferInputText = userText || `Symptoms: ${symptoms.join(", ")}`;
  const transferDecision = await runChatTransferAgent({
    sessionId,
    model,
    userText: transferInputText,
    triageLevel: triage.level,
    emergencySignal,
    memoryContext
  });

  const riskFlags = [...memoryBefore.riskFlags];
  const safetyInterventions: string[] = [];
  const triageRouteDecision: "emergency_escalation" | "chat_only" | "chat_plus_bg" = transferDecision.decision === "transfer_to_bg"
    ? "chat_plus_bg"
    : transferDecision.decision === "emergency_escalation" || emergencySignal
      ? "emergency_escalation"
      : "chat_only";

  if (emergencySignal) {
    riskFlags.push("emergency_signal");
  } else if (triage.level === "moderate") {
    riskFlags.push("moderate_symptom_pattern");
  }

  const drugQuery = extractDrugQuery(userText);
  let medicalReference: string | undefined;

  let assistantText = "";
  let usedChatAgent = false;
  let bgEscalationTemplate: string | undefined;

  const bgAnalysis: {
    executed: boolean;
    actions: string[];
    drugHints: string[];
    dosingInsights: string[];
    shouldStop: boolean;
    routeDecision: "emergency_escalation" | "drug_lookup" | "bg_planning" | "chat_only";
    lookupStatus: "not_requested" | "completed" | "timed_out" | "failed";
  } = {
    executed: false,
    actions: [],
    drugHints: [],
    dosingInsights: [],
    shouldStop: false,
    routeDecision: "chat_only",
    lookupStatus: "not_requested"
  };

  const shouldRunBgAnalysis = !emergencySignal && transferDecision.decision === "transfer_to_bg";

  if (shouldRunBgAnalysis) {
    const bgModel = process.env.BG_MODEL ?? DEFAULT_BG_MODEL;
    const uiMessages = listUiMessages(sessionId, 20);

    const bgMessages: BgPromptMessage[] = [
      {
        role: "system",
        content: "You are a healthcare background analysis assistant. Focus on short, safe clinical planning notes."
      },
      ...uiMessages.map((message) => ({ role: message.role, content: message.content }))
    ];

    if (userText.length > 0) {
      bgMessages.push({ role: "user", content: userText });
    }

    const enqueueResult = await enqueueBgAnalysis({
      sessionId,
      bgModel,
      bgMessages,
      userText,
      memoryBefore
    });

    if (enqueueResult.queued) {
      bgAnalysis.executed = true;
      bgAnalysis.actions.push("bg_analysis_queued");
      bgAnalysis.routeDecision = "bg_planning";
      medicalReference =
        "Background analysis is in progress and may take a few minutes. I will provide an update when it is complete.";
    } else {
      // Graceful degradation: run the BG agent inline (bounded) so users still get value.
      bgAnalysis.actions.push(`bg_queue_unavailable:${enqueueResult.reason}`);
      try {
        const inlineBg = (await Promise.race([
          runBgAgent({
            sessionId,
            model: bgModel,
            messages: bgMessages,
            query: userText,
            patientAge: memoryBefore.rootDetails?.age,
            patientWeightKg: memoryBefore.rootDetails?.weightKg,
            enableTools: Boolean(drugQuery)
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("inline_bg_timeout")), 8_000)
          )
        ])) as Awaited<ReturnType<typeof runBgAgent>>;

        bgAnalysis.executed = true;
        bgAnalysis.actions.push(...inlineBg.actions, "bg_analysis_inline");
        bgAnalysis.drugHints = inlineBg.drugHints;
        bgAnalysis.dosingInsights = inlineBg.dosingInsights;
        bgAnalysis.shouldStop = inlineBg.shouldStop;
        bgAnalysis.routeDecision = inlineBg.routeDecision;
        bgAnalysis.lookupStatus = inlineBg.lookupStatus;

        if (inlineBg.drugHints.length > 0) {
          medicalReference = `For non-critical symptom support, FDA label references suggest: ${inlineBg.drugHints.join(", ")}. Advise clinician confirmation.`;
        }
        if (inlineBg.dosingInsights.length > 0) {
          const conciseDosing = inlineBg.dosingInsights.slice(0, 2).join(" | ");
          medicalReference = `${medicalReference ?? ""} BG dosing review: ${conciseDosing}`.trim();
        }
        if (inlineBg.escalationTemplate) {
          bgEscalationTemplate = inlineBg.escalationTemplate;
        }
      } catch (error) {
        bgAnalysis.actions.push(
          `bg_inline_failed:${(error as Error)?.message ?? String(error)}`
        );
        bgAnalysis.lookupStatus = "failed";
      }
    }
  }

  const chatMessages: BgPromptMessage[] = [];
  const priorMessages = listUiMessages(sessionId, 20);

  for (const message of priorMessages) {
    chatMessages.push({ role: message.role, content: message.content });
  }

  if (chatMessages.length === 0 && symptoms.length > 0) {
    chatMessages.push({ role: "user", content: `Symptoms: ${symptoms.join(", ")}` });
  }

  const shouldEscalateImmediately =
    emergencySignal
    || transferDecision.decision === "emergency_escalation"
    || bgAnalysis.routeDecision === "emergency_escalation";

  if (shouldEscalateImmediately) {
    assistantText =
      bgEscalationTemplate ?? buildEmergencyEscalationTemplate(symptoms.length > 0 ? symptoms : triageInput);
    safetyInterventions.push("emergency_escalation_template");
    riskFlags.push("emergency_escalation_template");
  } else if (shouldRunBgAnalysis) {
    assistantText = medicalReference || "Analyzing your medical profile and cross-referencing FDA databases. Please wait...";
    usedChatAgent = false;
  } else {
    try {
      const chatResult = await runChatAgent({
        sessionId,
        model,
        memoryContext,
        triageLevel: triage.level,
        emergencySignal,
        messages: chatMessages,
        transferDecision: transferDecision.decision,
        transferReason: transferDecision.reason,
        bgActions: bgAnalysis.actions,
        drugHints: bgAnalysis.drugHints,
        dosingInsights: bgAnalysis.dosingInsights,
        medicalReference
      });

      assistantText = chatResult.responseText;
      usedChatAgent = true;

      if (chatResult.scheduledCall) {
        let scheduleDate = new Date().toISOString();
        if (chatResult.scheduledCall.time.toLowerCase().includes("tomorrow")) {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          scheduleDate = d.toISOString();
        }
        
        addScheduleItem(sessionId, {
          scheduleType: "Call Time",
          title: chatResult.scheduledCall.title || "Follow-up Callback",
          time: chatResult.scheduledCall.time,
          duration: "15 min",
          notes: "Scheduled autonomously by AI",
          dateNumber: new Date(scheduleDate).getDate().toString(),
          dayLabel: new Date(scheduleDate).toLocaleDateString('en-US', { weekday: 'short' }),
          tone: "warning",
          scheduleDate: scheduleDate
        });
        
        bgAnalysis.actions.push("schedule_call_created");
      }
    } catch {
      assistantText = buildFallbackAssistantText({
        emergencySignal,
        medicalReference,
        userText,
        symptoms,
        triageLevel: triage.level
      });
    }
  }

  const safetyReview = applyAssistantGuardrails(assistantText);
  assistantText = safetyReview.text;
  if (safetyReview.interventions.length > 0) {
    safetyInterventions.push(...safetyReview.interventions);
    riskFlags.push(...safetyReview.interventions.map((item) => `safety_${item}`));
  }

  const uniqueSafetyInterventions = unique(safetyInterventions);

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
    category: "triage",
    action: "route_decision",
    level: shouldEscalateImmediately ? "warn" : triage.level === "moderate" ? "warn" : "info",
    sessionId,
    details: {
      triage: triage.level,
      decision: triageRouteDecision,
      emergencySignal: shouldEscalateImmediately,
      usedBgAnalysis: bgAnalysis.executed,
      bgRouteDecision: bgAnalysis.routeDecision,
      fdaLookupStatus: bgAnalysis.lookupStatus,
      dosingInsightCount: bgAnalysis.dosingInsights.length,
      transferDecision: transferDecision.decision,
      transferSource: transferDecision.source
    }
  });

  if (uniqueSafetyInterventions.length > 0) {
    logEvent({
      category: "safety",
      action: "assistant_guardrail_intervention",
      level: "warn",
      sessionId,
      details: {
        triage: triage.level,
        decision: triageRouteDecision,
        interventions: uniqueSafetyInterventions
      }
    });
  }

  logEvent({
    category: "chat",
    action: "message_processed",
    level: emergencySignal ? "warn" : "info",
    sessionId,
    details: {
      triage: triage.level,
      usedDrugLookup: Boolean(drugQuery),
      usedBgAnalysis: bgAnalysis.executed,
      usedChatAgent,
      safetyInterventions: uniqueSafetyInterventions.length,
      dosingInsightCount: bgAnalysis.dosingInsights.length,
      transferDecision: transferDecision.decision
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
    usedChatAgent,
    transferDecision,
    bgAnalysis,
    safety: {
      interventions: uniqueSafetyInterventions,
      emergencyEscalated: shouldEscalateImmediately,
      triageRouteDecision
    },
    memory: updatedMemory,
    uiMessageCount: listUiMessages(sessionId).length
  });
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId") ?? "default";
  const limitStr = request.nextUrl.searchParams.get("limit");
  const limit = limitStr ? parseInt(limitStr, 10) : 120;
  
  const messages = listUiMessages(sessionId, limit);
  
  return NextResponse.json({
    ok: true,
    sessionId,
    messages
  });
}

export async function DELETE(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId") ?? "default";
  
  clearUiMessages(sessionId);
  logEvent({ category: "chat", action: "history_cleared", sessionId, details: {} });
  
  return NextResponse.json({
    ok: true,
    sessionId,
    message: "Chat history cleared"
  });
}
