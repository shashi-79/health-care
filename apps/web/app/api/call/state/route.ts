import { NextRequest, NextResponse } from "next/server";
import {
  acceptCall,
  clearCallState,
  endCall,
  getCallState,
  normalizeSessionId,
  startOutgoingCall
} from "../store";

type PostCallStateBody = {
  sessionId?: string;
  action?: "start_outgoing" | "accept" | "end" | "clear";
  contactName?: string;
};

export async function GET(request: NextRequest) {
  const sessionId = normalizeSessionId(request.nextUrl.searchParams.get("sessionId"));

  return NextResponse.json({
    ok: true,
    route: "/api/call/state",
    sessionId,
    call: await getCallState(sessionId)
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
    : "Mohan";

  if (action === "start_outgoing") {
    return NextResponse.json({
      ok: true,
      route: "/api/call/state",
      sessionId,
      call: await startOutgoingCall(sessionId, contactName)
    });
  }

  if (action === "accept") {
    return NextResponse.json({
      ok: true,
      route: "/api/call/state",
      sessionId,
      call: await acceptCall(sessionId)
    });
  }

  if (action === "end") {
    return NextResponse.json({
      ok: true,
      route: "/api/call/state",
      sessionId,
      call: await endCall(sessionId)
    });
  }

  return NextResponse.json({
    ok: true,
    route: "/api/call/state",
    sessionId,
    call: await clearCallState(sessionId)
  });
}
