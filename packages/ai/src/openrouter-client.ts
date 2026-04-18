import OpenAI from "openai";

export const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "",
    "X-OpenRouter-Title": process.env.OPENROUTER_SITE_NAME ?? "Rural Healthcare Copilot"
  }
});

export function assertOpenRouterConfig() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is missing.");
  }
}
