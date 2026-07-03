import type { ScheduledJob, ScheduledJobType } from "@rhc/types";
import { dbScheduleJob, dbListScheduledJobs, dbRunDueJobs, dbResetJobsStore, getNextJobSequence } from "@rhc/db";

type ScheduleJobInput = {
	sessionId: string;
	type: ScheduledJobType;
	runAt?: number;
	payload?: Record<string, unknown>;
};

function nowIso() {
	return new Date().toISOString();
}

export async function scheduleJob(input: ScheduleJobInput): Promise<ScheduledJob> {
	const id = `job_${getNextJobSequence()}`;
	const timestamp = nowIso();

	const job: ScheduledJob = {
		id,
		sessionId: input.sessionId,
		type: input.type,
		status: "queued",
		runAt: input.runAt ?? Date.now(),
		attempts: 0,
		payload: input.payload,
		createdAt: timestamp,
		updatedAt: timestamp
	};

	await dbScheduleJob(job);
	return job;
}

export async function listScheduledJobs(sessionId?: string): Promise<ScheduledJob[]> {
	return dbListScheduledJobs(sessionId);
}

export async function runDueJobs(nowMs = Date.now(), maxJobs = 25, sessionId?: string): Promise<ScheduledJob[]> {
	return dbRunDueJobs(nowMs, maxJobs, sessionId);
}

export async function resetSchedulerForTests(): Promise<void> {
	dbResetJobsStore();
}
