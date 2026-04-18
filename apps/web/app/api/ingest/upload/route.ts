import { NextResponse } from "next/server";

export async function POST() {
  // TODO: Handle upload refs for document/image/audio ingest.
  return NextResponse.json({ ok: true, route: "/api/ingest/upload", status: "placeholder" });
}
