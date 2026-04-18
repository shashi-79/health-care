const jobStore = new Map();
let sequence = 0;
function nowIso() {
    return new Date().toISOString();
}
function cloneJob(job) {
    return {
        ...job,
        payload: job.payload ? { ...job.payload } : undefined
    };
}
export function scheduleJob(input) {
    const id = `job_${++sequence}`;
    const timestamp = nowIso();
    const job = {
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
    return cloneJob(job);
}
export function listScheduledJobs(sessionId) {
    return [...jobStore.values()]
        .filter((job) => (sessionId ? job.sessionId === sessionId : true))
        .sort((a, b) => a.runAt - b.runAt)
        .map((job) => cloneJob(job));
}
export function runDueJobs(nowMs = Date.now(), maxJobs = 25) {
    const dueJobs = [...jobStore.values()]
        .filter((job) => job.status === "queued" && job.runAt <= nowMs)
        .sort((a, b) => a.runAt - b.runAt)
        .slice(0, maxJobs);
    const completed = [];
    for (const job of dueJobs) {
        const running = {
            ...job,
            status: "running",
            attempts: job.attempts + 1,
            updatedAt: nowIso()
        };
        jobStore.set(job.id, running);
        const done = {
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
