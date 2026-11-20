import { z } from "zod";

export const RealTaskIdSchema = z.string().regex(/^[a-z][a-z0-9-]{1,63}$/);
export const RealTaskSourceSchema = z.enum(["handpicked", "community", "private"]);
export const RealTaskVisibilitySchema = z.enum(["curated", "community", "private"]);
export const RealTaskStatusSchema = z.enum([
  "pending",
  "validating",
  "validated",
  "rejected",
  "public",
]);
export const RealTaskDifficultySchema = z.enum(["easy", "medium", "hard"]);
export const RealTaskLanguageSchema = z.enum(["python", "node"]);

export const RealTaskValidationSchema = z
  .object({
    cloned: z.boolean(),
    installs: z.boolean(),
    testFailsAtBase: z.boolean(),
    deterministic: z.boolean(),
    timeBounded: z.boolean(),
    licenseOk: z.boolean(),
    checkedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const RealTaskSchema = z
  .object({
    id: RealTaskIdSchema,
    title: z.string().min(1).max(200),
    summary: z.string().min(1).max(600),
    source: RealTaskSourceSchema,
    visibility: RealTaskVisibilitySchema,
    repoUrl: z
      .string()
      .regex(/^https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/),
    baseCommit: z.string().regex(/^[a-f0-9]{7,40}$/),
    issueText: z.string().min(20).max(8_000),
    testCommand: z.string().min(1).max(500),
    passCondition: z.literal("exit0"),
    difficulty: RealTaskDifficultySchema,
    language: RealTaskLanguageSchema,
    license: z.string().min(1).max(64),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    status: RealTaskStatusSchema,
    submittedBy: z.string().min(1).max(128).optional(),
    submittedAt: z.iso.datetime({ offset: true }).optional(),
    rejectionReason: z.string().min(1).max(500).optional(),
    validation: RealTaskValidationSchema.optional(),
  })
  .strict();

export type RealTask = z.infer<typeof RealTaskSchema>;
export type RealTaskValidation = z.infer<typeof RealTaskValidationSchema>;

const base = {
  source: "handpicked" as const,
  visibility: "curated" as const,
  passCondition: "exit0" as const,
  language: "node" as const,
  version: "1.0.0",
  status: "public" as const,
  difficulty: "easy" as const,
  license: "MIT",
  validation: {
    cloned: true,
    installs: true,
    testFailsAtBase: true,
    deterministic: true,
    timeBounded: true,
    licenseOk: true,
    checkedAt: "2026-11-20T00:00:00.000Z",
  },
};

export const CURATED_REAL_TASKS: readonly RealTask[] = [
  {
    ...base,
    id: "is-decimal-single-char",
    title: "is-decimal: reject multi-character input",
    summary: "The predicate reads only the first code point, so '12' is accepted as a single decimal character.",
    repoUrl: "https://github.com/wooorm/is-decimal",
    baseCommit: "edc9aaf05e07857a03654115cf5ae8bf9eb74b95",
    issueText:
      "isDecimal('12') currently returns true because the implementation reads only the first code point. The API documents a single character or code point. Make multi-character strings return false without changing behavior for numbers or one-character strings.",
    testCommand:
      "node -e \"import('./index.js').then(({isDecimal})=>process.exit(isDecimal('12')?1:0))\"",
  },
  {
    ...base,
    id: "is-hexadecimal-single-char",
    title: "is-hexadecimal: reject multi-character input",
    summary: "The predicate accepts 'FF' because it reads only the first code point.",
    repoUrl: "https://github.com/wooorm/is-hexadecimal",
    baseCommit: "b178db912b2873e9562aa74726f53c91923fbf58",
    issueText:
      "isHexadecimal('FF') currently returns true because only the first code point is inspected. The function checks a single character or code point. Return false for strings longer than one code point while preserving the existing accepted character set.",
    testCommand:
      "node -e \"import('./index.js').then(({isHexadecimal})=>process.exit(isHexadecimal('FF')?1:0))\"",
  },
  {
    ...base,
    id: "is-alphabetical-single-char",
    title: "is-alphabetical: reject multi-character input",
    summary: "The predicate returns true for 'ab' because it reads only the first code point.",
    repoUrl: "https://github.com/wooorm/is-alphabetical",
    baseCommit: "45c55a9895926d733230954cb8a19f0d8f9e49d4",
    issueText:
      "isAlphabetical('ab') returns true because the implementation reads only the first code point. The function is documented for a single character or code point. Reject multi-character strings without changing number or single-character behavior.",
    testCommand:
      "node -e \"import('./index.js').then(({isAlphabetical})=>process.exit(isAlphabetical('ab')?1:0))\"",
  },
  {
    ...base,
    id: "is-word-character-single-char",
    title: "is-word-character: reject multi-character input",
    summary: "The predicate accepts 'ab' as a word character by reading only the first code point.",
    repoUrl: "https://github.com/wooorm/is-word-character",
    baseCommit: "780669c99937c05b21479625a50bf1cf022e7175",
    issueText:
      "isWordCharacter('ab') returns true because the implementation examines only the first code point. A word character is a single character. Return false for multi-character strings while preserving underscore, digit, and letter behavior.",
    testCommand:
      "node -e \"import('./index.js').then(({isWordCharacter})=>process.exit(isWordCharacter('ab')?1:0))\"",
  },
  {
    ...base,
    id: "is-whitespace-single-char",
    title: "is-whitespace-character: reject multi-character input",
    summary: "A two-character whitespace string is accepted because only the first code point is read.",
    repoUrl: "https://github.com/wooorm/is-whitespace-character",
    baseCommit: "d28a6fc01ae1d41152b765e9a760a906acaa417c",
    issueText:
      "isWhitespaceCharacter('  ') returns true because only the first code point is checked. The predicate describes a single whitespace character. Return false for strings longer than one code point, preserving all existing whitespace characters.",
    testCommand:
      "node -e \"import('./index.js').then(({isWhitespaceCharacter})=>process.exit(isWhitespaceCharacter('  ')?1:0))\"",
  },
  {
    ...base,
    id: "is-number-reject-hex",
    title: "is-number: reject hexadecimal strings",
    summary: "Number('0x10') coerces a hex string, so is-number reports it as a number.",
    repoUrl: "https://github.com/jonschlinkert/is-number",
    baseCommit: "98e8ff1da1a89f93d1397a24d7413ed15421c139",
    issueText:
      "isNumber('0x10') returns true because the string is coerced with Number(). A hexadecimal string is not a decimal number input. Reject 0x-prefixed strings while keeping finite decimal strings and real numbers accepted.",
    testCommand:
      "node -e \"process.exit(require('./index.js')('0x10')?1:0)\"",
  },
];
