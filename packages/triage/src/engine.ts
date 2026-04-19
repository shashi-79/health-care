export type TriageLevel = "mild" | "moderate" | "emergency";

export type TriageResult = {
  level: TriageLevel;
  reasons: string[];
};

export function classifySymptoms(symptoms: string[]): TriageResult {
  const s = symptoms.map((x) => x.toLowerCase());
  const emergencySignals = [
    "chest pain",
    "shortness of breath",
    "unconscious",
    "severe bleeding",
    "seizure",
    "stroke",
    "not breathing",
    "suicidal",
    "fainting"
  ];
  const moderateSignals = [
    "fever 3 days",
    "persistent cough",
    "dehydration",
    "vomiting",
    "dizziness",
    "headache",
    "rash"
  ];

  if (emergencySignals.some((sig) => s.some((v) => v.includes(sig)))) {
    return { level: "emergency", reasons: ["Emergency symptom pattern detected."] };
  }

  if (moderateSignals.some((sig) => s.some((v) => v.includes(sig)))) {
    return { level: "moderate", reasons: ["Moderate-risk symptom pattern detected."] };
  }

  return { level: "mild", reasons: ["No high-risk signal detected."] };
}
