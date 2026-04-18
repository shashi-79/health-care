import { describe, expect, it } from "vitest";
import { classifySymptoms } from "../packages/triage/src/engine";

describe("classifySymptoms", () => {
  it("returns emergency for emergency signals", () => {
    const result = classifySymptoms(["Chest pain and dizziness"]);
    expect(result.level).toBe("emergency");
  });

  it("returns moderate for prolonged fever/cough patterns", () => {
    const result = classifySymptoms(["Fever 3 days and persistent cough"]);
    expect(result.level).toBe("moderate");
  });

  it("returns mild for low-risk symptom text", () => {
    const result = classifySymptoms(["mild headache after field work"]);
    expect(result.level).toBe("mild");
  });
});
