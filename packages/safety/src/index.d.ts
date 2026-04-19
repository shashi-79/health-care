export declare function containsEmergencySignal(text: string): boolean;
export declare function redactSensitiveText(text: string): string;
export declare function sanitizeAssistantResponse(text: string): string;
export declare function hasDosageInstruction(text: string): boolean;
export declare function hasDiagnosisCertaintyClaim(text: string): boolean;
export type AssistantSafetyReview = {
	text: string;
	interventions: string[];
};
export declare function buildEmergencyEscalationTemplate(symptoms?: string[]): string;
export declare function applyAssistantGuardrails(text: string): AssistantSafetyReview;
