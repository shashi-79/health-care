import { describe, it, expect } from "vitest";
import {
  applyAssistantGuardrails,
  containsEmergencySignal,
  redactSensitiveText,
  hasDosageInstruction,
  hasDiagnosisCertaintyClaim,
  buildEmergencyEscalationTemplate
} from "@rhc/safety";

describe("Safety Guardrails", () => {
  it("detects emergency signals in user text", () => {
    expect(containsEmergencySignal("I am having severe chest pain right now")).toBe(true);
    expect(containsEmergencySignal("Shortness of breath and vision loss")).toBe(true);
    expect(containsEmergencySignal("I just have a mild cold")).toBe(false);
  });

  it("redacts sensitive personal information like emails, phone numbers, and IDs", () => {
    const text = "Contact john.doe@example.com or call 9876543210 or Aadhaar 1234 5678 9012";
    const redacted = redactSensitiveText(text);
    expect(redacted).not.toContain("john.doe@example.com");
    expect(redacted).not.toContain("9876543210");
    expect(redacted).toContain("[redacted-email]");
    expect(redacted).toContain("[redacted-number]");
  });

  it("detects dosage instructions", () => {
    expect(hasDosageInstruction("Take 500mg tablet twice daily")).toBe(true);
    expect(hasDosageInstruction("Take 2 capsules every 6 hours")).toBe(true);
    expect(hasDosageInstruction("Drink plenty of water and get rest")).toBe(false);
  });

  it("detects diagnosis certainty claims", () => {
    expect(hasDiagnosisCertaintyClaim("You definitely have an infection")).toBe(true);
    expect(hasDiagnosisCertaintyClaim("The diagnosis is confirmed pneumonia")).toBe(true);
    expect(hasDiagnosisCertaintyClaim("These symptoms might be related to a common cold")).toBe(false);
  });

  it("strips dosage instructions and attaches safety guidance", () => {
    const response = "Take 500mg every 8 hours. Make sure to rest and stay hydrated.";
    const review = applyAssistantGuardrails(response);
    expect(review.interventions).toContain("dosage_instruction_removed");
    expect(review.text).toContain("Please ask a licensed clinician or pharmacist for exact medication dosing.");
  });

  it("builds emergency escalation templates", () => {
    const template = buildEmergencyEscalationTemplate(["chest pain", "shortness of breath"]);
    expect(template).toContain("chest pain");
    expect(template).toContain("Seek immediate in-person care");
  });
});
