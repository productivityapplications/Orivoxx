import { MAX_ELIGIBLE_FILE_BYTES } from "./types.js";

export type PathErrorCode = "traversal_path" | "absolute_path" | "drive_path" | "nul_in_path";

export type PathValidation =
  | { ok: true; path: string }
  | { ok: false; code: PathErrorCode; path: string };

const WINDOWS_DRIVE_PATTERN = /^[A-Za-z]:/;

const EXCLUDED_DIRECTORY_NAMES = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".orivoxx",
  "vendor",
  ".turbo",
  ".pnpm-store",
]);

const PRIVATE_KEY_FILE_EXTENSIONS = [".pem", ".key", ".crt", ".p12", ".pfx", ".jks"];
const CREDENTIAL_FILE_PREFIXES = ["id_rsa", "id_ed25519", "id_ecdsa"];
const PACKAGE_MANAGER_CONFIG_FILES = new Set([".npmrc", ".yarnrc", ".pnpmfile.cjs"]);
const LOCKFILE_NAMES = new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock"]);
const MINIFIED_FILE_SUFFIXES = [".min.js", ".min.css", "-bundle.js", "-bundle.css"];
const BINARY_FILE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp4",
  ".mp3",
  ".wav",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".7z",
  ".rar",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
];

export function normalizeEntryPath(rawPath: string): string {
  return rawPath.replace(/\\/g, "/").replace(/\/+$/g, "");
}

export function isDirectoryEntry(rawPath: string): boolean {
  return rawPath.replace(/\\/g, "/").endsWith("/");
}

export function validateEntryPath(rawPath: string): PathValidation {
  if (rawPath.includes("\0")) {
    return { ok: false, code: "nul_in_path", path: "<nul>" };
  }

  const slashed = rawPath.replace(/\\/g, "/");

  if (slashed.startsWith("/")) {
    return { ok: false, code: "absolute_path", path: slashed };
  }

  if (WINDOWS_DRIVE_PATTERN.test(slashed)) {
    return { ok: false, code: "drive_path", path: slashed };
  }

  const normalized = normalizeEntryPath(rawPath);

  if (normalized.split("/").some((segment) => segment === "..")) {
    return { ok: false, code: "traversal_path", path: normalized };
  }

  if (normalized.length === 0) {
    return { ok: false, code: "traversal_path", path: "<empty>" };
  }

  return { ok: true, path: normalized };
}

export type PathExclusionReason =
  | "excluded_directory"
  | "env_file"
  | "private_key_file"
  | "credential_file"
  | "package_manager_config"
  | "lockfile"
  | "minified_asset"
  | "source_map"
  | "binary_extension";

export function classifyPathExclusion(path: string): PathExclusionReason | null {
  const lowerPath = path.toLowerCase();
  const segments = lowerPath.split("/");
  const baseName = segments[segments.length - 1] ?? "";

  if (segments.some((segment) => EXCLUDED_DIRECTORY_NAMES.has(segment))) {
    return "excluded_directory";
  }

  if (baseName === ".env.example") {
    return null;
  }

  if (baseName === ".env" || baseName.startsWith(".env.")) {
    return "env_file";
  }

  if (PRIVATE_KEY_FILE_EXTENSIONS.some((extension) => baseName.endsWith(extension))) {
    return "private_key_file";
  }

  if (CREDENTIAL_FILE_PREFIXES.some((prefix) => baseName.startsWith(prefix))) {
    return "credential_file";
  }

  if (PACKAGE_MANAGER_CONFIG_FILES.has(baseName)) {
    return "package_manager_config";
  }

  if (baseName.endsWith(".lock") || LOCKFILE_NAMES.has(baseName)) {
    return "lockfile";
  }

  if (MINIFIED_FILE_SUFFIXES.some((suffix) => baseName.endsWith(suffix))) {
    return "minified_asset";
  }

  if (baseName.endsWith(".map")) {
    return "source_map";
  }

  if (BINARY_FILE_EXTENSIONS.some((extension) => baseName.endsWith(extension))) {
    return "binary_extension";
  }

  return null;
}

export function isOversizedEligibleFile(originalSize: number): boolean {
  return originalSize > MAX_ELIGIBLE_FILE_BYTES;
}

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".json": "json",
  ".md": "markdown",
  ".css": "css",
  ".html": "html",
};

export function detectLanguage(path: string): string {
  const baseName = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  const dotIndex = baseName.lastIndexOf(".");

  if (dotIndex <= 0) {
    return "plaintext";
  }

  return LANGUAGE_BY_EXTENSION[baseName.slice(dotIndex)] ?? "plaintext";
}
