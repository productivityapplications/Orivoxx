export type ProjectRecord = {
  id: string;
  name: string;
  ownerId: string;
  updatedAt: string;
};

const projects = new Map<string, ProjectRecord>([
  [
    "project-demo",
    {
      id: "project-demo",
      name: "Demo board",
      ownerId: "user-synthetic-001",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
]);

export const db = {
  async getProject(id: string): Promise<ProjectRecord | null> {
    return projects.get(id) ?? null;
  },
  async updateProject(id: string, input: { name?: string }): Promise<ProjectRecord | null> {
    const existing = projects.get(id);

    if (!existing) {
      return null;
    }

    const updated = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    projects.set(id, updated);
    return updated;
  },
  async listProjects(): Promise<ProjectRecord[]> {
    return [...projects.values()];
  },
};
