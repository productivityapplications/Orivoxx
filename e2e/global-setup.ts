import { rm } from "node:fs/promises";

export default async function globalSetup(): Promise<void> {
  await rm("/tmp/orivoxx-e2e-results", { recursive: true, force: true });
}
