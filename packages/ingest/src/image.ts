import { getOpenRouterClient, getGeminiClient } from "@rhc/ai";

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
  const modelName = process.env.VISION_MODEL;
  if (!modelName) {
    throw new Error("VISION_MODEL is not defined in the environment.");
  }
  const prompt = customPrompt || "Analyze this image from a rural healthcare patient. Describe any visible symptoms or context. If the image contains any visible text, hand-written notes, prescriptions, medical reports, or medication labels, transcribe all of the text verbatim (including medication names, dosages, symptoms, instructions, and test results) so that it can be processed by the text chatbot.";

  if (modelName.toLowerCase().includes("gemini")) {
    const ai = getGeminiClient();
    const response = await withTimeout(
      ai.models.generateContent({
        model: modelName,
        contents: [
          { text: prompt },
          {
            inlineData: {
              data: base64Image,
              mimeType
            }
          }
        ]
      }),
      DEFAULT_IMAGE_ANALYZE_TIMEOUT_MS,
      `Image analysis timed out after ${DEFAULT_IMAGE_ANALYZE_TIMEOUT_MS}ms`
    );
    return (response as any)?.text?.trim() ?? "";
  }

  const openrouter = getOpenRouterClient();
  const completion: any = await withTimeout(
    openrouter.chat.completions.create({
      model: modelName,
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

  const raw: any = completion?.choices?.[0]?.message?.content;
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw)) {
    return raw
      .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
      .join(" ")
      .trim();
  }
  return "";
}

import { createWorker } from "tesseract.js";

export async function performOcr(base64Image: string, mimeType: string): Promise<string> {
  const buffer = Buffer.from(base64Image, "base64");
  const worker = await createWorker("eng");
  const ret = await worker.recognize(buffer);
  await worker.terminate();
  return ret.data.text ?? "";
}
