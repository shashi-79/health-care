import type { BgPromptMessage, ContextBudget } from "@rhc/types";

const DEFAULT_CONTEXT_WINDOW_TOKENS = 64_000;
const AVG_CHARS_PER_TOKEN = 4;

function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value));
}

function getModelContextWindow(model: string): number {
	return DEFAULT_CONTEXT_WINDOW_TOKENS;
}

export function buildContextBudget(model: string, reservedResponseTokens = 8_000): ContextBudget {
	const maxContextTokens = getModelContextWindow(model);
	const safeReservedTokens = clamp(reservedResponseTokens, 512, Math.floor(maxContextTokens * 0.4));
	const availablePromptTokens = Math.max(1_024, maxContextTokens - safeReservedTokens);

	return {
		model,
		maxContextTokens,
		reservedResponseTokens: safeReservedTokens,
		availablePromptTokens,
		availablePromptChars: availablePromptTokens * AVG_CHARS_PER_TOKEN
	};
}

export function truncateTextToBudget(text: string, budget: ContextBudget): string {
	if (text.length <= budget.availablePromptChars) {
		return text;
	}

	const kept = text.slice(text.length - budget.availablePromptChars);
	return `[truncated ${text.length - kept.length} chars]\n${kept}`;
}

export function fitMessagesToBudget(messages: BgPromptMessage[], budget: ContextBudget): BgPromptMessage[] {
	const filtered = messages.filter((message) => message.content.trim().length > 0);

	if (filtered.length === 0) {
		return [];
	}

	const selected: BgPromptMessage[] = [];
	let usedChars = 0;

	for (let i = filtered.length - 1; i >= 0; i -= 1) {
		const candidate = filtered[i];
		const nextCost = candidate.content.length + 24;

		if (usedChars + nextCost > budget.availablePromptChars) {
			if (selected.length === 0) {
				selected.unshift({
					...candidate,
					content: truncateTextToBudget(candidate.content, budget)
				});
			}
			break;
		}

		selected.unshift(candidate);
		usedChars += nextCost;
	}

	return selected;
}

