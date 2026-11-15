import type { StatusTone } from "@/lib/format";

const TONE_STYLES: Record<StatusTone, string> = {
  pass: "border-pass/45 text-pass",
  fail: "border-fail/45 text-fail",
  drift: "border-drift/45 text-drift",
  unverified: "border-unverified/45 text-unverified",
  neutral: "border-border-strong text-secondary",
  sample: "border-accent/40 text-accent",
  degraded: "border-unverified/45 text-unverified",
  harness: "border-accent-secondary/40 text-accent-secondary",
  capped: "border-fail/45 text-fail",
};

export function StatusChip({
  tone,
  children,
  title,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.04em] ${TONE_STYLES[tone]}`}
    >
      {children}
    </span>
  );
}
