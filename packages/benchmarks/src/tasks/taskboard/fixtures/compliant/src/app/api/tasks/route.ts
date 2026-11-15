import { NextResponse } from "next/server";

import { db } from "../../../lib/db";

export async function GET() {
  const projects = await db.listProjects();
  const tasks = projects.flatMap((project) => [
    {
      id: `${project.id}-task-1`,
      projectId: project.id,
      title: `Review ${project.name}`,
    },
  ]);

  return NextResponse.json({ tasks });
}
