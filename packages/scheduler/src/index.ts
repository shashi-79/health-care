import type { ScheduledJob, ScheduledJobType } from "@rhc/types";

type ScheduleJobInput = {
	sessionId: string;
	type: ScheduledJobType;
	runAt?: number;
	payload?: Record<string, unknown>;
};

const jobStore = new Map<string, ScheduledJob>();
let sequence = 0;

function nowIso() {
	return new Date().toISOString();
}

function cloneJob(job: ScheduledJob): ScheduledJob {
	return {
		...job,
		payload: job.payload ? { ...job.payload } : undefined
	};
}

export function scheduleJob(input: ScheduleJobInput): ScheduledJob {
	const id = `job_${++sequence}`;
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

	jobStore.set(id, job);

	if (jobStore.size > 1000) {
		const oldestKey = jobStore.keys().next().value;
		if (oldestKey) jobStore.delete(oldestKey);
	}

	return cloneJob(job);
}

export function listScheduledJobs(sessionId?: string): ScheduledJob[] {
	return [...jobStore.values()]
		.filter((job) => (sessionId ? job.sessionId === sessionId : true))
		.sort((a, b) => a.runAt - b.runAt)
		.map((job) => cloneJob(job));
}

export function runDueJobs(nowMs = Date.now(), maxJobs = 25, sessionId?: string): ScheduledJob[] {
        const dueJobs = [...jobStore.values()]
                .filter((job) => {
                        if (job.status !== "queued" || job.runAt > nowMs) return false;
                        if (sessionId && job.sessionId !== sessionId) return false;
                        return true;
                })
		.sort((a, b) => a.runAt - b.runAt)
		.slice(0, maxJobs);

	const completed: ScheduledJob[] = [];

	for (const job of dueJobs) {
		const running: ScheduledJob = {
			...job,
			status: "running",
			attempts: job.attempts + 1,
			updatedAt: nowIso()
		};
		jobStore.set(job.id, running);

		const done: ScheduledJob = {
			...running,
			status: "done",
			updatedAt: nowIso()
		};
		jobStore.set(job.id, done);
		completed.push(cloneJob(done));
	}

	return completed;
}

export function resetSchedulerForTests() {
	jobStore.clear();
	sequence = 0;
}
