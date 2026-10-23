import type { NormalizedFile } from "../archive/types.js";
import type { Check, Requirement } from "../contracts/index.js";
import type { EvidenceDraft } from "../evidence/types.js";
import { extractDeclaredDependencies, findRootPackageJson } from "./dependencies.js";
import { parseStaticReferences } from "./static-references.js";
import type { CheckContext, CheckOutcome } from "./types.js";

function findFile(context: CheckContext, path: string): NormalizedFile | undefined {
  return context.files.find((file) => file.path === path);
}

function lineNumberAt(content: string, index: number): number {
  let line = 1;

  for (let position = 0; position < index; position += 1) {
    if (content.charCodeAt(position) === 10) {
      line += 1;
    }
  }

  return line;
}

function makeDraft(
  check: Check,
  evidence: Omit<EvidenceDraft, "origin" | "checkType">,
): EvidenceDraft {
  return { origin: "deterministic", checkType: check.type, ...evidence };
}

function pass(evidence: EvidenceDraft[]): CheckOutcome {
  return { status: "PASS", evidence };
}

function fail(evidence: EvidenceDraft[]): CheckOutcome {
  return { status: "FAIL", evidence };
}

export function runCheck(check: Check, context: CheckContext): CheckOutcome {
  switch (check.type) {
    case "file_exists": {
      if (findFile(context, check.path) === undefined) {
        return fail([
          makeDraft(check, {
            type: "file_absence",
            path: check.path,
            summary: "File not present in the project snapshot.",
          }),
        ]);
      }

      return pass([
        makeDraft(check, {
          type: "file_presence",
          path: check.path,
          summary: `File exists at ${check.path}.`,
        }),
      ]);
    }

    case "file_absent": {
      if (findFile(context, check.path) !== undefined) {
        return fail([
          makeDraft(check, {
            type: "file_presence",
            path: check.path,
            summary: "File is present but must be absent.",
          }),
        ]);
      }

      return pass([
        makeDraft(check, {
          type: "file_absence",
          path: check.path,
          summary: "File is absent as required.",
        }),
      ]);
    }

    case "text_contains": {
      const file = findFile(context, check.path);

      if (file === undefined) {
        return fail([
          makeDraft(check, {
            type: "text_marker",
            path: check.path,
            summary: "Required text marker not found.",
          }),
        ]);
      }

      const index = file.content.indexOf(check.text);

      if (index === -1) {
        return fail([
          makeDraft(check, {
            type: "text_marker",
            path: check.path,
            summary: "Required text marker not found.",
          }),
        ]);
      }

      return pass([
        makeDraft(check, {
          type: "text_marker",
          path: check.path,
          startLine: lineNumberAt(file.content, index),
          summary: "Required text marker present.",
        }),
      ]);
    }

    case "text_not_contains": {
      const file = findFile(context, check.path);

      if (file === undefined) {
        return fail([
          makeDraft(check, {
            type: "text_marker",
            path: check.path,
            summary: "Forbidden text marker could not be checked because the file is missing.",
          }),
        ]);
      }

      const index = file.content.indexOf(check.text);

      if (index === -1) {
        return pass([
          makeDraft(check, {
            type: "text_marker",
            path: check.path,
            summary: "Forbidden text marker not found.",
          }),
        ]);
      }

      return fail([
        makeDraft(check, {
          type: "text_marker",
          path: check.path,
          startLine: lineNumberAt(file.content, index),
          summary: "Forbidden text marker present.",
        }),
      ]);
    }

    case "dependency_present": {
      if (findRootPackageJson(context.files) === undefined) {
        return fail([
          makeDraft(check, {
            type: "dependency_state",
            path: "package.json",
            summary: "package.json not found; cannot confirm dependency.",
          }),
        ]);
      }

      if (!context.dependencies.includes(check.name)) {
        return fail([
          makeDraft(check, {
            type: "dependency_state",
            path: "package.json",
            summary: "Declared dependency not present in package.json.",
          }),
        ]);
      }

      return pass([
        makeDraft(check, {
          type: "dependency_state",
          path: "package.json",
          summary: "Declared dependency present.",
        }),
      ]);
    }

    case "dependency_absent": {
      if (findRootPackageJson(context.files) === undefined) {
        return pass([
          makeDraft(check, {
            type: "dependency_state",
            path: "package.json",
            summary: "package.json not found; dependency cannot be declared.",
          }),
        ]);
      }

      if (context.dependencies.includes(check.name)) {
        return fail([
          makeDraft(check, {
            type: "dependency_state",
            path: "package.json",
            summary: "Declared dependency present but must be absent.",
          }),
        ]);
      }

      return pass([
        makeDraft(check, {
          type: "dependency_state",
          path: "package.json",
          summary: "Declared dependency not present.",
        }),
      ]);
    }

    case "source_reference_exists": {
      const file = findFile(context, check.path);

      if (file === undefined) {
        return fail([
          makeDraft(check, {
            type: "source_reference",
            path: check.path,
            summary: `File not present in the project snapshot; cannot resolve a reference to ${check.referencedPath}.`,
          }),
        ]);
      }

      const parsed = parseStaticReferences(file);

      if (!parsed.ok) {
        const summary =
          parsed.reason === "unsupported_language"
            ? `${check.path} is not a supported JavaScript or TypeScript source file.`
            : `Static reference parsing failed for ${check.path}.`;

        return fail([
          makeDraft(check, {
            type: "source_reference",
            path: check.path,
            summary,
          }),
        ]);
      }

      const match = parsed.references.find(
        (reference) => reference.path === check.referencedPath,
      );

      if (match === undefined) {
        return fail([
          makeDraft(check, {
            type: "source_reference",
            path: check.path,
            summary: `File does not statically reference ${check.referencedPath}.`,
          }),
        ]);
      }

      return pass([
        makeDraft(check, {
          type: "source_reference",
          path: check.path,
          startLine: match.line,
          summary: `File statically references ${check.referencedPath}.`,
        }),
      ]);
    }

    default: {
      const unreachable: never = check;
      throw new Error(`Unsupported check type: ${String(unreachable)}`);
    }
  }
}

export function runRequirementChecks(
  requirement: Requirement,
  context: CheckContext,
): CheckOutcome | null {
  if (requirement.checks.length === 0) {
    return null;
  }

  const failingEvidence: EvidenceDraft[] = [];
  const passingEvidence: EvidenceDraft[] = [];
  let hasFailure = false;

  for (const check of requirement.checks) {
    const outcome = runCheck(check, context);

    if (outcome.status === "FAIL") {
      hasFailure = true;
      failingEvidence.push(...outcome.evidence);
    } else {
      passingEvidence.push(...outcome.evidence);
    }
  }

  if (hasFailure) {
    return { status: "FAIL", evidence: [...failingEvidence, ...passingEvidence] };
  }

  return { status: "PASS", evidence: passingEvidence };
}

export function runChecks(
  requirements: Requirement[],
  context: CheckContext,
): Map<string, CheckOutcome> {
  const results = new Map<string, CheckOutcome>();

  for (const requirement of requirements) {
    const outcome = runRequirementChecks(requirement, context);

    if (outcome !== null) {
      results.set(requirement.id, outcome);
    }
  }

  return results;
}

export function buildCheckContext(files: NormalizedFile[]): CheckContext {
  return {
    files,
    dependencies: extractDeclaredDependencies(files),
  };
}
