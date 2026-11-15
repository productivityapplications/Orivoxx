import { NextResponse } from "next/server";

import { requireUser } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { bookmarkSchema } from "../../../lib/schema";

function errorResponse(error: unknown) {
  const status = error instanceof Error && error.message === "Unauthorized" ? 401 : 500;

  return NextResponse.json(
    {
      error: {
        code: status === 401 ? "UNAUTHORIZED" : "BOOKMARK_REQUEST_FAILED",
        message: status === 401 ? "Sign in required." : "Unable to process the request.",
      },
    },
    { status },
  );
}

export async function GET() {
  try {
    const user = await requireUser();
    const bookmarks = await db.listBookmarks(user.id);

    return NextResponse.json({ bookmarks });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = bookmarkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_BOOKMARK",
            message: "Provide a valid URL and title.",
          },
        },
        { status: 400 },
      );
    }

    const bookmark = await db.createBookmark(user.id, parsed.data);

    return NextResponse.json({ bookmark }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
