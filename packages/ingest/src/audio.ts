import { getOpenRouterClient } from "@rhc/ai/openrouter-client";

const DEFAULT_AUDIO_TRANSCRIBE_TIMEOUT_MS = Number(process.env.AUDIO_TRANSCRIBE_TIMEOUT_MS ?? 5000);

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  const safeTimeoutMs = Math.max(300, timeoutMs);

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, safeTimeoutMs);

    void promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function transcribeAudio(base64Audio: string, format: "wav" | "mp3" | "ogg" = "wav") {
  const openrouter = getOpenRouterClient();
  const completion = await withTimeout(
    openrouter.chat.completions.create({
      model: process.env.AUDIO_TRANSCRIBE_MODEL || "openai/gpt-4o-audio-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribe this audio verbatim. Preserve original language." },
            { type: "input_audio", input_audio: { data: base64Audio, format } }
          ]
        }
      ]
    } as any),
    DEFAULT_AUDIO_TRANSCRIBE_TIMEOUT_MS,
    `Audio transcription timed out after ${DEFAULT_AUDIO_TRANSCRIBE_TIMEOUT_MS}ms`
  );

  const raw: any = completion.choices?.[0]?.message?.content;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
      .join(" ")
      .trim();
  }
  return "";
}
