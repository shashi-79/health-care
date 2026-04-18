import { NextResponse } from "next/server";

export async function POST() {
  // TODO: Side-channel delegate from call lane to BG agent.
  return NextResponse.json({ ok: true, route: "/api/bg/delegate", status: "placeholder" });
}
