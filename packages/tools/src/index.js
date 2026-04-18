const DEFAULT_CONTEXT_WINDOW_TOKENS = 64_000;
const AVG_CHARS_PER_TOKEN = 4;
const MODEL_CONTEXT_WINDOWS = {
    "anthropic/claude-haiku-4.5": 200_000,
    "anthropic/claude-haiku-3.5": 200_000,
    "anthropic/claude-sonnet-4": 200_000,
    "openai/gpt-4o": 128_000,
    "openai/gpt-4o-mini": 128_000
};
function normalizeModel(model) {
    return model.trim().toLowerCase();
}
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
export function getModelContextWindow(model) {
    const normalized = normalizeModel(model);
    for (const [key, value] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
        if (normalized === key || normalized.startsWith(`${key}:`)) {
            return value;
        }
    }
    return DEFAULT_CONTEXT_WINDOW_TOKENS;
}
export function buildContextBudget(model, reservedResponseTokens = 8_000) {
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
export function truncateTextToBudget(text, budget) {
    if (text.length <= budget.availablePromptChars) {
        return text;
    }
    const kept = text.slice(text.length - budget.availablePromptChars);
    return `[truncated ${text.length - kept.length} chars]\n${kept}`;
}
export function fitMessagesToBudget(messages, budget) {
    const filtered = messages.filter((message) => message.content.trim().length > 0);
    if (filtered.length === 0) {
        return [];
    }
    const selected = [];
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
export function coerceStringArray(input) {
    if (Array.isArray(input)) {
        return input
            .filter((value) => typeof value === "string")
            .map((value) => value.trim())
            .filter((value) => value.length > 0);
    }
    if (typeof input === "string") {
        const value = input.trim();
        return value.length > 0 ? [value] : [];
    }
    return [];
}
