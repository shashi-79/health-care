import OpenAI from "openai";
let cachedOpenRouterClient = null;
function resolveOpenRouterApiKey() {
    return process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY;
}
export function getOpenRouterClient() {
    if (cachedOpenRouterClient) {
        return cachedOpenRouterClient;
    }
    const apiKey = resolveOpenRouterApiKey();
    if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY is missing.");
    }
    cachedOpenRouterClient = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey,
        defaultHeaders: {
            "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "",
            "X-OpenRouter-Title": process.env.OPENROUTER_SITE_NAME ?? "Rural Healthcare Copilot"
        }
    });
    return cachedOpenRouterClient;
}
export function assertOpenRouterConfig() {
    if (!resolveOpenRouterApiKey()) {
        throw new Error("OPENROUTER_API_KEY is missing.");
    }
}
