import type { UiMessage } from "@rhc/types";
type AddUiMessageInput = {
    sessionId: string;
    role: UiMessage["role"];
    content: string;
    createdAt?: string;
};
export declare function addUiMessage(input: AddUiMessageInput): UiMessage;
export declare function listUiMessages(sessionId: string, limit?: number): UiMessage[];
export declare function clearUiMessages(sessionId?: string): void;
export declare function assertUiStoreIsolation(): string;
export {};
