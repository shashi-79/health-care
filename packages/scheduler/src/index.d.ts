import type { ScheduledJob, ScheduledJobType } from "@rhc/types/index";
type ScheduleJobInput = {
    sessionId: string;
    type: ScheduledJobType;
    runAt?: number;
    payload?: Record<string, unknown>;
};
export declare function scheduleJob(input: ScheduleJobInput): ScheduledJob;
export declare function listScheduledJobs(sessionId?: string): ScheduledJob[];
export declare function runDueJobs(nowMs?: number, maxJobs?: number): ScheduledJob[];
export declare function resetSchedulerForTests(): void;
export {};
