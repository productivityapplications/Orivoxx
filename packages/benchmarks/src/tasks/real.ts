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

/**
 * A test fixture shipped with a real task. It must live under `.orivoxx/` so a
 * task can never overwrite repository source. The harness rewrites these files
 * after the agent exits, so an agent cannot weaken the acceptance test.
 */
export const RealTaskTestFileSchema = z
  .object({
    path: z
      .string()
      .regex(/^\.orivoxx\/[A-Za-z0-9._/-]+$/)
      .max(160),
    content: z.string().min(1).max(64_000),
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
    /** Optional single argv command that installs runtime/test dependencies. */
    installCommand: z.string().min(1).max(500).optional(),
    /** Optional acceptance fixtures written under `.orivoxx/`. */
    testFiles: z.array(RealTaskTestFileSchema).max(3).optional(),
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
export type RealTaskTestFile = z.infer<typeof RealTaskTestFileSchema>;

const base = {
  source: "handpicked" as const,
  visibility: "curated" as const,
  passCondition: "exit0" as const,
  language: "node" as const,
  version: "1.0.0",
  status: "public" as const,
  difficulty: "medium" as const,
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

const SLUGIFY_ACCEPTANCE = String.raw`
import test from 'node:test';
import assert from 'node:assert/strict';
import slugify from '../index.js';

test('maxLength returns a slug no longer than the limit', () => {
  assert.equal(slugify('foo bar baz', {maxLength: 8}), 'foo-bar');
  assert.equal(slugify('foo bar baz', {maxLength: 6}), 'foo');
  assert.equal(slugify('foo bar baz', {maxLength: 11}), 'foo-bar-baz');
  assert.equal(slugify('abcdefghij', {maxLength: 4}), 'abcd');
  assert.equal(slugify('foo bar', {maxLength: 3}), 'foo');
  assert.equal(slugify('foo bar', {maxLength: 0}), '');
});

test('maxLength rejects negative and fractional values', () => {
  assert.throws(() => slugify('foo', {maxLength: -1}), TypeError);
  assert.throws(() => slugify('foo', {maxLength: 1.5}), TypeError);
});
`.trim();

const IS_ACCEPTANCE = String.raw`
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import is from '../source/index.ts';

test('is.email accepts ordinary addresses', () => {
  assert.equal(is.email('a@b.co'), true);
  assert.equal(is.email('first.last+tag@sub.example.com'), true);
  assert.equal(is.email('x@y.io'), true);
});

test('is.email rejects malformed addresses', () => {
  for (const value of ['plain', 'a@b', 'a b@c.co', 'a@@b.co', '@b.co', 'a@.co', 'a@b..co', 'a@b.c', 'a@b.co ', 42, null]) {
    assert.equal(is.email(value), false, String(value));
  }
});

test('the EmailString brand and export are present', () => {
  const types = readFileSync(new URL('../source/types.ts', import.meta.url), 'utf8');
  const index = readFileSync(new URL('../source/index.ts', import.meta.url), 'utf8');
  assert.match(types, /export type EmailString\b/);
  assert.match(index, /\bEmailString\b/);
  assert.match(index, /email:\s*isEmail\b/);
});
`.trim();

const ITSTDANGEROUS_ACCEPTANCE = String.raw`
from __future__ import annotations

import time

import pytest

import itsdangerous
from itsdangerous import (
    BadTimeSignature,
    SignatureExpired,
    SignatureNotYetValid,
    TimedSerializer,
    TimestampSigner,
)


class FutureSigner(TimestampSigner):
    def get_timestamp(self) -> int:
        return int(time.time()) + 3600


class PastSigner(TimestampSigner):
    def get_timestamp(self) -> int:
        return int(time.time()) - 3600


def test_future_timestamp_has_its_own_error() -> None:
    signed = FutureSigner("secret").sign("payload")

    with pytest.raises(SignatureNotYetValid) as caught:
        TimestampSigner("secret").unsign(signed, max_age=60)

    assert caught.value.payload == b"payload"
    assert caught.value.date_signed is not None
    assert isinstance(caught.value, BadTimeSignature)
    assert not isinstance(caught.value, SignatureExpired)


def test_expired_signature_is_unchanged() -> None:
    signed = PastSigner("secret").sign("payload")

    with pytest.raises(SignatureExpired) as caught:
        TimestampSigner("secret").unsign(signed, max_age=60)

    assert caught.value.payload == b"payload"
    assert not isinstance(caught.value, SignatureNotYetValid)


def test_serializer_path_and_top_level_export() -> None:
    assert itsdangerous.SignatureNotYetValid is SignatureNotYetValid

    signed = TimedSerializer("secret", signer=FutureSigner).dumps({"value": 1})

    with pytest.raises(SignatureNotYetValid):
        TimedSerializer("secret").loads(signed, max_age=60)
`.trim();

const ITSTDANGEROUS_RUNNER = String.raw`
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path[:0] = [str(HERE / "deps"), str(ROOT / "src")]

import pytest

raise SystemExit(pytest.main([str(HERE / "test_acceptance.py"), "-q"]))
`.trim();

export const CURATED_REAL_TASKS: readonly RealTask[] = [
  {
    ...base,
    id: "slugify-max-length",
    title: "slugify: add a maxLength option",
    summary:
      "A new option must cap the final slug at a boundary, with the runtime and the published type declaration kept in sync.",
    repoUrl: "https://github.com/sindresorhus/slugify",
    baseCommit: "99b35c2b0d6ccfad2b96ba9ce6997c6365b9a4b7",
    issueText: [
      "Add a `maxLength` option to slugify. The returned slug must never be longer than the limit.",
      "Truncate to the limit, then remove a trailing separator. If the cut splits a word, prefer cutting at the last separator before it; otherwise hard-truncate the slug.",
      "`maxLength: 0` returns an empty string.",
      "A negative or non-integer `maxLength` must throw a TypeError.",
      "Document the option in `index.d.ts` so the published types match the runtime.",
    ].join(" "),
    testCommand: "node --test .orivoxx/acceptance.test.mjs",
    installCommand: "npm install --no-audit --no-fund",
    testFiles: [{ path: ".orivoxx/acceptance.test.mjs", content: SLUGIFY_ACCEPTANCE }],
    difficulty: "medium",
    license: "MIT",
    validation: { ...base.validation, checkedAt: "2026-11-20T18:55:32.934Z" },
  },
  {
    ...base,
    id: "is-email-predicate",
    title: "is: add an email predicate and EmailString type",
    summary:
      "The guard must validate a practical email shape while the public TypeScript surface gains a branded EmailString type.",
    repoUrl: "https://github.com/sindresorhus/is",
    baseCommit: "e9c026c611c1160eaad50da00be4e676b626018f",
    issueText: [
      "Add an `is.email(value)` predicate to the default `is` object.",
      "Accept ordinary addresses with exactly one `@`, a non-empty local part, a domain containing at least one dot,",
      "a TLD of two or more letters, and no whitespace. Reject malformed values.",
      "Add and export a branded `EmailString` type in `source/types.ts`, use it in `source/index.ts`,",
      "and expose it from the package's public type exports.",
    ].join(" "),
    testCommand:
      "node --experimental-transform-types --test .orivoxx/acceptance.test.mjs",
    installCommand: "npm install --ignore-scripts --no-audit --no-fund",
    testFiles: [{ path: ".orivoxx/acceptance.test.mjs", content: IS_ACCEPTANCE }],
    difficulty: "medium",
    license: "MIT",
    validation: { ...base.validation, checkedAt: "2026-11-20T18:40:51.402Z" },
  },
  {
    ...base,
    id: "itsdangerous-future-signature",
    title: "itsdangerous: add SignatureNotYetValid",
    summary:
      "A future-dated timestamp is currently reported as expired; it needs its own exception class, package export, and signer branch.",
    repoUrl: "https://github.com/pallets/itsdangerous",
    baseCommit: "672971d66a2ef9f85151e53283113f33d642dabd",
    issueText: [
      "When `max_age` is supplied and a signature timestamp is in the future, `TimestampSigner.unsign`",
      "currently raises `SignatureExpired`. Add a distinct `SignatureNotYetValid` exception in `itsdangerous.exc`",
      "that subclasses `BadTimeSignature` and carries `payload` and `date_signed`, raise it for future timestamps,",
      "and export it from the top-level `itsdangerous` package. Past timestamps must still raise `SignatureExpired`.",
      "The `TimedSerializer.loads` path must raise the new exception as well.",
    ].join(" "),
    testCommand: "python3 .orivoxx/run_pytest.py",
    installCommand: "python3 -m pip install --target .orivoxx/deps pytest",
    testFiles: [
      {
        path: ".orivoxx/run_pytest.py",
        content: ITSTDANGEROUS_RUNNER,
      },
      { path: ".orivoxx/test_acceptance.py", content: ITSTDANGEROUS_ACCEPTANCE },
    ],
    difficulty: "hard",
    language: "python",
    license: "BSD-3-Clause",
    validation: { ...base.validation, checkedAt: "2026-11-20T18:44:13.323Z" },
  },
];

/**
 * The first curated set. Results for these tasks remain in the store, but the
 * public comparison set now uses the multi-file tasks above.
 */
export const LEGACY_REAL_TASKS: readonly RealTask[] = [
  {
    ...base,
    id: "is-decimal-single-char",
    title: "is-decimal: reject multi-character input",
    summary:
      "The predicate reads only the first code point, so '12' is accepted as a single decimal character.",
    repoUrl: "https://github.com/wooorm/is-decimal",
    baseCommit: "edc9aaf05e07857a03654115cf5ae8bf9eb74b95",
    issueText:
      "isDecimal('12') currently returns true because the implementation reads only the first code point. The API documents a single character or code point. Make multi-character strings return false without changing behavior for numbers or one-character strings.",
    testCommand:
      "node -e \"import('./index.js').then(({isDecimal})=>process.exit(isDecimal('12')?1:0))\"",
    difficulty: "easy",
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
    difficulty: "easy",
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
    difficulty: "easy",
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
    difficulty: "easy",
  },
  {
    ...base,
    id: "is-whitespace-single-char",
    title: "is-whitespace-character: reject multi-character input",
    summary:
      "A two-character whitespace string is accepted because only the first code point is read.",
    repoUrl: "https://github.com/wooorm/is-whitespace-character",
    baseCommit: "d28a6fc01ae1d41152b765e9a760a906acaa417c",
    issueText:
      "isWhitespaceCharacter('  ') returns true because only the first code point is checked. The predicate describes a single whitespace character. Return false for strings longer than one code point, preserving all existing whitespace characters.",
    testCommand:
      "node -e \"import('./index.js').then(({isWhitespaceCharacter})=>process.exit(isWhitespaceCharacter('  ')?1:0))\"",
    difficulty: "easy",
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
    testCommand: "node -e \"process.exit(require('./index.js')('0x10')?1:0)\"",
    difficulty: "easy",
  },
];
