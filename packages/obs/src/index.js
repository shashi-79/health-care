const eventStore = [];
let eventIdSequence = 0;
function nowIso() {
    return new Date().toISOString();
}
function cloneEvent(event) {
    return {
        ...event,
        details: event.details ? { ...event.details } : undefined
    };
}
export function logEvent(input) {
    const event = {
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
export function listEvents(filter) {
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
