import { getOpenRouterClient } from "@rhc/ai";
import { assertChatModel } from "@rhc/policy";
import type { BgPromptMessage } from "@rhc/types";

const DEFAULT_CHAT_AGENT_TIMEOUT_MS = Number(process.env.CHAT_AGENT_TIMEOUT_MS ?? 5500);
const DEFAULT_CHAT_TRANSFER_TIMEOUT_MS = Number(process.env.CHAT_TRANSFER_TIMEOUT_MS ?? 3200);

export type ChatAgentInput = {
  sessionId: string;
  model: string;
  memoryContext: string;
  triageLevel: "mild" | "moderate" | "emergency";
  emergencySignal: boolean;
  messages: BgPromptMessage[];
  transferDecision?: "chat_only" | "transfer_to_bg" | "emergency_escalation";
  transferReason?: string;
  bgActions?: string[];
  drugHints?: string[];
  dosingInsights?: string[];
  medicalReference?: string;
  timeoutMs?: number;
};

export type ChatAgentResult = {
  sessionId: string;
  model: string;
  responseText: string;
  usedPromptChars: number;
  scheduledCall?: {
    time: string;
    title?: string;
  };
};

export type ChatTransferDecisionInput = {
  sessionId: string;
  model: string;
  userText: string;
  triageLevel: "mild" | "moderate" | "emergency";
  emergencySignal: boolean;
  memoryContext?: string;
  timeoutMs?: number;
};

