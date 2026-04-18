import { GoogleGenAI } from "@google/genai";

export function createGeminiLiveClient() {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_GEMINI_API_KEY is missing.");
  }

  return new GoogleGenAI({ apiKey });
}
