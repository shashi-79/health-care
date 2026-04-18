import { logEvent } from "@rhc/obs/index";
import { listScheduledJobs, runDueJobs, scheduleJob } from "@rhc/scheduler/index";
import type { ScheduledJobType } from "@rhc/types/index";
import { NextRequest, NextResponse } from "next/server";

type TickBody = {
  sessionId?: string;
  nowMs?: number;
  job?: {
    type: ScheduledJobType;
    runAt?: number;
    payload?: Record<string, unknown>;
  };
  jobs?: Array<{
    type: ScheduledJobType;
    runAt?: number;
    payload?: Record<string, unknown>;
  }>;
};

const ALLOWED_JOB_TYPES: ScheduledJobType[] = ["follow_up_checkin", "consolidate_call", "bg_task"];

function normalizeSessionId(value: unknown) {
  if (typeof value !== "string") return "default";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "default";
}

function isJobType(value: unknown): value is ScheduledJobType {
  return typeof value === "string" && ALLOWED_JOB_TYPES.includes(value as ScheduledJobType);
}

export async function POST(request: NextRequest) {
  let body: TickBody = {};

  try {
    body = (await request.json()) as TickBody;
  } catch {
    body = {};
  }

  const sessionId = normalizeSessionId(body.sessionId);
  const createdJobs = [];

  if (body.job && isJobType(body.job.type)) {
    createdJobs.push(
      scheduleJob({
        sessionId,
        type: body.job.type,
        runAt: body.job.runAt,
        payload: body.job.payload
      })
    );
  }

  if (Array.isArray(body.jobs)) {
    for (const job of body.jobs) {
      if (!isJobType(job?.type)) continue;
      createdJobs.push(
        scheduleJob({
          sessionId,
          type: job.type,
          runAt: job.runAt,
          payload: job.payload
        })
      );
    }
  }

  const executedJobs = runDueJobs(typeof body.nowMs === "number" ? body.nowMs : Date.now());

  for (const job of executedJobs) {
    logEvent({
      category: "scheduler",
      action: "job_executed",
      sessionId: job.sessionId,
      details: {
        jobId: job.id,
        type: job.type,
        attempts: job.attempts
      }
    });
  }

  return NextResponse.json({
    ok: true,
    route: "/api/scheduler/tick",
    sessionId,
    createdJobs,
    executedJobs,
    queuedJobs: listScheduledJobs(sessionId).filter((job) => job.status === "queued")
  });
}
