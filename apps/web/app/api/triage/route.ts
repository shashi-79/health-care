import { classifySymptoms } from "@rhc/triage/engine";
import { NextRequest, NextResponse } from "next/server";

type TriageRequestBody = {
  symptoms?: string[] | string;
  text?: string;
};

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
      ? "Seek emergency in-person care immediately."
      : triage.level === "moderate"
        ? "Arrange a clinician consultation soon and monitor symptoms closely."
        : "Continue home monitoring and report if symptoms worsen.";

  return NextResponse.json({
    ok: true,
    route: "/api/triage",
    triage,
    recommendation
  });
}
