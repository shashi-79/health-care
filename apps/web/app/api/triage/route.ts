import { NextResponse } from "next/server";

export async function POST() {
  // TODO: Invoke triage rule engine and return severity.
  return NextResponse.json({ ok: true, route: "/api/triage", status: "placeholder" });
}
