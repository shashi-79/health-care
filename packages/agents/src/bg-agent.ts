import { fetchDrugData } from "@rhc/medical/fda";
import { assertBgModel, assertToolsAllowedOnlyForBg } from "@rhc/policy/routing";
import { buildContextBudget, fitMessagesToBudget, truncateTextToBudget } from "@rhc/tools/index";
import type { BgPromptMessage, ContextBudget } from "@rhc/types/index";
import { shouldStopLoop, type LoopState } from "./loop-guard";

export type BgAgentInput = {
  sessionId: string;
  model: string;
  messages: BgPromptMessage[];
  query?: string;
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
};

function extractDrugQuery(query: string): string | undefined {
  const fromDirective = query.match(/drug\s*:\s*([^\n]+)/i)?.[1]?.trim();
  if (fromDirective && fromDirective.length > 0) {
    return fromDirective;
  }

  const maybeDrug = query.match(/\b(?:medicine|drug|tablet)\s+([a-z0-9\-\s]{3,60})/i)?.[1]?.trim();
  if (maybeDrug && maybeDrug.length > 0) {
    return maybeDrug;
  }

  return undefined;
}

async function lookupDrugHints(query?: string): Promise<string[]> {
  if (!query) return [];

  try {
    const results = await fetchDrugData(query, 2);
    return results
      .map((item: any) => item?.openfda?.generic_name?.[0])
      .filter((value: unknown): value is string => typeof value === "string" && value.length > 0);
  } catch {
    return [];
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

  const drugQuery = extractDrugQuery(input.query ?? promptPreview);
  const drugHints = await lookupDrugHints(drugQuery);

  const actions = [shouldStop ? "stop_loop_guard" : "continue_bg_planning"];
  if (drugHints.length > 0) {
    actions.push("medical_lookup_openfda");
  }

  return {
    sessionId: input.sessionId,
    model: input.model,
    budget,
    usedPromptChars: promptPreview.length,
    promptPreview,
    actions,
    shouldStop,
    drugHints
  };
}
