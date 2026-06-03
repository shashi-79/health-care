import { getOpenRouterClient } from "@rhc/ai";

const DEFAULT_IMAGE_ANALYZE_TIMEOUT_MS = Number(process.env.IMAGE_ANALYZE_TIMEOUT_MS ?? 12000);

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

export async function describeImage(base64Image: string, mimeType: string, customPrompt?: string) {
  const openrouter = getOpenRouterClient();
  const prompt = customPrompt || "Analyze this image from a rural healthcare patient. Describe any visible symptoms, documents, or context concisely.";
  
  const completion = await withTimeout(
    openrouter.chat.completions.create({
      model: process.env.VISION_MODEL || "openai/gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            } as any
          ]
        }
      ],
      max_tokens: 300,
      temperature: 0.2
    } as any),
    DEFAULT_IMAGE_ANALYZE_TIMEOUT_MS,
    `Image analysis timed out after ${DEFAULT_IMAGE_ANALYZE_TIMEOUT_MS}ms`
  );

  const raw: any = completion.choices?.[0]?.message?.content;
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw)) {
    return raw
      .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
      .join(" ")
      .trim();
  }
  return "";
}
