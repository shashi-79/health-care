import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchDrugDataMock } = vi.hoisted(() => ({
  fetchDrugDataMock: vi.fn()
}));

vi.mock("@rhc/medical/fda", () => ({
  fetchDrugData: fetchDrugDataMock
}));

import { runBgAgent } from "../packages/agents/src/bg-agent.ts";

describe("bg agent dosing insights", () => {
  beforeEach(() => {
    fetchDrugDataMock.mockReset();
  });

  it("derives age/weight-aware dosing insights from FDA label text", async () => {
    fetchDrugDataMock.mockResolvedValueOnce([
      {
        openfda: {
          generic_name: ["Paracetamol"]
        },
        dosage_and_administration: ["Pediatric dose is 10 to 15 mg/kg every 4 to 6 hours."]
      }
    ]);

    const result = await runBgAgent({
      sessionId: "s1",
      model: "anthropic/claude-haiku-4.5",
      messages: [{ role: "user", content: "Need help" }],
      query: "drug: paracetamol for fever",
      patientAge: 6,
      patientWeightKg: 20,
      enableTools: true
    });

    expect(result.routeDecision).toBe("drug_lookup");
    expect(result.lookupStatus).toBe("completed");
    expect(result.dosingInsights.length).toBeGreaterThan(0);
    expect(result.dosingInsights[0]).toContain("200-300 mg");
    expect(result.actions).toContain("medical_dosing_age_weight_context");
  });

  it("parses age and weight from query text when profile is not supplied", async () => {
    fetchDrugDataMock.mockResolvedValueOnce([
      {
        openfda: {
          generic_name: ["Amoxicillin"]
        },
        dosage_and_administration: ["Children: 20 mg/kg once daily."]
      }
    ]);

    const result = await runBgAgent({
      sessionId: "s2",
      model: "anthropic/claude-haiku-4.5",
      messages: [{ role: "user", content: "Need dosage" }],
      query: "drug: amoxicillin age 4 weight 16 kg",
      enableTools: true
    });

    expect(result.patientContext.age).toBe(4);
    expect(result.patientContext.weightKg).toBe(16);
    expect(result.dosingInsights[0]).toContain("320 mg");
  });
});
