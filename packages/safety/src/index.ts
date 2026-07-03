const EMERGENCY_PATTERNS = [
  /chest pain/i,
  /shortness of breath/i,
  /severe bleeding/i,
  /unconscious/i,
  /fainting repeatedly/i,
  /stroke symptoms/i,
  /seizure/i,
  /suicidal/i,
  /not breathing/i,
  /vision loss/i,
  /severe headache/i,
  /allergic reaction/i
];

const AI_DISCLOSURE_PATTERN = /\b(as an ai|language model|chatbot|i am an ai)\b/gi;
const TEN_DIGIT_PATTERN = /\b\d{10}\b/g;
const TWELVE_DIGIT_PATTERN = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

const DOSAGE_PATTERNS = [
  /\b\d+(?:\.\d+)?\s?(?:mg|mcg|g|ml|mL|units?)\b/i,
  /\b(?:take|give|use|apply|start)\s+\d+(?:\.\d+)?\s?(?:tablet|tablets|capsule|capsules|drops?|puffs?|ml|mL|units?)\b/i,
  /\bevery\s+\d+\s?(?:hours?|hrs?|days?)\b/i,
  /\btwice daily\b/i,
  /\bonce daily\b/i,
  /\b(BID|TID|QID)\b/i
];

const DIAGNOSIS_CERTAINTY_PATTERNS = [
  /\b(?:this is|it is|you are)\s+(?:definitely|certainly|clearly|undoubtedly)\b/i,
  /\bconfirmed diagnosis\b/i,
  /\bno doubt\b/i,
  /\byou have\s+(?:a\s+)?(?:confirmed\s+)?(?:infection|pneumonia|stroke|heart attack|diabetes|cancer|asthma|covid)\b/i,
  /\bthe diagnosis is\b/i
];

export type AssistantSafetyReview = {
	text: string;
	interventions: string[];
};

function hasAnyPattern(text: string, patterns: RegExp[]) {
	return patterns.some((pattern) => pattern.test(text));
}

function splitSentences(text: string) {
	return text
		.split(/(?<=[.!?])\s+/)
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

export function containsEmergencySignal(text: string): boolean {
	return hasAnyPattern(text, EMERGENCY_PATTERNS);
}

export function redactSensitiveText(text: string): string {
	return text
		.replace(EMAIL_PATTERN, "[redacted-email]")
		.replace(TEN_DIGIT_PATTERN, "[redacted-number]")
		.replace(TWELVE_DIGIT_PATTERN, "[redacted-id]");
}

export function sanitizeAssistantResponse(text: string): string {
	const cleaned = text.replace(AI_DISCLOSURE_PATTERN, "").replace(/\s{2,}/g, " ").trim();
	return redactSensitiveText(cleaned);
}

export function hasDosageInstruction(text: string) {
	return hasAnyPattern(text, DOSAGE_PATTERNS);
}

export function hasDiagnosisCertaintyClaim(text: string) {
	return hasAnyPattern(text, DIAGNOSIS_CERTAINTY_PATTERNS);
}

export function buildEmergencyEscalationTemplate(symptoms?: string[]): string {
	const symptomLine = symptoms && symptoms.length > 0
		? ` Reported warning signs: ${symptoms.join(", ")}.`
		: "";

	return `Possible emergency warning signs detected.${symptomLine} Seek immediate in-person care now. Call local emergency services or go to the nearest emergency facility without delay. Do not wait for online advice while symptoms are severe.`;
}

export function applyAssistantGuardrails(text: string): AssistantSafetyReview {
	const interventions: string[] = [];
	
	const dataUrlMatches: string[] = [];
	const placeholderText = text.replace(/\[([^\]]+)\]\((data:[^)]+)\)/g, (match) => {
		dataUrlMatches.push(match);
		return `__DATA_URL_LINK_${dataUrlMatches.length - 1}__`;
	});

	const cleaned = sanitizeAssistantResponse(placeholderText);
	const sentences = splitSentences(cleaned);

	let nextSentences = sentences;

	if (sentences.some((sentence) => hasDosageInstruction(sentence))) {
		interventions.push("dosage_instruction_removed");
		nextSentences = nextSentences.filter((sentence) => !hasDosageInstruction(sentence));
	}

	if (nextSentences.some((sentence) => hasDiagnosisCertaintyClaim(sentence))) {
		interventions.push("diagnosis_certainty_claim_removed");
		nextSentences = nextSentences.filter((sentence) => !hasDiagnosisCertaintyClaim(sentence));
	}

	let nextText = nextSentences.join(" ").trim();

	if (interventions.includes("dosage_instruction_removed")) {
		nextText = `${nextText} Please ask a licensed clinician or pharmacist for exact medication dosing.`.trim();
	}

	if (interventions.includes("diagnosis_certainty_claim_removed")) {
		nextText = `${nextText} I cannot confirm a diagnosis in chat; an in-person clinical exam is required.`.trim();
	}

	if (!nextText) {
		nextText = "Please seek in-person clinical assessment for safe next steps.";
	}

	let finalText = sanitizeAssistantResponse(nextText);
	dataUrlMatches.forEach((match, index) => {
		finalText = finalText.replace(`__DATA_URL_LINK_${index}__`, match);
	});

	return {
		text: finalText,
		interventions
	};
}
