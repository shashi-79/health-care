import type { BgPromptMessage, ContextBudget } from "@rhc/types/index";
export declare function getModelContextWindow(model: string): number;
export declare function buildContextBudget(model: string, reservedResponseTokens?: number): ContextBudget;
export declare function truncateTextToBudget(text: string, budget: ContextBudget): string;
export declare function fitMessagesToBudget(messages: BgPromptMessage[], budget: ContextBudget): BgPromptMessage[];
export declare function coerceStringArray(input: unknown): string[];
//# sourceMappingURL=index.d.ts.map