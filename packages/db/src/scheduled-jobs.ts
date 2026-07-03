import { getDatabase } from "./pool";
import type { ScheduledJob } from "@rhc/types";

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

export async function dbScheduleJob(job: ScheduledJob): Promise<void> {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO scheduled_jobs (id, session_id, type, status, run_at, attempts, payload, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      job.id,
      job.sessionId,
      job.type,
      job.status,
      job.runAt,
      job.attempts,
      job.payload ? JSON.stringify(job.payload) : null,
      new Date(job.createdAt).toISOString(),
      new Date(job.updatedAt).toISOString()
    );
  } catch (error) {
    console.warn("[db] Failed to save scheduled job to SQLite:", error);
  }

  // Always write to memory
  jobStore.set(job.id, cloneJob(job));
}

export async function dbListScheduledJobs(sessionId?: string): Promise<ScheduledJob[]> {
  try {
    const db = getDatabase();
    let query = `SELECT id, session_id AS "sessionId", type, status, run_at AS "runAt", attempts, payload, created_at AS "createdAt", updated_at AS "updatedAt" FROM scheduled_jobs`;
    const params: any[] = [];
    if (sessionId) {
      query += ` WHERE session_id = ?`;
      params.push(sessionId);
    }
    query += ` ORDER BY run_at ASC`;
    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map((row: any) => ({
      id: row.id,
      sessionId: row.sessionId,
      type: row.type,
      status: row.status,
      runAt: Number(row.runAt),
      attempts: Number(row.attempts),
      payload: row.payload ? JSON.parse(row.payload) : undefined,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString()
    }));
  } catch (error) {
    console.warn("[db] Failed to list scheduled jobs from SQLite:", error);
  }

  // Fallback to memory
  return [...jobStore.values()]
    .filter((job) => (sessionId ? job.sessionId === sessionId : true))
    .sort((a, b) => a.runAt - b.runAt)
    .map((job) => cloneJob(job));
}

export async function dbRunDueJobs(nowMs = Date.now(), maxJobs = 25, sessionId?: string): Promise<ScheduledJob[]> {
  try {
    const db = getDatabase();
    
    const runTx = db.transaction((nowMs: number, maxJobs: number, sessionId?: string) => {
      let selectQuery = `
        SELECT id, session_id AS "sessionId", type, status, run_at AS "runAt", attempts, payload, created_at AS "createdAt", updated_at AS "updatedAt"
        FROM scheduled_jobs
        WHERE status = 'queued' AND run_at <= ?
      `;
      const params: any[] = [nowMs];
      if (sessionId) {
        selectQuery += ` AND session_id = ?`;
        params.push(sessionId);
      }
      selectQuery += ` ORDER BY run_at ASC LIMIT ?`;
      params.push(maxJobs);

      const selectStmt = db.prepare(selectQuery);
      const rows = selectStmt.all(...params) as any[];
      const completed: ScheduledJob[] = [];

      const updateStmt = db.prepare(`
        UPDATE scheduled_jobs
        SET status = 'done', attempts = ?, updated_at = ?
        WHERE id = ?
      `);

      for (const row of rows) {
        const attempts = Number(row.attempts) + 1;
        const timestamp = nowIso();
        
        updateStmt.run(attempts, new Date(timestamp).toISOString(), row.id);

        completed.push({
          id: row.id,
          sessionId: row.sessionId,
          type: row.type,
          status: "done",
          runAt: Number(row.runAt),
          attempts,
          payload: row.payload ? JSON.parse(row.payload) : undefined,
          createdAt: new Date(row.createdAt).toISOString(),
          updatedAt: timestamp
        });
      }
      return completed;
    });

    return runTx(nowMs, maxJobs, sessionId);
  } catch (error) {
    console.warn("[db] Failed to run due jobs in SQLite, falling back to memory:", error);
  }

  // Fallback to memory
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

export function dbResetJobsStore() {
  try {
    const db = getDatabase();
    db.exec("DELETE FROM scheduled_jobs");
  } catch (error) {
    console.warn("[db] Failed to reset scheduled jobs in SQLite:", error);
  }
  jobStore.clear();
  sequence = 0;
}

export function getNextJobSequence(): number {
  return ++sequence;
}
