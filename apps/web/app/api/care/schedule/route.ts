import { NextRequest, NextResponse } from "next/server";
import { scheduleJob } from "@rhc/scheduler/index";
import type { ScheduledJobType } from "@rhc/types";
import { addScheduleItem, listSchedules, normalizeSessionId, updateScheduleStatus } from "../store";

type AddScheduleBody = {
  sessionId?: string;
  schedule?: {
    scheduleType?: string;
    title?: string;
    time?: string;
    duration?: string;
    notes?: string;
    dateNumber?: string;
    dayLabel?: string;
    tone?: "primary" | "success" | "warning";
    scheduleDate?: string;
  };
};

type PatchScheduleBody = {
  sessionId?: string;
  id?: number;
  status?: "pending" | "done";
};

function resolveScheduleJobType(scheduleType: string): ScheduledJobType {
  if (scheduleType.toLowerCase().includes("call")) {
    return "consolidate_call";
  }

  return "follow_up_checkin";
}

function resolveRunAtMs(scheduleDate?: string) {
  if (!scheduleDate) {
    return null;
  }

  const runAt = Date.parse(scheduleDate);
  return Number.isFinite(runAt) ? runAt : null;
}

export async function GET(request: NextRequest) {
  const sessionId = normalizeSessionId(request.nextUrl.searchParams.get("sessionId"));
  const schedules = listSchedules(sessionId);

  return NextResponse.json({
    ok: true,
    route: "/api/care/schedule",
    sessionId,
    schedules
  });
}

export async function POST(request: NextRequest) {
  let body: AddScheduleBody;

  try {
    body = (await request.json()) as AddScheduleBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        route: "/api/care/schedule",
        error: "Invalid JSON body."
      },
      { status: 400 }
    );
  }

  const sessionId = normalizeSessionId(body.sessionId);
  const schedule = body.schedule;

  if (!schedule?.scheduleType || !schedule.title || !schedule.time) {
    return NextResponse.json(
      {
        ok: false,
        route: "/api/care/schedule",
        error: "schedule.scheduleType, schedule.title, and schedule.time are required."
      },
      { status: 400 }
    );
  }

  const created = addScheduleItem(sessionId, {
    scheduleType: schedule.scheduleType,
    title: schedule.title,
    time: schedule.time,
    duration: schedule.duration ?? "",
    notes: schedule.notes ?? "",
    dateNumber: schedule.dateNumber ?? "",
    dayLabel: schedule.dayLabel ?? "",
    tone: schedule.tone ?? "primary",
    scheduleDate: schedule.scheduleDate
  });

  const runAt = resolveRunAtMs(created.scheduleDate);
  const scheduledJob =
    runAt === null
      ? null
      : await scheduleJob({
          sessionId,
          type: resolveScheduleJobType(created.scheduleType),
          runAt,
          payload: {
            source: "care_schedule",
            scheduleId: created.id,
            scheduleType: created.scheduleType,
            title: created.title,
            scheduleDate: created.scheduleDate ?? null
          }
        });

  return NextResponse.json({
    ok: true,
    route: "/api/care/schedule",
    sessionId,
    created,
    scheduledJob,
    schedules: listSchedules(sessionId)
  });
}

export async function PATCH(request: NextRequest) {
  let body: PatchScheduleBody;

  try {
    body = (await request.json()) as PatchScheduleBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        route: "/api/care/schedule",
        error: "Invalid JSON body."
      },
      { status: 400 }
    );
  }

  const sessionId = normalizeSessionId(body.sessionId);
  const id = typeof body.id === "number" ? body.id : null;
  const status = body.status;

  if (id === null || (status !== "pending" && status !== "done")) {
    return NextResponse.json(
      {
        ok: false,
        route: "/api/care/schedule",
        error: "id and status are required."
      },
      { status: 400 }
    );
  }

  const updated = updateScheduleStatus(sessionId, id, status);

  if (!updated) {
    return NextResponse.json(
      {
        ok: false,
        route: "/api/care/schedule",
        error: "Schedule item not found."
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    route: "/api/care/schedule",
    sessionId,
    updated,
    schedules: listSchedules(sessionId)
  });
}
