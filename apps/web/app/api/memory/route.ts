import { NextResponse } from "next/server";

export async function GET() {
  // TODO: Read UI transcript and memory snapshots.
  return NextResponse.json({ ok: true, route: "/api/memory", status: "placeholder" });
}

export async function PATCH() {
  // TODO: Patch memory deltas for session.
  return NextResponse.json({ ok: true, route: "/api/memory", status: "placeholder" });
}
