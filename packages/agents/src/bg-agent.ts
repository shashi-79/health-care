import { fetchDrugData } from "@rhc/medical/fda";
import { getOpenRouterClient } from "@rhc/ai/openrouter-client";
import { assertBgModel, assertToolsAllowedOnlyForBg } from "@rhc/policy/routing";
import { buildEmergencyEscalationTemplate, containsEmergencySignal } from "@rhc/safety/index";
import { buildContextBudget, fitMessagesToBudget, truncateTextToBudget } from "@rhc/tools/index";
import type { BgPromptMessage, ContextBudget } from "@rhc/types/index";
import { shouldStopLoop, type LoopState } from "./loop-guard";

export type BgAgentInput = {
  sessionId: string;
  model: string;
  messages: BgPromptMessage[];
  query?: string;
  patientAge?: number;
  patientWeightKg?: number;
  loopState?: LoopState;
  enableTools?: boolean;
};

export type BgAgentResult = {
  sessionId: string;
  model: string;
  budget: ContextBudget;
  usedPromptChars: number;
  promptPreview: string;
  actions: string[];
  shouldStop: boolean;
  drugHints: string[];
  routeDecision: "emergency_escalation" | "drug_lookup" | "bg_planning";
  lookupStatus: "not_requested" | "completed" | "timed_out" | "failed";
  safetyInterventions: string[];
  dosingInsights: string[];
  patientContext: {
    age?: number;
    weightKg?: number;
  };
  escalationTemplate?: string;
};

type DrugLookupResult = {
  hints: string[];
  dosingInsights: string[];
  timedOut: boolean;
  failed: boolean;
};

const BG_TOOL_TIMEOUT_MS = Number(process.env.BG_TOOL_TIMEOUT_MS ?? 1800);
const MAX_DOSING_INSIGHTS = 4;

function normalizePatientAge(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const age = Math.floor(value);
  if (age <= 0 || age > 120) {
    return undefined;
  }

  return age;
}

function normalizePatientWeightKg(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const weight = Math.round(value * 10) / 10;
  if (weight <= 0 || weight > 350) {
    return undefined;
  }

  return weight;
}

function extractAgeFromQuery(query: string) {
  const ageMatch = query.match(/\bage\s*[:=]?\s*(\d{1,3})\b/i) ?? query.match(/\b(\d{1,3})\s*(?:years?\s*old|yrs?\b|yo\b)\b/i);
  if (!ageMatch) {
    return undefined;
  }

  return normalizePatientAge(Number(ageMatch[1]));
}

function extractWeightKgFromQuery(query: string) {
  const weightMatch = query.match(/\bweight\s*[:=]?\s*(\d{1,3}(?:\.\d+)?)\s*(?:kg|kilograms?)\b/i)
    ?? query.match(/\b(\d{1,3}(?:\.\d+)?)\s*(?:kg|kilograms?)\b/i);
  if (!weightMatch) {
    return undefined;
  }

  return normalizePatientWeightKg(Number(weightMatch[1]));
}

function normalizeLabelText(input: unknown): string[] {
  if (typeof input === "string") {
    return [input];
  }

  if (!Array.isArray(input)) {
    return [];
  }

  return input.filter((item): item is string => typeof item === "string");
}

