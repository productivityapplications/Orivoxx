import { NextResponse } from "next/server";

import { assertProjectOwner, requireSession } from "../../../../lib/auth";
import { db } from "../../../../lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function errorResponse(error: unknown) {
  const status = error instanceof Error && error.message === "Forbidden" ? 403 : 500;

  return NextResponse.json(
    {
      error: {
        code: status === 403 ? "FORBIDDEN" : "PROJECT_REQUEST_FAILED",
        message:
          status === 403
            ? "You do not have access to this project."
            : "Unable to process the project request.",
      },
    },
    { status },
  );
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    const { id } = await context.params;

    await assertProjectOwner(session, id);

    const project = await db.getProject(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    const { id } = await context.params;

    await assertProjectOwner(session, id);

    const body = await request.json();
    const project = await db.updateProject(id, body);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    return errorResponse(error);
  }
}
