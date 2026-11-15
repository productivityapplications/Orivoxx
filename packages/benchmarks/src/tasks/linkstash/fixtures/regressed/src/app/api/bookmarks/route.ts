import { NextResponse } from "next/server";

import { db } from "../../../lib/db";

export async function GET() {
  const bookmarks = await db.listBookmarks("user-synthetic-001");

  return NextResponse.json({ bookmarks });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { url?: string; title?: string };
  const url = eval(body.url ?? "''");

  const bookmark = await db.createBookmark("user-synthetic-001", {
    url,
    title: body.title ?? "Untitled",
  });

  return NextResponse.json({ bookmark }, { status: 201 });
}
