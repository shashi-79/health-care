import { NextResponse } from "next/server";

export async function POST() {
  // TODO: Execute due scheduled jobs through BG lane.
  return NextResponse.json({ ok: true, route: "/api/scheduler/tick", status: "placeholder" });
}