function sentenceSplit(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function formatDoseValue(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function pickLabelName(result: any) {
  const genericName = result?.openfda?.generic_name?.[0];
  if (typeof genericName === "string" && genericName.trim().length > 0) {
    return genericName.trim();
  }

  const brandName = result?.openfda?.brand_name?.[0];
  if (typeof brandName === "string" && brandName.trim().length > 0) {
    return brandName.trim();
  }

  return "Drug";
}

function sentenceMatchesAgeProfile(sentence: string, age?: number) {
  if (typeof age !== "number") {
    return true;
  }

  const lower = sentence.toLowerCase();

  if (age < 18) {
    if (/(adult|geriatric|elderly)/i.test(lower) && !/(pediatric|children|child|infant|adolescent)/i.test(lower)) {
      return false;
    }
    return /(pediatric|children|child|infant|adolescent|years?)/i.test(lower);
  }

  if (age >= 65) {
    if (/(pediatric|children|child|infant)/i.test(lower)) {
      return false;
    }
    return /(geriatric|elderly|adult|years?)/i.test(lower);
  }

  return !/(pediatric|children|child|infant|geriatric|elderly)/i.test(lower);
}

function deriveWeightBasedInsight(sentence: string, weightKg: number, labelName: string) {
  const rangeMatch = sentence.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*mg\s*\/\s*kg/i);
  if (rangeMatch) {
    const minPerKg = Number(rangeMatch[1]);
    const maxPerKg = Number(rangeMatch[2]);

    if (Number.isFinite(minPerKg) && Number.isFinite(maxPerKg)) {
      const minDose = minPerKg * weightKg;
      const maxDose = maxPerKg * weightKg;
      return `${labelName}: FDA label notes ${minPerKg}-${maxPerKg} mg/kg. For ${weightKg} kg this maps to ${formatDoseValue(minDose)}-${formatDoseValue(maxDose)} mg per dose. Clinician confirmation required.`;
    }
  }

  const singleMatch = sentence.match(/(\d+(?:\.\d+)?)\s*mg\s*\/\s*kg/i);
  if (!singleMatch) {
    return undefined;
  }

  const perKg = Number(singleMatch[1]);
  if (!Number.isFinite(perKg)) {
    return undefined;
  }

  const dose = perKg * weightKg;
  return `${labelName}: FDA label notes ${perKg} mg/kg. For ${weightKg} kg this maps to about ${formatDoseValue(dose)} mg per dose. Clinician confirmation required.`;
}

function deriveDosingInsights(results: any[], patientAge?: number, patientWeightKg?: number) {
  const insights: string[] = [];

  for (const result of results) {
    if (insights.length >= MAX_DOSING_INSIGHTS) {
      break;
    }

    const labelName = pickLabelName(result);
    const dosageBlocks = [
      ...normalizeLabelText(result?.dosage_and_administration),
      ...normalizeLabelText(result?.pediatric_use),
      ...normalizeLabelText(result?.geriatric_use)
    ];

    for (const block of dosageBlocks) {
      if (insights.length >= MAX_DOSING_INSIGHTS) {
        break;
      }

      const sentences = sentenceSplit(block).filter((sentence) => sentenceMatchesAgeProfile(sentence, patientAge));
      for (const sentence of sentences) {
        if (insights.length >= MAX_DOSING_INSIGHTS) {
          break;
        }

        if (patientWeightKg) {
          const weightBased = deriveWeightBasedInsight(sentence, patientWeightKg, labelName);
          if (weightBased) {
            insights.push(weightBased);
            continue;
          }
        }

        if (/\b(?:mg\s*\/\s*kg|dosage|dose|pediatric|geriatric|children|adult)\b/i.test(sentence)) {
          const compact = sentence.replace(/\s+/g, " ").trim().slice(0, 220);
          insights.push(`${labelName}: ${compact} Clinician confirmation required.`);
        }
      }
    }
  }

  return [...new Set(insights)].slice(0, MAX_DOSING_INSIGHTS);
}

function extractDrugQuery(query: string): string | undefined {
  const fromDirective = query.match(/drug\s*:\s*([^\n]+)/i)?.[1]?.trim();
  if (fromDirective && fromDirective.length > 0) {
    return fromDirective;
  }

  const maybeDrug = query.match(/\b(?:medicine|drug|tablet|medication|for)\s+([a-z0-9\-\s]{3,60})/i)?.[1]?.trim();
  if (maybeDrug && maybeDrug.length > 0) {
    return maybeDrug;
  }

  return undefined;
}

function isTimeoutError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /timed out|timeout|abort/i.test(error.message);
}

async function lookupDrugHints(query?: string, patientAge?: number, patientWeightKg?: number): Promise<DrugLookupResult> {
  if (!query) return { hints: [], dosingInsights: [], timedOut: false, failed: false };

  try {
    const results = await fetchDrugData(query, 3, { timeoutMs: BG_TOOL_TIMEOUT_MS });
    const hints = results
      .map((item: any) => item?.openfda?.generic_name?.[0])
      .filter((value: unknown): value is string => typeof value === "string" && value.length > 0);

    const dosingInsights = deriveDosingInsights(results, patientAge, patientWeightKg);
    return { hints, dosingInsights, timedOut: false, failed: false };
  } catch (error) {
    const timedOut = isTimeoutError(error);
    return { hints: [], dosingInsights: [], timedOut, failed: !timedOut };
  }
}

