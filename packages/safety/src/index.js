const EMERGENCY_PATTERNS = [
    /chest pain/i,
    /shortness of breath/i,
    /severe bleeding/i,
    /unconscious/i,
    /fainting repeatedly/i,
    /stroke symptoms/i
];
const AI_DISCLOSURE_PATTERN = /\b(as an ai|language model|chatbot|i am an ai)\b/gi;
const TEN_DIGIT_PATTERN = /\b\d{10}\b/g;
const TWELVE_DIGIT_PATTERN = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;
export function containsEmergencySignal(text) {
    return EMERGENCY_PATTERNS.some((pattern) => pattern.test(text));
}
export function redactSensitiveText(text) {
    return text
        .replace(TEN_DIGIT_PATTERN, "[redacted-number]")
        .replace(TWELVE_DIGIT_PATTERN, "[redacted-id]");
}
export function sanitizeAssistantResponse(text) {
    const cleaned = text.replace(AI_DISCLOSURE_PATTERN, "").replace(/\s{2,}/g, " ").trim();
    return redactSensitiveText(cleaned);
}