export type ChatTransferDecisionResult = {
  sessionId: string;
  model: string;
  decision: "chat_only" | "transfer_to_bg" | "emergency_escalation";
  needsFdaLookup: boolean;
  reason: string;
  confidence: "low" | "medium" | "high";
  source: "chat_agent" | "heuristic_fallback";
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

function extractResponseText(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  const text = content
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

  return text;
}

function extractJsonObject(text: string) {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first < 0 || last <= first) {
    return null;
  }

  try {
    return JSON.parse(text.slice(first, last + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function inferTransferFallback(input: ChatTransferDecisionInput): ChatTransferDecisionResult {
  const lower = input.userText.toLowerCase();
  const hasMedicineIntent = /\b(drug|medicine|tablet|capsule|dose|dosing|prescrib|medication|fda)\b/i.test(lower);
  const hasPlanningIntent = /\b(analy[sz]e|analysis|assess|plan|follow\s*up|next\s*step|recommend)\b/i.test(lower);

  if (input.emergencySignal || input.triageLevel === "emergency") {
    return {
      sessionId: input.sessionId,
      model: input.model,
      decision: "emergency_escalation",
      needsFdaLookup: false,
      reason: "Emergency signal detected in user message.",
      confidence: "high",
      source: "heuristic_fallback"
    };
  }

  if (hasMedicineIntent || hasPlanningIntent || input.triageLevel === "moderate") {
    return {
      sessionId: input.sessionId,
      model: input.model,
      decision: "transfer_to_bg",
      needsFdaLookup: hasMedicineIntent,
      reason: hasMedicineIntent
        ? "Medication/FDA intent detected; BG analysis required."
        : "Clinical planning intent detected; BG analysis required.",
      confidence: "medium",
      source: "heuristic_fallback"
    };
  }

  return {
    sessionId: input.sessionId,
    model: input.model,
    decision: "chat_only",
    needsFdaLookup: false,
    reason: "General guidance request without tool-dependent needs.",
    confidence: "medium",
    source: "heuristic_fallback"
  };
}

function normalizeDecisionValue(value: unknown): ChatTransferDecisionResult["decision"] | undefined {
  if (value === "chat_only" || value === "transfer_to_bg" || value === "emergency_escalation") {
    return value;
  }

  return undefined;
}

function normalizeConfidenceValue(value: unknown): ChatTransferDecisionResult["confidence"] {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }

  return "medium";
}

function normalizeMessages(messages: BgPromptMessage[]) {
  return messages
    .filter((message) => typeof message.content === "string" && message.content.trim().length > 0)
    .map((message) => ({ role: message.role, content: message.content.trim() }))
    .slice(-22);
}

function buildClinicalContext(input: ChatAgentInput) {
  const lines = [
    `triage_level: ${input.triageLevel}`,
    `emergency_signal: ${input.emergencySignal ? "yes" : "no"}`,
    `transfer_decision: ${input.transferDecision ?? "unknown"}`,
    `transfer_reason: ${input.transferReason ?? "none"}`,
    `bg_actions: ${input.bgActions && input.bgActions.length > 0 ? input.bgActions.join(", ") : "none"}`,
    `drug_hints: ${input.drugHints && input.drugHints.length > 0 ? input.drugHints.join(", ") : "none"}`,
    `dosing_insights: ${input.dosingInsights && input.dosingInsights.length > 0 ? input.dosingInsights.join(" || ") : "none"}`,
    `medical_reference: ${input.medicalReference ?? "none"}`,
    `memory_context:\n${input.memoryContext}`
  ];

  return lines.join("\n");
}

export async function runChatAgent(input: ChatAgentInput): Promise<ChatAgentResult> {
  assertChatModel(input.model);

  const openrouter = getOpenRouterClient();
  const timeoutMs = Number.isFinite(input.timeoutMs)
    ? Math.max(400, Math.floor(input.timeoutMs as number))
    : DEFAULT_CHAT_AGENT_TIMEOUT_MS;

  const systemMessages = [
    {
      role: "system",
      content:
        "You are a human healthcare guide for rural follow-up chat. Use empathetic, clear, non-technical language and avoid mentioning AI/chatbot/model terms."
    },
    {
      role: "system",
      content:
        "Give practical next steps. If emergency_signal is yes, prioritize urgent in-person escalation immediately before any other advice. VERY IMPORTANT: NEVER suggest general medications or precise dosages yourself directly. You MUST NOT prescribe anything. Only inform the user that the background medical analysis team will provide safe, age/weight-adjusted low dose suggestions via the background system. Keep response concise (3-6 short sentences)."
    },
    {
      role: "system",
      content: `Clinical context:\n${buildClinicalContext(input)}`
    }
  ];

  const messages = [...systemMessages, ...normalizeMessages(input.messages)];
  const promptChars = messages.reduce((acc, message) => acc + message.content.length, 0);

  const completion: any = await withTimeout(
    openrouter.chat.completions.create({
      model: input.model,
      temperature: 0.25,
      max_tokens: 260,
      messages,
      tools: [
        {
          type: "function",
          function: {
            name: "schedule_call",
            description: "Schedule an autonomous voice call callback with the patient. Use this if the patient requests a call, callback, or phone contact at a specific time or immediately.",
            parameters: {
              type: "object",
              properties: {
                time: { type: "string", description: "Time exactly as requested, e.g. 'now', '5 minutes', '2:00 PM', 'tomorrow morning'" },
                title: { type: "string", description: "Brief reason or title for the call" }
              },
              required: ["time"]
            }
          }
        }
      ]
    } as any),
    timeoutMs,
    `Chat agent timed out after ${timeoutMs}ms`
  );

  const responseMessage = completion.choices?.[0]?.message;
  let responseText = extractResponseText(responseMessage?.content);
  
  let scheduledCall;
  if (responseMessage?.tool_calls?.length > 0) {
    const call = responseMessage.tool_calls.find((tc: any) => tc.function.name === "schedule_call");
    if (call && call.function.arguments) {
      try {
        const args = JSON.parse(call.function.arguments);
        scheduledCall = {
          time: args.time || "now",
          title: args.title || "Follow-up Callback"
        };
      } catch (e) {}
    }
  }

  if (!responseText && scheduledCall) {
    responseText = `I have scheduled a call for ${scheduledCall.time}.`;
  } else if (!responseText) {
    throw new Error("Chat agent returned an empty response.");
  }

  return {
    sessionId: input.sessionId,
    model: input.model,
    responseText,
    usedPromptChars: promptChars,
    scheduledCall
  };
}

export async function runChatTransferAgent(input: ChatTransferDecisionInput): Promise<ChatTransferDecisionResult> {
  assertChatModel(input.model);

  const openrouter = getOpenRouterClient();
  const timeoutMs = Number.isFinite(input.timeoutMs)
    ? Math.max(350, Math.floor(input.timeoutMs as number))
    : DEFAULT_CHAT_TRANSFER_TIMEOUT_MS;

  const fallback = inferTransferFallback(input);

  try {
    const completion: any = await withTimeout(
      openrouter.chat.completions.create({
        model: input.model,
        temperature: 0,
        max_tokens: 160,
        messages: [
          {
            role: "system",
            content:
              "You are a medical routing classifier. Reply with strict JSON only: {\"decision\":\"chat_only|transfer_to_bg|emergency_escalation\",\"needsFdaLookup\":boolean,\"reason\":string,\"confidence\":\"low|medium|high\"}. Use transfer_to_bg for medicine/drug/FDA requests or analysis-intensive requests. Use emergency_escalation for urgent danger signals."
          },
          {
            role: "user",
            content: [
              `triage_level: ${input.triageLevel}`,
              `emergency_signal: ${input.emergencySignal ? "yes" : "no"}`,
              `memory_context: ${input.memoryContext ?? "none"}`,
              `message: ${input.userText}`
            ].join("\n")
          }
        ]
      } as any),
      timeoutMs,
      `Chat transfer agent timed out after ${timeoutMs}ms`
    );

    const raw = extractResponseText(completion.choices?.[0]?.message?.content);
    const parsed = extractJsonObject(raw);
    const decision = normalizeDecisionValue(parsed?.decision);

    if (!parsed || !decision) {
      return fallback;
    }

    return {
      sessionId: input.sessionId,
      model: input.model,
      decision,
      needsFdaLookup: Boolean(parsed.needsFdaLookup),
      reason: typeof parsed.reason === "string" && parsed.reason.trim().length > 0
        ? parsed.reason.trim().slice(0, 220)
        : fallback.reason,
      confidence: normalizeConfidenceValue(parsed.confidence),
      source: "chat_agent"
    };
  } catch {
    return fallback;
  }
}
