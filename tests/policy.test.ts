import { describe, it, expect } from "vitest";
import {
  assertChatModel,
  assertBgModel,
  assertCallModel,
  assertToolsAllowedOnlyForBg,
  HUMAN_PERSONA_POLICY,
  AI_DISCLOSURE_REGEX
} from "@rhc/policy";

describe("Policy Engine", () => {
  it("validates model assertion functions", () => {
    expect(() => assertChatModel("openai/gpt-4o-mini")).not.toThrow();
    expect(() => assertChatModel("")).toThrow("Chat model is not configured.");

    expect(() => assertBgModel("anthropic/claude-haiku-4.5")).not.toThrow();
    expect(() => assertBgModel("")).toThrow("BG model is not configured.");

    expect(() => assertCallModel("gemini-2.5-flash-native-audio-latest")).not.toThrow();
    expect(() => assertCallModel("")).toThrow("Call model is not configured.");
  });

  it("restricts tools exclusively to background agent context", () => {
    expect(() => assertToolsAllowedOnlyForBg(true)).not.toThrow();
    expect(() => assertToolsAllowedOnlyForBg(false)).toThrow(
      "Tools are restricted to BG agent context."
    );
  });

  it("defines human persona policy that avoids AI self-disclosure", () => {
    expect(HUMAN_PERSONA_POLICY).toContain("empathetic");
    expect(AI_DISCLOSURE_REGEX.test("As an AI language model")).toBe(true);
    expect(AI_DISCLOSURE_REGEX.test("I am your care coordinator")).toBe(false);
  });
});
