import { benchLabel, formatScore } from "@/lib/format";

const ORDER = ["spec", "security", "maintainability"] as const;

const WEIGHTS: Record<(typeof ORDER)[number], string> = {
  spec: "60%",
  security: "25%",
  maintainability: "15%",
};

const BAR: Record<(typeof ORDER)[number], string> = {
  spec: "bg-accent",
  security: "bg-accent-secondary",
  maintainability: "bg-pass",
};

export function ScoreBlock({
  overall,
  benches,
}: {
  overall: number;
  benches: { spec: number; security: number; maintainability: number };
}) {
  return (
    <section
      aria-label="Score"
      className="rounded-lg border border-border-subtle bg-panel p-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-muted">Overall</p>
          <p className="mt-1 font-mono text-5xl leading-none tracking-tight text-primary">
            {formatScore(overall)}
            <span className="ml-2 align-middle font-sans text-sm font-normal text-muted">
              / 100
            </span>
          </p>
        </div>
        <p className="max-w-[16rem] text-xs leading-5 text-muted">
          Spec conformance, security patterns, and structural maintainability. No model
          call contributes to this number.
        </p>
      </div>

      <dl className="mt-5 space-y-3">
        {ORDER.map((bench) => {
          const value = benches[bench];

          return (
            <div key={bench} className="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-3">
              <dt className="text-xs text-secondary">
                {benchLabel(bench)}{" "}
                <span className="font-mono text-[11px] text-muted">{WEIGHTS[bench]}</span>
              </dt>
              <dd
                role="img"
                aria-label={`${benchLabel(bench)} score ${formatScore(value)} out of 100`}
                className="h-1.5 overflow-hidden rounded-full bg-raised"
              >
                <span
                  className={`block h-full rounded-full ${BAR[bench]}`}
                  style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
                />
              </dd>
              <dd className="text-right font-mono text-xs text-secondary">
                {formatScore(value)}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
