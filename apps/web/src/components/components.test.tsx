// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LeaderboardTable } from "./leaderboard-table";
import { RequirementList, type RequirementRow } from "./requirement-list";
import { ScoreBlock } from "./score-block";
import { StatusChip } from "./status-chip";
import { TallyChips } from "./tally-chips";

afterEach(cleanup);

describe("StatusChip", () => {
  it("renders its label as text, not color alone", () => {
    render(<StatusChip tone="fail">Fail</StatusChip>);

    expect(screen.getByText("Fail").textContent).toBe("Fail");
  });
});

describe("ScoreBlock", () => {
  it("shows the overall score and a labelled bar per bench", () => {
    render(
      <ScoreBlock overall={97.3} benches={{ spec: 100, security: 100, maintainability: 82 }} />,
    );

    expect(screen.getByText(/97\.3/)).toBeTruthy();
    expect(screen.getByLabelText("Spec score 100.0 out of 100")).toBeTruthy();
    expect(screen.getByLabelText("Security score 100.0 out of 100")).toBeTruthy();
    expect(screen.getByLabelText("Maintainability score 82.0 out of 100")).toBeTruthy();
  });
});

describe("RequirementList", () => {
  const requirements: RequirementRow[] = [
    {
      id: "REQ-A",
      title: "Owner scoped",
      description: "The route checks ownership.",
      severity: "critical",
      bench: "spec",
      status: "PASS",
      checks: [{ type: "text_contains", path: "src/a.ts", text: "assertOwner" }],
    },
    {
      id: "REQ-B",
      title: "Task route",
      description: "The task route exists.",
      severity: "high",
      bench: "spec",
      status: "FAIL",
      checks: [{ type: "file_exists", path: "src/b.ts" }],
    },
  ];

  it("expands the first row by default and toggles on click", () => {
    render(<RequirementList requirements={requirements} />);

    const first = screen.getByRole("button", { name: /Owner scoped/ });
    const second = screen.getByRole("button", { name: /Task route/ });

    expect(first.getAttribute("aria-expanded")).toBe("true");
    expect(second.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(first);
    expect(first.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(second);
    expect(second.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/did not match/)).toBeTruthy();
  });

  it("renders the declared rule and an explicit UNVERIFIED outcome", () => {
    render(
      <RequirementList
        requirements={[{ ...requirements[0]!, id: "REQ-C", status: "UNVERIFIED" }]}
      />,
    );

    expect(screen.getByText(/No evidence was available/)).toBeTruthy();
    expect(screen.getByText(/text_contains/)).toBeTruthy();
  });
});

describe("TallyChips", () => {
  it("counts unverified separately from failures", () => {
    render(<TallyChips tally={{ passed: 7, failed: 1, drifted: 0, unverified: 3 }} />);

    expect(screen.getByText("7 passed")).toBeTruthy();
    expect(screen.getByText("1 failed")).toBeTruthy();
    expect(screen.getByText("3 unverified")).toBeTruthy();
  });
});

describe("LeaderboardTable", () => {
  const rows = [
    {
      resultId: "res_aaaaaaaaaaaaaaaaaaaaaaaa",
      createdAt: "2026-11-15T10:00:00.000Z",
      taskId: "taskboard",
      overall: 99.5,
      benches: { spec: 100, security: 100, maintainability: 96.7 },
      capsApplied: [],
      adapter: { id: "fake", label: "Fake fixture", kind: "baseline" },
      model: null,
    },
    {
      resultId: "res_bbbbbbbbbbbbbbbbbbbbbbbb",
      createdAt: "2026-11-15T09:00:00.000Z",
      taskId: "taskboard",
      overall: 59.9,
      benches: { spec: 52.4, security: 100, maintainability: 90 },
      capsApplied: ["critical-spec-failure"],
      adapter: { id: "aider-openrouter", label: "Aider", kind: "harness" },
      model: { name: "openai/gpt-4o-mini" },
    },
  ];

  it("renders rank order, adapter labels, and cap flags", () => {
    render(<LeaderboardTable rows={rows} caption="Test leaderboard" />);

    expect(screen.getByRole("table", { name: "Test leaderboard" })).toBeTruthy();
    expect(screen.getByText("Sample")).toBeTruthy();
    expect(screen.getByText("Organizer-run")).toBeTruthy();
    expect(screen.getByText("Capped")).toBeTruthy();
    expect(screen.getByText("openai/gpt-4o-mini")).toBeTruthy();

    const links = screen.getAllByRole("link", { name: "99.5" });

    expect(links[0]?.getAttribute("href")).toBe("/results/res_aaaaaaaaaaaaaaaaaaaaaaaa");
  });
});
