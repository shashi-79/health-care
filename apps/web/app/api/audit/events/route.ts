import { listEvents } from "@rhc/obs";
import type { ObservationLevel } from "@rhc/types";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_LEVELS: ObservationLevel[] = ["info", "warn", "error"];

function normalizeOptional(value: string | null) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeLevel(value: string | null): ObservationLevel | undefined {
  const maybe = normalizeOptional(value);
  if (!maybe) {
    return undefined;
  }

  return ALLOWED_LEVELS.includes(maybe as ObservationLevel) ? (maybe as ObservationLevel) : undefined;
}

function normalizeLimit(value: string | null) {
  if (!value) {
    return 200;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 200;
  }

  const bounded = Math.floor(parsed);
  return Math.max(1, Math.min(1000, bounded));
}

export async function GET(request: NextRequest) {
  const sessionId = normalizeOptional(request.nextUrl.searchParams.get("sessionId"));
  const category = normalizeOptional(request.nextUrl.searchParams.get("category"));
  const level = normalizeLevel(request.nextUrl.searchParams.get("level"));
  const limit = normalizeLimit(request.nextUrl.searchParams.get("limit"));

  const events = listEvents({
    sessionId,
    category,
    level
  });

  return NextResponse.json({
    ok: true,
    route: "/api/audit/events",
    count: events.length,
    events: events.slice(-limit)
  });
}
