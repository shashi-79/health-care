import type { ObservationEvent, ObservationLevel } from "@rhc/types";
type LogEventInput = {
    category: string;
    action: string;
    level?: ObservationLevel;
    sessionId?: string;
    details?: Record<string, unknown>;
};
export declare function logEvent(input: LogEventInput): ObservationEvent;
export declare function listEvents(filter?: {
    category?: string;
    sessionId?: string;
    level?: ObservationLevel;
}): ObservationEvent[];
export declare function clearEventsForTests(): void;
export {};
