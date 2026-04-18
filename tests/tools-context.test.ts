import { describe, expect, it } from "vitest";
import {
  buildContextBudget,
  fitMessagesToBudget,
  getModelContextWindow,
  truncateTextToBudget
} from "../packages/tools/src/index";

describe("context budget tools", () => {
  it("uses 200k context window for haiku 4.5", () => {
    const window = getModelContextWindow("anthropic/claude-haiku-4.5");
    expect(window).toBe(200_000);
  });

  it("truncates oversized text to budget", () => {
    const budget = {
      model: "test-model",
      maxContextTokens: 10_000,
      reservedResponseTokens: 9_000,
      availablePromptTokens: 1_000,
      availablePromptChars: 500
    };
    const text = "x".repeat(20_000);
    const truncated = truncateTextToBudget(text, budget);
    expect(truncated.length).toBeLessThanOrEqual(budget.availablePromptChars + 40);
  });

  it("keeps most recent messages when fitting to budget", () => {
    const budget = buildContextBudget("openai/gpt-4o-mini", 127_000);
    const messages = [
      { role: "system" as const, content: "A".repeat(1_500) },
      { role: "user" as const, content: "B".repeat(1_500) },
      { role: "assistant" as const, content: "C".repeat(1_500) }
    ];

    const fitted = fitMessagesToBudget(messages, budget);
    expect(fitted.length).toBeGreaterThan(0);
    expect(fitted[fitted.length - 1]?.content).toContain("C");
  });
});
