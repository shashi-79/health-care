import { getOpenRouterClient } from "@rhc/ai";
import { assertBgModel } from "@rhc/policy";

const DEFAULT_CALL_AGENT_TIMEOUT_MS = Number(process.env.CALL_AGENT_TIMEOUT_MS ?? 25000);

export type CallAgentInput = {
  sessionId: string;
  // This is the call-brief generation model (OpenRouter lane), not the Gemini live runtime model.
  model: string;
  language: string;
  persona: string;
  memoryContext: string;
  recentTranscript?: string;
  timeoutMs?: number;
};

export type CallAgentResult = {
  sessionId: string;
  model: string;
  openingScript: string;
  firstQuestions: string[];
  safetyNotes: string[];
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  const safeTimeoutMs = Math.max(400, timeoutMs);

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

function extractText(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((chunk) => {
      if (!chunk || typeof chunk !== "object") {
        return "";
      }
      const record = chunk as { type?: unknown; text?: unknown };
      if (record.type !== "text") {
        return "";
      }
      return typeof record.text === "string" ? record.text : "";
    })
    .join("\n")
    .trim();
}

function parseJsonResult(raw: string): Omit<CallAgentResult, "sessionId" | "model"> | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      openingScript?: unknown;
      firstQuestions?: unknown;
      safetyNotes?: unknown;
    };

    const openingScript = typeof parsed.openingScript === "string" ? parsed.openingScript.trim() : "";
    const firstQuestions = Array.isArray(parsed.firstQuestions)
      ? parsed.firstQuestions.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
      : [];
    const safetyNotes = Array.isArray(parsed.safetyNotes)
      ? parsed.safetyNotes.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
      : [];

    if (!openingScript) {
      return null;
    }

    return {
      openingScript,
      firstQuestions: firstQuestions.slice(0, 3),
      safetyNotes: safetyNotes.slice(0, 3)
    };
  } catch {
    return null;
  }
}

function deriveContextSnippet(recentTranscript?: string) {
  if (!recentTranscript) {
    return "";
  }

  const compact = recentTranscript.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "";
  }

  return compact.slice(-140);
}

export function buildFallbackCallAgentResult(input: CallAgentInput): CallAgentResult {
  const contextSnippet = deriveContextSnippet(input.recentTranscript);

  const openingScript = contextSnippet
    ? `Hello, this is your care coordinator from the healthcare department. I saw your recent update: \"${contextSnippet}\". Let me quickly check on your symptoms and make sure everything is okay.`
    : "Hello, this is your care coordinator from the healthcare department. Let me quickly check on your symptoms and make sure you're doing okay.";

  return {
    sessionId: input.sessionId,
    model: input.model,
    openingScript,
    firstQuestions: [
      "Can you tell me what symptom is bothering you most right now?",
      "When did this start, and is it getting worse?",
      "Are you having chest pain, breathlessness, or severe bleeding right now?"
    ],
    safetyNotes: [
      "Escalate immediately for emergency red-flag symptoms.",
      "Confirm medicine and allergy details before recommendations.",
      "Keep advice short, clear, and language-appropriate."
    ]
  };
}

export async function runCallAgent(input: CallAgentInput): Promise<CallAgentResult> {
  assertBgModel(input.model);

  const openrouter = getOpenRouterClient();
  const timeoutMs = Number.isFinite(input.timeoutMs)
    ? Math.max(400, Math.floor(input.timeoutMs as number))
    : DEFAULT_CALL_AGENT_TIMEOUT_MS;

  const completion = await withTimeout(
    openrouter.chat.completions.create({
      model: input.model,
      temperature: 0.2,
      max_tokens: 320,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are preparing a live healthcare phone call brief for Sehat Saathi — a real human care coordinator from the Rural Healthcare Department. The brief should sound like it's for a real person making a care call, not an AI. Keep the tone warm, practical, safety-first, and non-technical. The opening script should sound like a real health worker greeting a patient on the phone. Do NOT include any medicine dosages or prescription suggestions in the brief; if medicines are needed, the brief should say 'I will check with our medical team and update you'. Never use words like AI, chatbot, model, or automated anywhere in the generated content."
        },
        {
          role: "system",
          content: `Persona rules: ${input.persona}`
        },
        {
          role: "system",
          content: `Language: ${input.language}\nMemory:\n${input.memoryContext}`
        },
        {
          role: "user",
          content:
            "Return strict JSON with keys openingScript (string), firstQuestions (string array up to 3), safetyNotes (string array up to 3)."
        },
        {
          role: "user",
          content: `Recent transcript context: ${input.recentTranscript && input.recentTranscript.trim().length > 0 ? input.recentTranscript.trim() : "none"}`
        }
      ]
    } as any),
    timeoutMs,
    `Call agent timed out after ${timeoutMs}ms`
  );

  const raw = extractText((completion as any)?.choices?.[0]?.message?.content);
  const parsed = parseJsonResult(raw);

  if (!parsed) {
    return buildFallbackCallAgentResult(input);
  }

  return {
    sessionId: input.sessionId,
    model: input.model,
    openingScript: parsed.openingScript,
    firstQuestions: parsed.firstQuestions,
    safetyNotes: parsed.safetyNotes
  };
}
