import { posix } from "node:path";

import ts from "typescript";

import type { NormalizedFile } from "../archive/types.js";

export interface StaticReference {
  path: string;
  line: number;
}

export type StaticReferenceFailureReason = "unsupported_language" | "parse_error";

export type StaticReferenceParseResult =
  | { ok: true; references: StaticReference[] }
  | { ok: false; reason: StaticReferenceFailureReason };

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function scriptKindFor(path: string): ts.ScriptKind | null {
  const lowerPath = path.toLowerCase();

  if (lowerPath.endsWith(".tsx")) {
    return ts.ScriptKind.TSX;
  }

  if (lowerPath.endsWith(".ts")) {
    return ts.ScriptKind.TS;
  }

  if (lowerPath.endsWith(".jsx")) {
    return ts.ScriptKind.JSX;
  }

  if (
    lowerPath.endsWith(".js") ||
    lowerPath.endsWith(".mjs") ||
    lowerPath.endsWith(".cjs")
  ) {
    return ts.ScriptKind.JS;
  }

  return null;
}

function resolveRelativeSpecifier(importerPath: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) {
    return null;
  }

  if (specifier.includes("\0")) {
    return null;
  }

  const resolved = posix
    .normalize(posix.join(posix.dirname(importerPath), specifier))
    .replace(/\/+$/g, "");

  if (resolved.length === 0 || resolved === "." || resolved === "..") {
    return null;
  }

  if (resolved.startsWith("../") || resolved.startsWith("/")) {
    return null;
  }

  if (resolved.split("/").some((segment) => segment === "..")) {
    return null;
  }

  return resolved;
}

interface FoundSpecifier {
  specifier: string;
  position: number;
}

function collectSpecifier(node: ts.Node, sourceFile: ts.SourceFile): FoundSpecifier | null {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
    const moduleSpecifier = node.moduleSpecifier;

    if (moduleSpecifier !== undefined && ts.isStringLiteral(moduleSpecifier)) {
      return {
        specifier: moduleSpecifier.text,
        position: node.getStart(sourceFile),
      };
    }

    return null;
  }

  if (!ts.isCallExpression(node) || node.arguments.length !== 1) {
    return null;
  }

  const firstArgument = node.arguments[0];

  if (firstArgument === undefined || !ts.isStringLiteral(firstArgument)) {
    return null;
  }

  if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
    return {
      specifier: firstArgument.text,
      position: node.getStart(sourceFile),
    };
  }

  if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
    return {
      specifier: firstArgument.text,
      position: node.getStart(sourceFile),
    };
  }

  return null;
}

function visit(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  importerPath: string,
  output: StaticReference[],
): void {
  const found = collectSpecifier(node, sourceFile);

  if (found !== null) {
    const resolved = resolveRelativeSpecifier(importerPath, found.specifier);

    if (resolved !== null) {
      output.push({
        path: resolved,
        line: sourceFile.getLineAndCharacterOfPosition(found.position).line + 1,
      });
    }
  }

  ts.forEachChild(node, (child) => visit(child, sourceFile, importerPath, output));
}

export function parseStaticReferences(file: NormalizedFile): StaticReferenceParseResult {
  const scriptKind = scriptKindFor(file.path);

  if (scriptKind === null) {
    return { ok: false, reason: "unsupported_language" };
  }

  let sourceFile: ts.SourceFile;

  try {
    sourceFile = ts.createSourceFile(
      file.path,
      file.content,
      ts.ScriptTarget.Latest,
      false,
      scriptKind,
    );
  } catch {
    return { ok: false, reason: "parse_error" };
  }

  const parseDiagnostics = (
    sourceFile as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }
  ).parseDiagnostics;

  if (parseDiagnostics !== undefined && parseDiagnostics.length > 0) {
    return { ok: false, reason: "parse_error" };
  }

  const collected: StaticReference[] = [];
  visit(sourceFile, sourceFile, file.path, collected);

  const firstByPath = new Map<string, StaticReference>();

  for (const reference of collected) {
    if (!firstByPath.has(reference.path)) {
      firstByPath.set(reference.path, reference);
    }
  }

  const references = [...firstByPath.values()].sort(
    (left, right) => compareStrings(left.path, right.path) || left.line - right.line,
  );

  return { ok: true, references };
}

export function extractStaticReferences(file: NormalizedFile): string[] {
  const parsed = parseStaticReferences(file);

  return parsed.ok ? parsed.references.map((reference) => reference.path) : [];
}
