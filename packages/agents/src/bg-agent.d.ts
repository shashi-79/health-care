import type { BgPromptMessage, ContextBudget } from "@rhc/types/index";
import { type LoopState } from "./loop-guard";
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
export declare function runBgAgent(input: BgAgentInput): Promise<BgAgentResult>;
