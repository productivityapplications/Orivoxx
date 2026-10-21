import {
  CheckSchema,
  RequirementSchema,
  SeveritySchema,
  VerificationModeSchema,
  type Check,
  type Requirement,
} from "../contracts/index.js";

export type SpecParseErrorCode =
  | "empty_spec"
  | "no_requirements"
  | "duplicate_requirement_id"
  | "unknown_check_type"
  | "missing_required_field"
  | "invalid_severity"
  | "invalid_verification_mode"
  | "malformed_check_block";

export interface SpecParseWarning {
  line: number;
  message: string;
}

export interface SpecParseError {
  code: SpecParseErrorCode;
  message: string;
  line: number;
}

export type SpecParseResult =
  | {
      ok: true;
      requirements: Requirement[];
      warnings: SpecParseWarning[];
      unstructuredProse: string;
    }
  | {
      ok: false;
      error: SpecParseError;
    };

export type ParseResult = SpecParseResult;

interface PendingCheck {
  type: string;
  line: number;
  fields: Map<string, string>;
}

interface PendingRequirement {
  id: string;
  title: string;
  line: number;
  severity?: "critical" | "high" | "medium" | "low";
  verification?: "deterministic" | "semantic";
  description?: string;
  descriptionLine?: number;
  checks: PendingCheck[];
  currentCheck: PendingCheck | null;
  inChecks: boolean;
}

const REQUIREMENT_HEADING_PATTERN =
  /^###\s+(REQ-[A-Z0-9]+(?:-[A-Z0-9]+)*)\s+(?:\u2014|-)\s+(.+?)\s*$/;
