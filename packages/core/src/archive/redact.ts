import type { RedactionResult } from "./types.js";

type RedactionCategory =
  | "private_key"
  | "aws_access_key"
  | "github_token"
  | "openrouter_key"
  | "bearer_token"
  | "env_secret_assignment";

interface RedactionRule {
  category: RedactionCategory;
  pattern: RegExp;
  replace: (match: string) => string;
}

const PEM_PRIVATE_KEY_PATTERN =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;
const AWS_ACCESS_KEY_PATTERN = /\bAKIA[0-9A-Z]{16}\b/g;
const GITHUB_TOKEN_PATTERN = /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/g;
const OPENROUTER_KEY_PATTERN = /\bsk-or-v1-[A-Za-z0-9]{32,}\b/g;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._\-]{20,}/g;
const ENV_SECRET_ASSIGNMENT_PATTERN =
  /\b[A-Z][A-Z0-9_]*(?:API_?KEY|SECRET|TOKEN|PASSWORD|PASSWD)\s*=\s*["']?(?!\[REDACTED:)[^\s"']{8,}["']?/g;

function token(category: RedactionCategory): string {
  return `[REDACTED:${category}]`;
}

function replaceEnvSecretAssignment(match: string): string {
  const valueEnd = match.endsWith("'") || match.endsWith('"') ? match.length - 1 : match.length;
  const separatorIndex = match.indexOf("=");
  let valueStart = separatorIndex + 1;

  while (valueStart < valueEnd && /[\s"']/.test(match[valueStart] ?? "")) {
    valueStart += 1;
  }

  return match.slice(0, valueStart) + token("env_secret_assignment") + match.slice(valueEnd);
}

const RULES: readonly RedactionRule[] = [
  {
    category: "private_key",
    pattern: PEM_PRIVATE_KEY_PATTERN,
    replace: () => token("private_key"),
  },
  {
    category: "aws_access_key",
    pattern: AWS_ACCESS_KEY_PATTERN,
    replace: () => token("aws_access_key"),
  },
  {
    category: "github_token",
    pattern: GITHUB_TOKEN_PATTERN,
    replace: () => token("github_token"),
  },
  {
    category: "openrouter_key",
    pattern: OPENROUTER_KEY_PATTERN,
    replace: () => token("openrouter_key"),
  },
  {
    category: "bearer_token",
    pattern: BEARER_TOKEN_PATTERN,
    replace: () => token("bearer_token"),
  },
  {
    category: "env_secret_assignment",
    pattern: ENV_SECRET_ASSIGNMENT_PATTERN,
    replace: replaceEnvSecretAssignment,
  },
];

export function redactSecrets(input: string): RedactionResult {
  let content = input;
  let redactionCount = 0;
  const categories: string[] = [];

  for (const rule of RULES) {
    content = content.replace(rule.pattern, (match: string) => {
      redactionCount += 1;
      if (!categories.includes(rule.category)) {
        categories.push(rule.category);
      }
      return rule.replace(match);
    });
  }

  return { content, redactionCount, categories };
}
