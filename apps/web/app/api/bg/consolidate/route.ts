import { logEvent } from "@rhc/obs";
import { getSessionMemory, patchSessionMemory } from "@rhc/rag";
import { containsEmergencySignal } from "@rhc/safety";
import { classifySymptoms } from "@rhc/triage";
import { NextRequest, NextResponse } from "next/server";

type ConsolidateRequestBody = {
  sessionId?: string;
  transcript?: string;
};

function normalizeSessionId(value: unknown) {
  if (typeof value !== "string") return "default";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "default";
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function extractSymptoms(transcript: string): string[] {
  const symptomPatterns = [
    "chest pain",
    "shortness of breath",
    "fever",
    "persistent cough",
    "dehydration",
    "severe bleeding"
  ];

  const lower = transcript.toLowerCase();
  return symptomPatterns.filter((symptom) => lower.includes(symptom));
}

export async function POST(request: NextRequest) {
  let body: ConsolidateRequestBody;

  try {
    body = (await request.json()) as ConsolidateRequestBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        route: "/api/bg/consolidate",
        error: "Invalid JSON body."
      },
      { status: 400 }
    );
  }

  const sessionId = normalizeSessionId(body.sessionId);
  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";

  if (!transcript) {
    return NextResponse.json(
      {
        ok: false,
        route: "/api/bg/consolidate",
        error: "transcript is required."
      },
      { status: 400 }
    );
  }

  const symptoms = extractSymptoms(transcript);
  const triage = classifySymptoms(symptoms.length > 0 ? symptoms : [transcript]);
  const memoryBefore = getSessionMemory(sessionId);

  const summary = transcript.replace(/\s+/g, " ").slice(0, 600);
  const riskFlags = [...memoryBefore.riskFlags];
  if (triage.level === "emergency" || containsEmergencySignal(transcript)) {
    riskFlags.push("transcript_emergency_signal");
  }

  const updatedMemory = patchSessionMemory(sessionId, {
    currentIllness: summary,
    pastIllnesses: unique([...memoryBefore.pastIllnesses, summary]).slice(-10),
    riskFlags: unique(riskFlags)
  });

  logEvent({
    category: "bg",
    action: "consolidate",
    sessionId,
    level: triage.level === "emergency" ? "warn" : "info",
    details: {
      triage: triage.level,
      extractedSymptoms: symptoms.length
    }
  });

  return NextResponse.json({
    ok: true,
    route: "/api/bg/consolidate",
    sessionId,
    triage,
    extractedSymptoms: symptoms,
    memory: updatedMemory
  });
}