const REQUIREMENT_HEADING_PREFIX_PATTERN = /^###\s+REQ-/;
const MARKDOWN_HEADING_PATTERN = /^#{1,6}\s+/;
const FIELD_BULLET_PATTERN = /^-\s+([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/;
const CHECK_START_PATTERN = /^\s+-\s+type\s*:\s*(.*)$/;
const CHECK_FIELD_PATTERN = /^\s+([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/;
const CHECK_ITEM_WITHOUT_TYPE_PATTERN = /^\s+-\s+([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/;
const FENCE_PATTERN = /^\s*(`{3,}|~{3,})/;

const KNOWN_CHECK_TYPES = new Set([
  "file_exists",
  "file_absent",
  "text_contains",
  "text_not_contains",
  "dependency_present",
  "dependency_absent",
  "source_reference_exists",
]);

function errorResult(
  code: SpecParseErrorCode,
  message: string,
  line: number,
): { ok: false; error: SpecParseError } {
  return { ok: false, error: { code, message, line } };
}

function unquote(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];

    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }

  return trimmed;
}

function validateCheck(check: PendingCheck): { ok: true; check: Check } | { ok: false; error: SpecParseError } {
  const candidate: Record<string, string> = { type: check.type };

  for (const [field, value] of check.fields) {
    candidate[field] = value;
  }

  const parsed = CheckSchema.safeParse(candidate);

  if (parsed.success) {
    return { ok: true, check: parsed.data };
  }

  const firstIssue = parsed.error.issues[0];
  const fieldPath = firstIssue?.path.join(".") ?? "";

  if (
    firstIssue?.code === "invalid_type" &&
    fieldPath.length > 0 &&
    !(fieldPath in candidate)
  ) {
    return {
      ok: false,
      error: {
        code: "missing_required_field",
        message: `Check "${check.type}" is missing required field "${fieldPath}".`,
        line: check.line,
      },
    };
  }

  return {
    ok: false,
    error: {
      code: "malformed_check_block",
      message: `Check "${check.type}" does not match the declared check contract.`,
      line: check.line,
    },
  };
}

export function parseSpec(text: string): ParseResult {
  if (text.trim().length === 0) {
    return errorResult("empty_spec", "The specification is empty.", 1);
  }

  const lines = text.split(/\r\n|\r|\n/);
  const warnings: SpecParseWarning[] = [];
  const requirements: Requirement[] = [];
  const seenRequirementIds = new Set<string>();
  const prose: string[] = [];
  let block: PendingRequirement | null = null;
  let inFence = false;
  let fenceCharacter = "";

  const finalizeBlock = (): { ok: true } | { ok: false; error: SpecParseError } | null => {
    if (block === null) {
      return null;
    }

    const pending = block;
    const checks: Check[] = [];

    for (const check of pending.checks) {
      const validated = validateCheck(check);

      if (!validated.ok) {
        return validated;
      }

      checks.push(validated.check);
    }

    if (pending.severity === undefined) {
      return errorResult(
        "missing_required_field",
        `Requirement "${pending.id}" is missing required field "Severity".`,
        pending.line,
      );
    }

    if (pending.verification === undefined) {
      return errorResult(
        "missing_required_field",
        `Requirement "${pending.id}" is missing required field "Verification".`,
        pending.line,
      );
    }

    if (pending.description === undefined || pending.description.trim().length === 0) {
      return errorResult(
        "missing_required_field",
        `Requirement "${pending.id}" is missing required field "Description".`,
        pending.descriptionLine ?? pending.line,
      );
    }

    const parsed = RequirementSchema.safeParse({
      id: pending.id,
      title: pending.title,
      description: pending.description,
      severity: pending.severity,
      verificationMode: pending.verification,
      checks,
      lineHint: pending.line,
    });

    if (!parsed.success) {
      return errorResult(
        "malformed_check_block",
        `Requirement "${pending.id}" does not match the declared requirement contract.`,
        pending.line,
      );
    }

    requirements.push(parsed.data);
    block = null;

    return { ok: true };
  };

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index] ?? "";
    const fenceMatch = line.match(FENCE_PATTERN);

    if (inFence) {
      if (fenceMatch !== null && fenceMatch[1]?.startsWith(fenceCharacter)) {
        inFence = false;
      }

      prose.push(line);
      continue;
    }

    if (fenceMatch !== null) {
      const finished = finalizeBlock();

      if (finished !== null && !finished.ok) {
        return finished;
      }

      inFence = true;
      fenceCharacter = fenceMatch[1]?.[0] ?? "`";
      prose.push(line);
      continue;
    }

    if (MARKDOWN_HEADING_PATTERN.test(line)) {
      const finished = finalizeBlock();

      if (finished !== null && !finished.ok) {
        return finished;
      }

      const headingMatch = line.match(REQUIREMENT_HEADING_PATTERN);

      if (headingMatch !== null) {
        const id = headingMatch[1] ?? "";
        const title = (headingMatch[2] ?? "").trim();

        if (seenRequirementIds.has(id)) {
          return errorResult(
            "duplicate_requirement_id",
            `Duplicate requirement ID "${id}".`,
            lineNumber,
          );
        }

        seenRequirementIds.add(id);
        block = {
          id,
          title,
          line: lineNumber,
          checks: [],
          currentCheck: null,
          inChecks: false,
        };
        continue;
      }

      if (REQUIREMENT_HEADING_PREFIX_PATTERN.test(line)) {
        warnings.push({
          line: lineNumber,
          message: "Malformed requirement heading; treated as unstructured prose.",
        });
      }

      prose.push(line);
      continue;
    }

    if (block !== null) {
      if (line.trim().length === 0) {
        continue;
      }

      const fieldMatch = line.match(FIELD_BULLET_PATTERN);

      if (fieldMatch !== null) {
        const fieldName = fieldMatch[1] ?? "";
        const fieldValue = (fieldMatch[2] ?? "").trim();
        block.inChecks = false;
        block.currentCheck = null;

        switch (fieldName) {
          case "Severity": {
            if (block.severity !== undefined) {
              warnings.push({
                line: lineNumber,
                message: 'Duplicate "Severity" field; keeping the first value.',
              });
              break;
            }

            const severity = SeveritySchema.safeParse(fieldValue);

            if (!severity.success) {
              return errorResult(
                "invalid_severity",
                `Invalid severity "${fieldValue}".`,
                lineNumber,
              );
            }

            block.severity = severity.data;
            break;
          }

          case "Verification": {
            if (block.verification !== undefined) {
              warnings.push({
                line: lineNumber,
                message: 'Duplicate "Verification" field; keeping the first value.',
              });
              break;
            }

            const verification = VerificationModeSchema.safeParse(fieldValue);

            if (!verification.success) {
              return errorResult(
                "invalid_verification_mode",
                `Invalid verification mode "${fieldValue}".`,
                lineNumber,
              );
            }

            block.verification = verification.data;
            break;
          }

          case "Description": {
            if (block.description !== undefined) {
              warnings.push({
                line: lineNumber,
                message: 'Duplicate "Description" field; keeping the first value.',
              });
              break;
            }

            block.description = fieldValue;
            block.descriptionLine = lineNumber;
            break;
          }

          case "Checks": {
            block.inChecks = true;

            if (fieldValue.length > 0) {
              warnings.push({
                line: lineNumber,
                message: 'Unexpected value after "Checks:"; ignored.',
              });
            }

            break;
          }

          default: {
            warnings.push({
              line: lineNumber,
              message: `Unknown requirement field "${fieldName}"; ignored.`,
            });
          }
        }

        continue;
      }

      if (/^\s+\S/.test(line)) {
        if (!block.inChecks) {
          warnings.push({
            line: lineNumber,
            message: "Indented content outside a Checks block; ignored.",
          });
          continue;
        }

        const checkStartMatch = line.match(CHECK_START_PATTERN);

        if (checkStartMatch !== null) {
          const checkType = unquote(checkStartMatch[1] ?? "");

          if (checkType.length === 0) {
            return errorResult(
              "malformed_check_block",
              "Check item is missing a check type.",
              lineNumber,
            );
          }

          if (!KNOWN_CHECK_TYPES.has(checkType)) {
            return errorResult(
              "unknown_check_type",
              `Unknown check type "${checkType}".`,
              lineNumber,
            );
          }

          const pendingCheck: PendingCheck = {
            type: checkType,
            line: lineNumber,
            fields: new Map<string, string>(),
          };

          block.checks.push(pendingCheck);
          block.currentCheck = pendingCheck;
          continue;
        }

        const itemWithoutType = line.match(CHECK_ITEM_WITHOUT_TYPE_PATTERN);

        if (itemWithoutType !== null) {
          return errorResult(
            "malformed_check_block",
            'Check item must start with "type:".',
            lineNumber,
          );
        }

        const checkFieldMatch = line.match(CHECK_FIELD_PATTERN);

        if (checkFieldMatch !== null) {
          if (block.currentCheck === null) {
            return errorResult(
              "malformed_check_block",
              'Check field appears before a "type:" declaration.',
              lineNumber,
            );
          }

          const fieldName = checkFieldMatch[1] ?? "";
          const fieldValue = unquote(checkFieldMatch[2] ?? "");

          if (fieldName === "type") {
            return errorResult(
              "malformed_check_block",
              'Duplicate "type" field inside a check item.',
              lineNumber,
            );
          }

          if (block.currentCheck.fields.has(fieldName)) {
            return errorResult(
              "malformed_check_block",
              `Duplicate "${fieldName}" field inside a check item.`,
              lineNumber,
            );
          }

          block.currentCheck.fields.set(fieldName, fieldValue);
          continue;
        }

        warnings.push({
          line: lineNumber,
          message: "Unrecognized indented content in a Checks block; ignored.",
        });
        continue;
      }

      warnings.push({
        line: lineNumber,
        message: "Unrecognized line inside a requirement block; ignored.",
      });
      continue;
    }

    prose.push(line);
  }

  const finished = finalizeBlock();

  if (finished !== null && !finished.ok) {
    return finished;
  }

  if (requirements.length === 0) {
    return errorResult(
      "no_requirements",
      "The specification contains no parseable requirement blocks.",
      1,
    );
  }

  return {
    ok: true,
    requirements,
    warnings,
    unstructuredProse: prose.join("\n"),
  };
}
