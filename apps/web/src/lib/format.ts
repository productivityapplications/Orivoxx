export type StatusTone =
  | "pass"
  | "fail"
  | "drift"
  | "unverified"
  | "neutral"
  | "sample"
  | "degraded"
  | "harness"
  | "capped";

export function formatScore(value: number): string {
  return value.toFixed(1);
}

export function formatDelta(value: number): string {
  const rounded = Math.round(value * 10) / 10;

  if (rounded === 0) {
    return "0.0";
  }

  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms} ms`;
  }

  return `${(ms / 1000).toFixed(1)} s`;
}

export function requirementStatusTone(status: string): StatusTone {
  switch (status) {
    case "PASS":
      return "pass";
    case "FAIL":
      return "fail";
    case "DRIFT":
      return "drift";
    case "UNVERIFIED":
      return "unverified";
    default:
      return "neutral";
  }
}

export function severityLabel(severity: string): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

export function difficultyLabel(difficulty: string): string {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}

export function adapterKindTone(kind: string): StatusTone {
  return kind === "baseline" ? "sample" : "harness";
}

export function adapterKindLabel(kind: string): string {
  return kind === "baseline" ? "Sample" : "Organizer-run";
}

export function benchLabel(bench: string): string {
  switch (bench) {
    case "spec":
      return "Spec";
    case "security":
      return "Security";
    case "maintainability":
      return "Maintainability";
    default:
      return bench;
  }
}

export function shortId(id: string): string {
  return id.length <= 14 ? id : `${id.slice(0, 10)}…${id.slice(-4)}`;
}

export function capLabel(reason: string): string {
  switch (reason) {
    case "critical-spec-failure":
      return "Critical spec failure — overall capped at 59.9";
    case "critical-security-failure":
      return "Critical security failure — overall capped at 49.9";
    default:
      return reason;
  }
}
