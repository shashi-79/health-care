import { NextResponse } from "next/server";

export async function POST() {
  // TODO: Run BG agent orchestration loop with tool gating.
  return NextResponse.json({ ok: true, route: "/api/bg/run", status: "placeholder" });
}
