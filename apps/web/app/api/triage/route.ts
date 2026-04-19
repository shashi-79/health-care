import { classifySymptoms } from "@rhc/triage/engine";
import { logEvent } from "@rhc/obs/index";
import { buildEmergencyEscalationTemplate } from "@rhc/safety/index";
import { NextRequest, NextResponse } from "next/server";

type TriageRequestBody = {
  sessionId?: string;
  symptoms?: string[] | string;
  text?: string;
};

function normalizeSessionId(value: unknown) {
  if (typeof value !== "string") return "default";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "default";
}

function normalizeSymptoms(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  return [];
}

export async function POST(request: NextRequest) {
  let body: TriageRequestBody;

  try {
    body = (await request.json()) as TriageRequestBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        route: "/api/triage",
        error: "Invalid JSON body."
      },
      { status: 400 }
    );
  }

  const symptoms = normalizeSymptoms(body.symptoms);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const sessionId = normalizeSessionId(body.sessionId);
  const triageInput = symptoms.length > 0 ? symptoms : text ? [text] : [];

  if (triageInput.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        route: "/api/triage",
        error: "Provide symptoms or text."
      },
      { status: 400 }
    );
  }

  const triage = classifySymptoms(triageInput);
  const recommendation =
    triage.level === "emergency"
      ? buildEmergencyEscalationTemplate(symptoms)
      : triage.level === "moderate"
        ? "Arrange a clinician consultation soon and monitor symptoms closely."
        : "Continue home monitoring and report if symptoms worsen.";

  logEvent({
    category: "triage",
    action: "route_decision",
    level: triage.level === "emergency" ? "warn" : triage.level === "moderate" ? "warn" : "info",
    sessionId,
    details: {
      triage: triage.level,
      decision: triage.level === "emergency" ? "emergency_escalation" : "non_emergency"
    }
  });

  if (triage.level === "emergency") {
    logEvent({
      category: "safety",
      action: "emergency_escalation_template_sent",
      level: "warn",
      sessionId,
      details: {
        source: "/api/triage"
      }
    });
  }

  return NextResponse.json({
    ok: true,
    route: "/api/triage",
    sessionId,
    triage,
    recommendation
  });
}
