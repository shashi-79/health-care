import type { ObservationEvent, ObservationLevel } from "@rhc/types/index";
import { redactSensitiveText } from "@rhc/safety/index";

type LogEventInput = {
	category: string;
	action: string;
	level?: ObservationLevel;
	sessionId?: string;
	details?: Record<string, unknown>;
};

const eventStore: ObservationEvent[] = [];
let eventIdSequence = 0;

const SENSITIVE_KEY_PATTERN = /(?:name|phone|contact|email|address|aadhaar|patient|transcript|message|content|query|illness|symptom)/i;

function nowIso() {
	return new Date().toISOString();
}

function cloneEvent(event: ObservationEvent): ObservationEvent {
	return {
		...event,
		details: event.details ? { ...event.details } : undefined
	};
}

function sanitizeString(value: string, keyPath: string) {
	const redacted = redactSensitiveText(value.replace(/\s+/g, " ").trim());
	if (SENSITIVE_KEY_PATTERN.test(keyPath)) {
		if (redacted.length <= 32) {
			return "[redacted]";
		}
		return `[redacted:${redacted.slice(0, 32)}...]`;
	}

	if (redacted.length <= 220) {
		return redacted;
	}

	return `${redacted.slice(0, 220)}...`;
}

function sanitizeDetailValue(value: unknown, keyPath: string, depth: number): unknown {
	if (depth > 4) {
		return "[truncated]";
	}

	if (typeof value === "string") {
		return sanitizeString(value, keyPath);
	}

	if (typeof value === "number" || typeof value === "boolean" || value === null || value === undefined) {
		return value;
	}

	if (Array.isArray(value)) {
		return value.slice(0, 20).map((item, index) => sanitizeDetailValue(item, `${keyPath}[${index}]`, depth + 1));
	}

	if (typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>).slice(0, 40);
		const next: Record<string, unknown> = {};
		for (const [key, item] of entries) {
			next[key] = sanitizeDetailValue(item, `${keyPath}.${key}`, depth + 1);
		}
		return next;
	}

	return "[unsupported]";
}

function sanitizeDetails(details: Record<string, unknown> | undefined) {
	if (!details) {
		return undefined;
	}

	return sanitizeDetailValue(details, "details", 0) as Record<string, unknown>;
}

export function logEvent(input: LogEventInput): ObservationEvent {
	const event: ObservationEvent = {
		id: ++eventIdSequence,
		category: input.category,
		action: input.action,
		level: input.level ?? "info",
		sessionId: input.sessionId,
		details: sanitizeDetails(input.details),
		createdAt: nowIso()
	};

	eventStore.push(event);
	return cloneEvent(event);
}

export function listEvents(filter?: {
	category?: string;
	sessionId?: string;
	level?: ObservationLevel;
}): ObservationEvent[] {
	return eventStore
		.filter((event) => (filter?.category ? event.category === filter.category : true))
		.filter((event) => (filter?.sessionId ? event.sessionId === filter.sessionId : true))
		.filter((event) => (filter?.level ? event.level === filter.level : true))
		.map((event) => cloneEvent(event));
}

export function clearEventsForTests() {
	eventStore.length = 0;
	eventIdSequence = 0;
}
