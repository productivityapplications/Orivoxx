import { describe, expect, it } from "vitest";

import {
  assertValidVerifyRequest,
  ValidateVerifyRequest,
  VerifyRequestValidationError,
} from "./verify-input.js";

function validRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    projectName: "TaskBoard",
    specText: "# Project\n\n### REQ-ONE-001 — Requirement\n",
    files: [{ path: "PROJECT_SPEC.md", content: "# Project\n" }],
    sourceSharingAcknowledged: true,
    sourceKind: "sample",
    ...overrides,
  };
}

describe("ValidateVerifyRequest", () => {
  it("accepts a valid request", () => {
    const result = ValidateVerifyRequest(validRequest());

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.projectName).toBe("TaskBoard");
    }
  });

  it("rejects upload source without acknowledgement", () => {
    const result = ValidateVerifyRequest(
      validRequest({ sourceKind: "upload", sourceSharingAcknowledged: false }),
    );

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("sourceSharingAcknowledged"))).toBe(
        true,
      );
    }
  });

  it("accepts sample source without acknowledgement", () => {
    const result = ValidateVerifyRequest(
      validRequest({ sourceKind: "sample", sourceSharingAcknowledged: false }),
    );

    expect(result.success).toBe(true);
  });

  it("rejects a missing project name", () => {
    const request = validRequest();
    delete request.projectName;

    expect(ValidateVerifyRequest(request).success).toBe(false);
  });

  it("rejects an empty files array", () => {
    expect(ValidateVerifyRequest(validRequest({ files: [] })).success).toBe(false);
  });

  it("rejects more than 300 files", () => {
    const files = Array.from({ length: 301 }, (_, index) => ({
      path: `src/file-${index}.ts`,
      content: "export const value = 1;\n",
    }));

    expect(ValidateVerifyRequest(validRequest({ files })).success).toBe(false);
  });

  it("rejects unknown top-level fields", () => {
    expect(ValidateVerifyRequest(validRequest({ unexpected: true })).success).toBe(false);
  });
});

describe("assertValidVerifyRequest", () => {
  it("returns validated data", () => {
    const request = assertValidVerifyRequest(validRequest());

    expect(request.sourceKind).toBe("sample");
  });

  it("throws a structured validation error", () => {
    expect(() =>
      assertValidVerifyRequest(validRequest({ sourceKind: "upload", sourceSharingAcknowledged: false })),
    ).toThrow(VerifyRequestValidationError);

    try {
      assertValidVerifyRequest(validRequest({ sourceKind: "upload", sourceSharingAcknowledged: false }));
    } catch (error) {
      expect(error).toBeInstanceOf(VerifyRequestValidationError);
      expect((error as VerifyRequestValidationError).code).toBe("invalid_verify_request");
      expect((error as VerifyRequestValidationError).issues.length).toBeGreaterThan(0);
    }
  });
});