export async function runBgAgent(input: BgAgentInput): Promise<BgAgentResult> {
  assertBgModel(input.model);
  assertToolsAllowedOnlyForBg(input.enableTools ?? true);

  const budget = buildContextBudget(input.model);
  const fittedMessages = fitMessagesToBudget(input.messages, budget);
  const prompt = fittedMessages.map((message) => `[${message.role}] ${message.content}`).join("\n");
  const promptPreview = truncateTextToBudget(prompt, budget);

  const loopState = input.loopState ?? {
    iteration: 1,
    repeatedCallCount: 0,
    noProgressCount: 0
  };
  const shouldStop = shouldStopLoop(loopState);

  const safetyInterventions: string[] = [];
  const emergencySignal = containsEmergencySignal(`${input.query ?? ""}\n${promptPreview}`);

  let routeDecision: BgAgentResult["routeDecision"] = "bg_planning";
  let lookupStatus: BgAgentResult["lookupStatus"] = "not_requested";
  let escalationTemplate: string | undefined;
  let drugHints: string[] = [];
  let dosingInsights: string[] = [];

  const patientAgeFromInput = normalizePatientAge(input.patientAge);
  const patientWeightFromInput = normalizePatientWeightKg(input.patientWeightKg);
  const patientAge = patientAgeFromInput ?? extractAgeFromQuery(input.query ?? promptPreview);
  const patientWeightKg = patientWeightFromInput ?? extractWeightKgFromQuery(input.query ?? promptPreview);

  const actions = [shouldStop ? "stop_loop_guard" : "continue_bg_planning"];

  if (emergencySignal) {
    routeDecision = "emergency_escalation";
    escalationTemplate = buildEmergencyEscalationTemplate();
    safetyInterventions.push("emergency_escalation_template");
    actions.push("safety_emergency_escalation_template");
  } else {
    let drugQuery = extractDrugQuery(input.query ?? promptPreview);
    
    if (!drugQuery && input.enableTools) {
      const openrouter = getOpenRouterClient();
      try {
        const completion: any = await openrouter.chat.completions.create({
          model: input.model,
          messages: [
            { role: "system", content: "You are a clinical assistant tool orchestrator. If the user context requires information about a medicine, drug, or prescription, call the 'search_fda' tool with the exact name. Otherwise output 'none'." },
            { role: "user", content: input.query ?? promptPreview }
          ],
          tools: [{
            type: "function",
            function: {
              name: "search_fda",
              description: "Search FDA database using a specific drug or medicine name.",
              parameters: {
                type: "object",
                properties: { query: { type: "string", description: "The specific drug name (e.g. Tylenol, Aspirin, Ibuprofen)" } },
                required: ["query"]
              }
            }
          }],
          tool_choice: "auto",
          temperature: 0,
          max_tokens: 100
        } as any);

        const tc = completion.choices?.[0]?.message?.tool_calls?.find((c: any) => c.function.name === "search_fda");
        if (tc && tc.function.arguments) {
          try {
            drugQuery = JSON.parse(tc.function.arguments).query;
            actions.push("ai_tool_fda_query_generated");
          } catch (e) {}
        }
      } catch (e) {
        // Fallback to undefined if LLM fails
      }
    }

    const lookup = await lookupDrugHints(drugQuery, patientAge, patientWeightKg);
    drugHints = lookup.hints;
    dosingInsights = lookup.dosingInsights;

    if (drugQuery) {
      routeDecision = "drug_lookup";
      lookupStatus = lookup.timedOut ? "timed_out" : lookup.failed ? "failed" : "completed";
    }

    if (drugHints.length > 0) {
      actions.push("medical_lookup_openfda");
    }
    if (lookup.timedOut) {
      actions.push("medical_lookup_timeout");
    }
    if (lookup.failed) {
      actions.push("medical_lookup_failed");
    }
    if (dosingInsights.length > 0) {
      actions.push("medical_dosing_age_weight_context");
    }
  }

  return {
    sessionId: input.sessionId,
    model: input.model,
    budget,
    usedPromptChars: promptPreview.length,
    promptPreview,
    actions,
    shouldStop,
    drugHints,
    routeDecision,
    lookupStatus,
    safetyInterventions,
    dosingInsights,
    patientContext: {
      age: patientAge,
      weightKg: patientWeightKg
    },
    escalationTemplate
  };
}
