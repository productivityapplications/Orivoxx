import type { NormalizedFile } from "../archive/types.js";

const DEPENDENCY_SECTIONS = ["dependencies", "devDependencies", "peerDependencies"] as const;

export function findRootPackageJson(files: NormalizedFile[]): NormalizedFile | undefined {
  return files.find((file) => file.path === "package.json");
}

export function extractDeclaredDependencies(files: NormalizedFile[]): string[] {
  const packageJson = findRootPackageJson(files);

  if (packageJson === undefined) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(packageJson.content);
  } catch {
    return [];
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return [];
  }

  const manifest = parsed as Record<string, unknown>;
  const names = new Set<string>();

  for (const section of DEPENDENCY_SECTIONS) {
    const value = manifest[section];

    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      continue;
    }

    for (const name of Object.keys(value)) {
      if (name.length > 0) {
        names.add(name);
      }
    }
  }

  return [...names].sort();
}
