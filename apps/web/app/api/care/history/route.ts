import { NextRequest, NextResponse } from "next/server";
import { addHistoryItem, deleteHistoryItems, listHistory, normalizeSessionId } from "../store";

type AddHistoryBody = {
  sessionId?: string;
  entry?: {
    id?: number;
    name?: string;
    time?: string;
    type?: "in" | "out" | "missed";
    avatar?: string;
  };
};

type DeleteHistoryBody = {
  sessionId?: string;
  ids?: number[];
};

export async function GET(request: NextRequest) {
  const sessionId = normalizeSessionId(request.nextUrl.searchParams.get("sessionId"));
  const history = listHistory(sessionId);

  return NextResponse.json({
    ok: true,
    route: "/api/care/history",
    sessionId,
    history
  });
}

export async function POST(request: NextRequest) {
  let body: AddHistoryBody;

  try {
    body = (await request.json()) as AddHistoryBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        route: "/api/care/history",
        error: "Invalid JSON body."
      },
      { status: 400 }
    );
  }

  const sessionId = normalizeSessionId(body.sessionId);
  const entry = body.entry;

  if (!entry?.name || !entry.time || !entry.type || !entry.avatar) {
    return NextResponse.json(
      {
        ok: false,
        route: "/api/care/history",
        error: "entry.name, entry.time, entry.type, and entry.avatar are required."
      },
      { status: 400 }
    );
  }

  const created = addHistoryItem(sessionId, {
    id: entry.id,
    name: entry.name,
    time: entry.time,
    type: entry.type,
    avatar: entry.avatar
  });

  return NextResponse.json({
    ok: true,
    route: "/api/care/history",
    sessionId,
    created,
    history: listHistory(sessionId)
  });
}

export async function DELETE(request: NextRequest) {
  let body: DeleteHistoryBody;

  try {
    body = (await request.json()) as DeleteHistoryBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        route: "/api/care/history",
        error: "Invalid JSON body."
      },
      { status: 400 }
    );
  }

  const sessionId = normalizeSessionId(body.sessionId);
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((value): value is number => typeof value === "number")
    : [];

  if (ids.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        route: "/api/care/history",
        error: "ids[] is required."
      },
      { status: 400 }
    );
  }

  const history = deleteHistoryItems(sessionId, ids);

  return NextResponse.json({
    ok: true,
    route: "/api/care/history",
    sessionId,
    history
  });
}
