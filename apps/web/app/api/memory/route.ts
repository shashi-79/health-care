import { addUiMessage, listUiMessages } from "@rhc/db";
import { buildSessionReport } from "@rhc/reporting";
import {
  buildMemoryContext,
  getSessionMemory,
  patchSessionMemory
} from "@rhc/rag";
import type { SessionMemoryPatch, UiMessage } from "@rhc/types";
import { NextRequest, NextResponse } from "next/server";

type MemoryPatchBody = {
  sessionId?: string;
  currentIllness?: string;
  pastIllnesses?: string[];
  riskFlags?: string[];
  rootDetails?: {
    age?: number;
    weightKg?: number;
    gender?: string;
    location?: string;
    primaryLanguage?: string;
  };
  uiMessage?: {
    role: UiMessage["role"];
    content: string;
  };
};

function normalizeSessionId(value: string | null | undefined) {
  const raw = value?.trim() ?? "";
  return raw.length > 0 ? raw : "default";
}

function normalizeStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const next = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return next;
}

export async function GET(request: NextRequest) {
  const sessionId = normalizeSessionId(request.nextUrl.searchParams.get("sessionId"));
  const memory = getSessionMemory(sessionId);
  const uiMessages = listUiMessages(sessionId, 120);

  const report = buildSessionReport({
    sessionId,
    memory,
    uiMessages,
    generatedBy: "memory_route"
  });

  return NextResponse.json({
    ok: true,
    route: "/api/memory",
    sessionId,
    memory,
    memoryContext: buildMemoryContext(memory),
    uiMessages,
    reportPreview: report.markdown.slice(0, 500)
  });
}

export async function PATCH(request: NextRequest) {
  let body: MemoryPatchBody;

  try {
    body = (await request.json()) as MemoryPatchBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        route: "/api/memory",
        error: "Invalid JSON body."
      },
      { status: 400 }
    );
  }

  const sessionId = normalizeSessionId(body.sessionId);

  if (body.uiMessage?.content) {
    addUiMessage({
      sessionId,
      role: body.uiMessage.role,
      content: body.uiMessage.content
    });
  }

  const patch: SessionMemoryPatch = {};

  if (typeof body.currentIllness === "string") {
    patch.currentIllness = body.currentIllness.trim();
  }

  const pastIllnesses = normalizeStringList(body.pastIllnesses);
  if (pastIllnesses) {
    patch.pastIllnesses = pastIllnesses;
  }

  const riskFlags = normalizeStringList(body.riskFlags);
  if (riskFlags) {
    patch.riskFlags = riskFlags;
  }

  if (body.rootDetails) {
    patch.rootDetails = body.rootDetails;
  }

  const memory = patchSessionMemory(sessionId, patch);

  return NextResponse.json({
    ok: true,
    route: "/api/memory",
    sessionId,
    memory,
    uiMessages: listUiMessages(sessionId, 120)
  });
}
