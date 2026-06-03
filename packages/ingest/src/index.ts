export type InputKind = "text" | "audio" | "document" | "image";

export type IngestInput = {
  kind: InputKind;
  mimeType?: string;
  name?: string;
  text?: string;
  fileRef?: string;
};

export function detectInputKind(mimeType?: string): InputKind {
  if (!mimeType) return "text";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("image/")) return "image";
  if (
    mimeType === "application/pdf" ||
    mimeType === "application/msword" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType.startsWith("text/")
  ) {
    return "document";
  }
  return "text";
}

export * from "./audio";
export * from "./document";
export * from "./image";
