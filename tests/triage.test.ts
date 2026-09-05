import { describe, it, expect } from "vitest";
import { classifySymptoms } from "@rhc/triage";

describe("Triage Engine", () => {
  it("classifies emergency symptoms correctly", () => {
    const result = classifySymptoms(["Patient has chest pain and shortness of breath"]);
    expect(result.level).toBe("emergency");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("classifies seizure as emergency", () => {
    const result = classifySymptoms(["seizure"]);
    expect(result.level).toBe("emergency");
  });

  it("classifies moderate symptoms correctly", () => {
    const result = classifySymptoms(["fever 3 days", "persistent cough"]);
    expect(result.level).toBe("moderate");
    expect(result.reasons[0]).toContain("Moderate-risk");
  });

  it("classifies mild symptoms correctly", () => {
    const result = classifySymptoms(["mild fatigue", "sneezing"]);
    expect(result.level).toBe("mild");
    expect(result.reasons[0]).toContain("No high-risk");
  });

  it("handles empty symptom lists gracefully", () => {
    const result = classifySymptoms([]);
    expect(result.level).toBe("mild");
  });
});
