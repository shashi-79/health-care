import { NextResponse } from "next/server";

export async function POST() {
  // TODO: Wire chat lane -> Chat Agent -> BG Agent.
  return NextResponse.json({ ok: true, route: "/api/chat", status: "placeholder" });
}
