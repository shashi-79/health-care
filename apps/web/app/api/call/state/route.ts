import { NextRequest, NextResponse } from "next/server";
import {
  acceptCall,
  clearCallState,
  endCall,
  getCallState,
  normalizeSessionId,
  simulateIncomingCall,
  startOutgoingCall
} from "../store";

type PostCallStateBody = {
  sessionId?: string;
  action?: "start_outgoing" | "simulate_incoming" | "accept" | "end" | "clear";
  contactName?: string;
};

export async function GET(request: NextRequest) {
  const sessionId = normalizeSessionId(request.nextUrl.searchParams.get("sessionId"));

  return NextResponse.json({
    ok: true,
    route: "/api/call/state",
    sessionId,
    call: getCallState(sessionId)
  });
}

export async function POST(request: NextRequest) {
  let body: PostCallStateBody;

  try {
    body = (await request.json()) as PostCallStateBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        route: "/api/call/state",
        error: "Invalid JSON body."
      },
      { status: 400 }
    );
  }

  const sessionId = normalizeSessionId(body.sessionId);
  const action = body.action;

  if (!action) {
    return NextResponse.json(
      {
        ok: false,
        route: "/api/call/state",
        error: "action is required."
      },
      { status: 400 }
    );
  }

  const contactName = typeof body.contactName === "string" && body.contactName.trim().length > 0
    ? body.contactName.trim()
    : "John Doe";

  if (action === "start_outgoing") {
    return NextResponse.json({
      ok: true,
      route: "/api/call/state",
      sessionId,
      call: startOutgoingCall(sessionId, contactName)
    });
  }

  if (action === "simulate_incoming") {
    return NextResponse.json({
      ok: true,
      route: "/api/call/state",
      sessionId,
      call: simulateIncomingCall(sessionId, contactName)
    });
  }

  if (action === "accept") {
    return NextResponse.json({
      ok: true,
      route: "/api/call/state",
      sessionId,
      call: acceptCall(sessionId)
    });
  }

  if (action === "end") {
    return NextResponse.json({
      ok: true,
      route: "/api/call/state",
      sessionId,
      call: endCall(sessionId)
    });
  }

  return NextResponse.json({
    ok: true,
    route: "/api/call/state",
    sessionId,
    call: clearCallState(sessionId)
  });
}
