import { addUiMessage } from "@rhc/db";
import { detectInputKind, transcribeAudio, describeImage, performOcr } from "@rhc/ingest";
import { NextRequest, NextResponse } from "next/server";

type UploadBody = {
  sessionId?: string;
  mimeType?: string;
  fileName?: string;
  sizeBytes?: number;
  text?: string;
  base64Audio?: string;
  base64Image?: string;
  audioFormat?: "wav" | "mp3" | "ogg";
};

function normalizeSessionId(value: unknown) {
  if (typeof value !== "string") return "default";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "default";
}

export async function POST(request: NextRequest) {
  let body: UploadBody;

  try {
    body = (await request.json()) as UploadBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        route: "/api/ingest/upload",
        error: "Invalid JSON body."
      },
      { status: 400 }
    );
  }

  const sessionId = normalizeSessionId(body.sessionId);
  const mimeType = typeof body.mimeType === "string" ? body.mimeType : undefined;
  const kind = detectInputKind(mimeType);
  const fileName = typeof body.fileName === "string" ? body.fileName : "upload.bin";
  const fileRef = `${sessionId}/${Date.now()}-${fileName}`;

  let transcript = "";
  let warning: string | undefined;

  if (kind === "audio" && typeof body.base64Audio === "string" && body.base64Audio.length > 0) {
    try {
      transcript = await transcribeAudio(body.base64Audio, body.audioFormat ?? "wav");
    } catch {
      warning = "Audio transcription failed for this request.";
    }
  } else if (kind === "image" && typeof body.base64Image === "string" && body.base64Image.length > 0) {
    try {
      if ((body as any).ocrOnly === true) {
        const ocrText = await performOcr(body.base64Image, mimeType ?? "image/jpeg");
        transcript = `[Image Uploaded - Vision Context: ${ocrText}]`.trim();
      } else {
        const explicitPrompt = typeof body.text === "string" && body.text.trim().length > 0 
          ? `User says: "${body.text.trim()}". Please evaluate this context alongside the image.`
          : undefined;
        const rawDescription = await describeImage(body.base64Image, mimeType ?? "image/jpeg", explicitPrompt);
        transcript = `[Image Uploaded - Vision Context: ${rawDescription}] ${typeof body.text === "string" ? body.text.trim() : ""}`.trim();
      }
    } catch {
      warning = "Image analysis failed for this request.";
    }
  }

  const normalizedText = typeof body.text === "string" ? body.text.trim() : "";
  const capturedText = transcript || normalizedText;
  const ocrOnly = (body as any).ocrOnly === true;

  if (capturedText.length > 0 && !ocrOnly) {
    addUiMessage({
      sessionId,
      role: "user",
      content: capturedText
    });
  }

  return NextResponse.json({
    ok: true,
    route: "/api/ingest/upload",
    ingest: {
      sessionId,
      kind,
      fileRef,
      fileName,
      mimeType: mimeType ?? "application/octet-stream",
      sizeBytes: typeof body.sizeBytes === "number" ? body.sizeBytes : null,
      transcript,
      warning
    }
  });
}
