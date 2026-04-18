import type { ObservationEvent, ObservationLevel } from "@rhc/types/index";

type LogEventInput = {
	category: string;
	action: string;
	level?: ObservationLevel;
	sessionId?: string;
	details?: Record<string, unknown>;
};

const eventStore: ObservationEvent[] = [];
let eventIdSequence = 0;

function nowIso() {
	return new Date().toISOString();
}

function cloneEvent(event: ObservationEvent): ObservationEvent {
	return {
		...event,
		details: event.details ? { ...event.details } : undefined
	};
}

export function logEvent(input: LogEventInput): ObservationEvent {
	const event: ObservationEvent = {
		id: ++eventIdSequence,
		category: input.category,
		action: input.action,
		level: input.level ?? "info",
		sessionId: input.sessionId,
		details: input.details,
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
