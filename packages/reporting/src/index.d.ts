import type { SessionMemory, UiMessage } from "@rhc/types/index";
export type SessionReportInput = {
    sessionId: string;
    memory: SessionMemory;
    uiMessages: UiMessage[];
    generatedBy?: string;
};
export type SessionReport = {
    sessionId: string;
    generatedAt: string;
    markdown: string;
};
export declare function buildSessionReport(input: SessionReportInput): SessionReport;
