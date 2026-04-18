export type TriageLevel = "mild" | "moderate" | "emergency";
export type TriageResult = {
    level: TriageLevel;
    reasons: string[];
};
export declare function classifySymptoms(symptoms: string[]): TriageResult;
