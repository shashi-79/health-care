import { NextRequest, NextResponse } from "next/server";
import { getCallState } from "../../call/store";
import { listHistory, normalizeSessionId } from "../store";
import { listUiMessages } from "@rhc/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const sessionId = normalizeSessionId(searchParams.get("sessionId"));
    
    const clientCallUpdatedAt = searchParams.get("callUpdatedAt") || "";
    const clientMsgCount = parseInt(searchParams.get("msgCount") || "-1", 10);
    const clientHistoryCount = parseInt(searchParams.get("historyCount") || "-1", 10);

    const startMs = Date.now();
    const maxWaitMs = 15000; // 15 seconds long poll timeout

    while (Date.now() - startMs < maxWaitMs) {
      const callState = await getCallState(sessionId);
      const messages = await listUiMessages(sessionId);
      const history = listHistory(sessionId);

      const callUpdatedAt = callState?.updatedAt || "";
      const msgCount = messages.length;
      const historyCount = history.length;

      const hasChanges = 
        callUpdatedAt !== clientCallUpdatedAt ||
        msgCount !== clientMsgCount ||
        historyCount !== clientHistoryCount;

      if (hasChanges) {
        return NextResponse.json({
          ok: true,
          hasChanges: true,
          callState,
          messages,
          history
        });
      }

      // Sleep for 1 second before querying again
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Timeout reached, return no changes
    return NextResponse.json({
      ok: true,
      hasChanges: false
    });
  } catch (err) {
    console.error("Long poll error:", err);
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || String(err) },
      { status: 500 }
    );
  }
}
