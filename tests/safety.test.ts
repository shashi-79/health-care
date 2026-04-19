import { describe, expect, it } from "vitest";
import {
  applyAssistantGuardrails,
  buildEmergencyEscalationTemplate,
  containsEmergencySignal,
  hasDiagnosisCertaintyClaim,
  hasDosageInstruction,
  redactSensitiveText,
  sanitizeAssistantResponse
} from "../packages/safety/src/index.ts";

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

  it("detects dosage and diagnosis-certainty language", () => {
    expect(hasDosageInstruction("Take 500 mg every 6 hours")).toBe(true);
    expect(hasDiagnosisCertaintyClaim("This is definitely pneumonia.")).toBe(true);
  });

  it("applies assistant guardrails to remove unsafe clinical certainty and dosage", () => {
    const review = applyAssistantGuardrails(
      "Take 500 mg every 6 hours. This is definitely pneumonia. Continue hydration."
    );

    expect(review.interventions).toContain("dosage_instruction_removed");
    expect(review.interventions).toContain("diagnosis_certainty_claim_removed");
    expect(review.text.toLowerCase()).not.toContain("500 mg");
    expect(review.text.toLowerCase()).not.toContain("definitely pneumonia");
  });

  it("builds emergency escalation template", () => {
    const template = buildEmergencyEscalationTemplate(["chest pain", "shortness of breath"]);
    expect(template.toLowerCase()).toContain("emergency");
    expect(template.toLowerCase()).toContain("chest pain");
  });
});
