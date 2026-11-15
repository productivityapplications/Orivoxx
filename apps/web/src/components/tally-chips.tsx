import { StatusChip } from "./status-chip";

export function TallyChips({
  tally,
}: {
  tally: { passed: number; failed: number; drifted: number; unverified: number };
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Requirement tally">
      <StatusChip tone="pass">{tally.passed} passed</StatusChip>
      <StatusChip tone="fail">{tally.failed} failed</StatusChip>
      <StatusChip tone="drift">{tally.drifted} drifted</StatusChip>
      <StatusChip tone="unverified">{tally.unverified} unverified</StatusChip>
    </div>
  );
}
