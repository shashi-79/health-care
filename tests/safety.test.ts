import { describe, expect, it } from "vitest";
import {
  containsEmergencySignal,
  redactSensitiveText,
  sanitizeAssistantResponse
} from "../packages/safety/src/index";

describe("safety helpers", () => {
  it("detects emergency phrases", () => {
    expect(containsEmergencySignal("Patient reports chest pain since morning")).toBe(true);
  });

  it("redacts sensitive number patterns", () => {
    const redacted = redactSensitiveText("Phone 9876543210 and id 1234 5678 9999");
    expect(redacted).not.toContain("9876543210");
    expect(redacted).not.toContain("1234 5678 9999");
  });

  it("removes AI self-disclosure text", () => {
    const sanitized = sanitizeAssistantResponse("As an AI, I suggest rest and hydration.");
    expect(sanitized.toLowerCase()).not.toContain("as an ai");
  });
});
