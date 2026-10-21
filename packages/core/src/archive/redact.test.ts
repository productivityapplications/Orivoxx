import { describe, expect, it } from "vitest";

import { redactSecrets } from "./redact.js";

describe("redactSecrets", () => {
  it("redacts PEM private key blocks", () => {
    const input = [
      "before",
      "-----BEGIN RSA PRIVATE KEY-----",
      "MIIEowIBAAKCAQEA1234567890",
      "-----END RSA PRIVATE KEY-----",
      "after",
    ].join("\n");

    const result = redactSecrets(input);

    expect(result.content).toContain("[REDACTED:private_key]");
    expect(result.content).not.toContain("MIIEowIBAAKCAQEA1234567890");
    expect(result.categories).toContain("private_key");
    expect(result.redactionCount).toBe(1);
  });

  it("redacts AWS access key IDs", () => {
    const result = redactSecrets("awsAccessKeyId = 'AKIAABCDEFGHIJKLMNOP';");

    expect(result.content).toContain("[REDACTED:aws_access_key]");
    expect(result.content).not.toContain("AKIAABCDEFGHIJKLMNOP");
    expect(result.categories).toContain("aws_access_key");
  });

  it("redacts GitHub tokens", () => {
    const token = `ghp_${"a".repeat(36)}`;
    const result = redactSecrets(`const token = "${token}";`);

    expect(result.content).toContain("[REDACTED:github_token]");
    expect(result.content).not.toContain(token);
    expect(result.categories).toContain("github_token");
  });

  it("redacts bearer tokens", () => {
    const token = "a".repeat(24);
    const result = redactSecrets(`Authorization: Bearer ${token}`);

    expect(result.content).toContain("[REDACTED:bearer_token]");
    expect(result.content).not.toContain(token);
    expect(result.categories).toContain("bearer_token");
  });

  it("redacts env assignment values while preserving the key", () => {
    const result = redactSecrets("MY_API_KEY=supersecretvalue\nOTHER=value");

    expect(result.content).toBe(
      "MY_API_KEY=[REDACTED:env_secret_assignment]\nOTHER=value",
    );
    expect(result.categories).toContain("env_secret_assignment");
  });

  it("leaves content without secrets unchanged", () => {
    const input = "export function add(a: number, b: number) {\n  return a + b;\n}\n";
    const result = redactSecrets(input);

    expect(result.content).toBe(input);
    expect(result.redactionCount).toBe(0);
    expect(result.categories).toEqual([]);
  });

  it("is idempotent", () => {
    const input = "MY_API_KEY=supersecretvalue\nBearer abcdefghijklmnopqrstuvwxyz";
    const first = redactSecrets(input);
    const second = redactSecrets(first.content);

    expect(second.content).toBe(first.content);
    expect(second.redactionCount).toBe(0);
  });

  it("does not treat a short bearer word as a secret", () => {
    const input = "Bearer alone is not a token.";
    const result = redactSecrets(input);

    expect(result.content).toBe(input);
    expect(result.redactionCount).toBe(0);
  });

  it("does not redact an incomplete PEM marker", () => {
    const input = 'const marker = "-----BEGIN RSA PRIVATE KEY-----";';
    const result = redactSecrets(input);

    expect(result.content).toBe(input);
    expect(result.redactionCount).toBe(0);
  });
});
