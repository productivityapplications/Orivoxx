import { describe, expect, it } from "vitest";

import type { LeaderboardEntry } from "./contracts.js";
import { sampleResult } from "./samples.js";
import {
  clampLimit,
  compareLeaderboardEntries,
  rankLeaderboard,
  sortLeaderboard,
} from "./store.js";
import { toLeaderboardEntry } from "./contracts.js";

function entry(options: {
  id: string;
  createdAt: string;
  variant?: "compliant" | "regressed";
  taskId?: string;
}): LeaderboardEntry {
  return toLeaderboardEntry(
    sampleResult({
      resultId: options.id,
      createdAt: options.createdAt,
      variant: options.variant ?? "compliant",
      taskId: options.taskId,
    }),
  );
}

describe("leaderboard ordering", () => {
  const low = entry({
    id: "res_lowlowlowlowlowlowlo",
    createdAt: "2026-11-15T09:00:00.000Z",
    variant: "regressed",
  });
  const high = entry({
    id: "res_highhighhighhighhigh",
    createdAt: "2026-11-15T11:00:00.000Z",
  });

  it("puts the higher score first even when it is newer", () => {
    expect([low, high].sort(compareLeaderboardEntries)).toEqual([high, low]);
  });

  it("breaks a score tie by the earlier result", () => {
    const later = entry({
      id: "res_zzzzzzzzzzzzzzzzzzzz",
      createdAt: "2026-11-15T12:00:00.000Z",
    });
    const earlier = entry({
      id: "res_aaaaaaaaaaaaaaaaaaaa",
      createdAt: "2026-11-15T08:00:00.000Z",
    });

    expect([later, earlier].sort(compareLeaderboardEntries)).toEqual([earlier, later]);
  });

  it("breaks a full tie by result id", () => {
    const b = entry({ id: "res_bbbbbbbbbbbbbbbbbbbbbb", createdAt: "2026-11-15T08:00:00.000Z" });
    const a = entry({ id: "res_aaaaaaaaaaaaaaaaaaaaaa", createdAt: "2026-11-15T08:00:00.000Z" });

    expect([b, a].sort(compareLeaderboardEntries)).toEqual([a, b]);
  });

  it("does not depend on input order", () => {
    const rows = [
      entry({ id: "res_cccccccccccccccccccc", createdAt: "2026-11-15T07:00:00.000Z" }),
      entry({ id: "res_dddddddddddddddddddd", createdAt: "2026-11-15T06:00:00.000Z", variant: "regressed" }),
      entry({ id: "res_eeeeeeeeeeeeeeeeeeee", createdAt: "2026-11-15T05:00:00.000Z", taskId: "linkstash" }),
    ];
    const forward = sortLeaderboard(rows).map((row) => row.resultId);
    const reversed = sortLeaderboard([...rows].reverse()).map((row) => row.resultId);

    expect(reversed).toEqual(forward);
  });

  it("applies a limit after sorting", () => {
    const rows = [low, high];

    expect(rankLeaderboard(rows, 1).map((row) => row.resultId)).toEqual([high.resultId]);
    expect(rankLeaderboard(rows, undefined)).toHaveLength(2);
  });
});

describe("limit clamping", () => {
  it("defaults, truncates, and bounds the limit", () => {
    expect(clampLimit(undefined)).toBe(50);
    expect(clampLimit(Number.NaN)).toBe(50);
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(-4)).toBe(1);
    expect(clampLimit(7.9)).toBe(7);
    expect(clampLimit(10_000)).toBe(200);
  });
});
