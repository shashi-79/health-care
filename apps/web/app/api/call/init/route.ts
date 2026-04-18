import { NextResponse } from "next/server";

export async function POST() {
  // TODO: Wire call init lane -> Gemini Live session config.
  return NextResponse.json({ ok: true, route: "/api/call/init", status: "placeholder" });
}
