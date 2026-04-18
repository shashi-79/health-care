export type Role = "system" | "user" | "assistant";
export type UiMessage = {
    sessionId: string;
    role: Exclude<Role, "system">;
    content: string;
    createdAt: string;
};
export type ChatMessage = {
    role: Role;
    content: string;
};
export type RootDetails = {
    age?: number;
    weightKg?: number;
    gender?: string;
    location?: string;
    primaryLanguage?: string;
};
export type SessionMemory = {
    sessionId: string;
    rootDetails?: RootDetails;
    currentIllness?: string;
    pastIllnesses: string[];
    riskFlags: string[];
    updatedAt: string;
};
export type SessionMemoryPatch = {
    rootDetails?: RootDetails;
    currentIllness?: string;
    pastIllnesses?: string[];
    riskFlags?: string[];
};
export type BgPromptMessage = {
    role: Role;
    content: string;
};
export type ContextBudget = {
    model: string;
    maxContextTokens: number;
    reservedResponseTokens: number;
    availablePromptTokens: number;
    availablePromptChars: number;
};
export type ScheduledJobStatus = "queued" | "running" | "done" | "failed";
export type ScheduledJobType = "follow_up_checkin" | "consolidate_call" | "bg_task";
export type ScheduledJob = {
    id: string;
    sessionId: string;
    type: ScheduledJobType;
    status: ScheduledJobStatus;
    runAt: number;
    attempts: number;
    payload?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
};
export type ObservationLevel = "info" | "warn" | "error";
export type ObservationEvent = {
    id: number;
    category: string;
    action: string;
    level: ObservationLevel;
    sessionId?: string;
    details?: Record<string, unknown>;
    createdAt: string;
};
//# sourceMappingURL=index.d.ts.map