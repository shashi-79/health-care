import { NextRequest, NextResponse } from "next/server";
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

  return NextResponse.json({
    ok: true,
    route: "/api/care/schedule",
    sessionId,
    created,
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
