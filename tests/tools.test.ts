import { describe, it, expect } from "vitest";
import { buildContextBudget, truncateTextToBudget, fitMessagesToBudget } from "@rhc/tools";
import type { BgPromptMessage } from "@rhc/types";

describe("Tools & Context Budgeting", () => {
  it("builds a safe context budget for a given model", () => {
    const budget = buildContextBudget("openai/gpt-4o-mini");
    expect(budget.model).toBe("openai/gpt-4o-mini");
    expect(budget.availablePromptChars).toBeGreaterThan(1000);
  });

  it("truncates text when exceeding budget", () => {
    const budget = {
      model: "test",
      maxContextTokens: 100,
      reservedResponseTokens: 50,
      availablePromptTokens: 50,
      availablePromptChars: 20
    };

    const longText = "This is a very long string that will certainly exceed the tiny budget.";
    const truncated = truncateTextToBudget(longText, budget);
    expect(truncated).toContain("[truncated");
  });

  it("fits message history within context budget", () => {
    const budget = {
      model: "test",
      maxContextTokens: 100,
      reservedResponseTokens: 50,
      availablePromptTokens: 50,
      availablePromptChars: 80
    };

    const messages: BgPromptMessage[] = [
      { role: "user", content: "Short message 1" },
      { role: "assistant", content: "Short message 2" },
      { role: "user", content: "Short message 3" }
    ];

    const fitted = fitMessagesToBudget(messages, budget);
    expect(fitted.length).toBeGreaterThan(0);
    expect(fitted.length).toBeLessThanOrEqual(messages.length);
  });
});
