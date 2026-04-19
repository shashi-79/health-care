import type { BgPromptMessage, ContextBudget } from "@rhc/types";
import { type LoopState } from "./loop-guard";
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
export declare function runBgAgent(input: BgAgentInput): Promise<BgAgentResult>;
