import type { Metadata } from "next";
import Link from "next/link";

import { groupReliability } from "@orivoxx/results";
import { CURATED_REAL_TASKS } from "@orivoxx/benchmarks";

import { StatusChip } from "@/components/status-chip";
import { webLeaderboard } from "@/server/results";
import { taskSummaries } from "@/server/tasks";

export const metadata: Metadata = { title: "App" };
export const dynamic = "force-dynamic";

const LAYER_COLORS: Record<string, string> = {
  spec: "bg-progress",
  model: "bg-accent-secondary",
  harness: "bg-fail",
  tool: "bg-unverified",
  environment: "bg-neutral",
};

function MiniReliability({ distribution }: { distribution: Record<string, number> }) {
  const total = Object.values(distribution).reduce((sum, value) => sum + value, 0);
  const layers = Object.entries(distribution).filter(([, value]) => value > 0);

  return (
    <div className="flex h-1.5 w-24 overflow-hidden rounded-full bg-raised" aria-hidden="true">
      {total === 0 ? <span className="h-full w-full bg-border-strong" /> : null}
      {layers.map(([layer, value]) => (
        <span key={layer} className={`h-full ${LAYER_COLORS[layer] ?? "bg-neutral"}`} style={{ width: `${(value / total) * 100}%` }} />
      ))}
    </div>
  );
}

export default async function AppHomePage() {
  const [board, tasks] = await Promise.all([
    webLeaderboard({ limit: 50, kind: "agents" }),
    Promise.resolve(taskSummaries()),
  ]);
  const reliability = groupReliability(board.entries);
  const attributed = board.entries.filter((entry) => entry.attribution != null);
  const passing = board.entries.filter((entry) => entry.overall >= 70 && entry.run.status === "completed");
  const recent = [...board.entries]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 5);
  const proofEntry =
    attributed.find((entry) => entry.realTask !== undefined && entry.attribution?.proof != null) ??
    attributed.find((entry) => entry.attribution?.proof != null);

  return (
    <div className="space-y-12">
      {/* Orientation */}
      <header className="grid gap-8 border-b border-border-subtle pb-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            \ BENCHMARK CONTROL ROOM \
          </p>
          <h1 className="mt-4 font-display text-[clamp(2.6rem,5vw,4rem)] leading-[1.0] tracking-[-0.03em]">
            Benchmark the agent. Attribute the failure.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-secondary">
            Versioned tasks, sandboxed runs, deterministic scores, and counterfactual proofs.
            Start with a baseline, inject a fault, then open the replay.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/submit" className="rounded-full bg-accent px-4 py-2 text-xs font-medium text-app hover:opacity-90">
              Run the baseline
            </Link>
            <Link href="/benchmarks" className="rounded-full border border-border-strong px-4 py-2 text-xs text-primary hover:border-accent">
              Browse tasks
            </Link>
            <Link href="/leaderboard" className="rounded-full border border-border-subtle px-4 py-2 text-xs text-secondary hover:border-border-strong">
              Leaderboard
            </Link>
            <Link href="/docs/attribution" className="rounded-full border border-border-subtle px-4 py-2 text-xs text-secondary hover:border-border-strong">
              Read the method
            </Link>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-2 self-end">
          {[
            ["Tasks", String(tasks.length + CURATED_REAL_TASKS.length)],
            ["Adapters", "4"],
            ["Results", String(board.entries.length)],
            ["Attributed", String(attributed.length)],
            ["Pass rate", `${Math.round((passing.length / Math.max(1, board.entries.length)) * 100)}%`],
            ["Store", board.store],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-border-subtle bg-panel px-3 py-3">
              <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">{label}</dt>
              <dd className="mt-1 font-mono text-lg text-primary">{value}</dd>
            </div>
          ))}
        </dl>
      </header>

      {/* 01 Leaderboard snapshot */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">\ 01 \ TOP RESULTS</p>
            <h2 className="mt-2 font-display text-3xl tracking-[-0.02em]">The current board.</h2>
          </div>
          <Link href="/leaderboard" className="text-xs text-accent-secondary hover:underline">View full leaderboard →</Link>
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border-subtle">
          <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
            <caption className="sr-only">Top results with reliability</caption>
            <thead>
              <tr className="border-b border-border-subtle bg-panel font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                <th scope="col" className="px-3 py-2 font-medium">Rank</th>
                <th scope="col" className="px-3 py-2 font-medium">Adapter</th>
                <th scope="col" className="px-3 py-2 font-medium">Task</th>
                <th scope="col" className="px-3 py-2 font-medium">Model</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Score</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Pass@k</th>
                <th scope="col" className="px-3 py-2 font-medium">Reliability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle bg-panel/50">
              {board.entries.slice(0, 4).map((entry, index) => {
                const profile = reliability.find((group) => group.adapterId === entry.adapter.id && group.taskId === entry.taskId)?.profile;
                return (
                  <tr key={entry.resultId} className="hover:bg-raised">
                    <td className="px-3 py-3 font-mono text-xs text-muted">{index + 1}</td>
                    <td className="px-3 py-3 text-secondary">
                      <Link href={`/results/${entry.resultId}`} className="hover:text-primary">{entry.adapter.label}</Link>
                    </td>
                    <td className="px-3 py-3 text-secondary">{entry.taskId}</td>
                    <td className="px-3 py-3 font-mono text-[11px] text-muted">{entry.model?.name ?? "no model"}</td>
                    <td className="px-3 py-3 text-right font-mono text-primary">{entry.overall.toFixed(1)}</td>
                    <td className="px-3 py-3 text-right font-mono text-xs text-secondary">{profile ? `${Math.round(profile.passAtK * 100)}%` : "—"}</td>
                    <td className="px-3 py-3">
                      {profile ? (
                        <div className="flex items-center gap-2">
                          <MiniReliability distribution={profile.layerDistribution} />
                          <span className="font-mono text-[10px] text-muted">{profile.runs}</span>
                        </div>
                      ) : <span className="text-xs text-muted">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 02 Task catalogue */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">\ 02 \ TASKS</p>
            <h2 className="mt-2 font-display text-3xl tracking-[-0.02em]">Versioned, immutable, scored.</h2>
          </div>
          <Link href="/benchmarks" className="text-xs text-accent-secondary hover:underline">Browse all →</Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {tasks.slice(0, 3).map((task) => (
            <Link key={task.id} href={task.kind === "real" ? `/tasks/${task.id}` : `/benchmarks/${task.id}`} className="rounded-xl border border-border-subtle bg-panel p-4 transition-colors hover:border-border-strong">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">{task.id} · v{task.version}</p>
                <StatusChip tone="neutral">{task.difficulty}</StatusChip>
              </div>
              <p className="mt-3 text-sm text-primary">{task.title}</p>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-secondary">{task.summary}</p>
              <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-border-subtle pt-3 font-mono text-[10px] text-muted">
                <div><dt>requirements</dt><dd className="mt-0.5 text-secondary">{task.requirementCount}</dd></div>
                <div><dt>pass threshold</dt><dd className="mt-0.5 text-secondary">{task.passThreshold}</dd></div>
              </dl>
            </Link>
          ))}
        </div>
      </section>

      {/* 03 Recent runs */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">\ 03 \ RECENT RUNS</p>
            <h2 className="mt-2 font-display text-3xl tracking-[-0.02em]">The last five hand-offs.</h2>
          </div>
          <Link href="/leaderboard" className="text-xs text-accent-secondary hover:underline">All results →</Link>
        </div>
        <div className="mt-4 divide-y divide-border-subtle rounded-xl border border-border-subtle">
          {recent.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">No runs yet. Start with the baseline.</p>
          ) : recent.map((entry) => (
            <Link key={entry.resultId} href={`/results/${entry.resultId}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-raised">
              <span className="font-mono text-xs text-muted">{new Date(entry.createdAt).toISOString().slice(5, 16).replace("T", " ")}</span>
              <span className="min-w-[10rem] text-xs text-secondary">{entry.adapter.label}</span>
              <span className="text-xs text-muted">{entry.taskId}</span>
              <span className="font-mono text-xs text-primary">{entry.overall.toFixed(1)}</span>
              <span className="ml-auto flex items-center gap-2">
                {entry.attribution ? (
                  <StatusChip tone="fail">{entry.attribution.layer} × {entry.attribution.mode}</StatusChip>
                ) : entry.chaos ? (
                  <StatusChip tone="unverified">{entry.chaos.kind}</StatusChip>
                ) : (
                  <StatusChip tone="pass">passed</StatusChip>
                )}
                <span className="text-muted">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 04 How attribution works */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">\ 04 \ ATTRIBUTION</p>
        <div className="mt-2 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="font-display text-3xl tracking-[-0.02em]">One intervention. One proof.</h2>
            <p className="mt-3 text-sm leading-7 text-secondary">
              {proofEntry?.realTask ? (
                <>
                  Replay reconstructs the workspace from the recorded files, applies the intercepted
                  action, and re-runs the real test command in the sandbox. Before step k the prefix
                  is byte-identical. No model call enters the score.
                </>
              ) : (
                <>
                  Replay writes the recorded actions into a fresh file map, applies one intervention,
                  and scores statically. Before step k the prefix is byte-identical. No model call.
                </>
              )}
            </p>
            {proofEntry ? (
              <Link href={`/replay/${proofEntry.resultId}`} className="mt-4 inline-block text-xs text-accent-secondary hover:underline">
                Open a real proof →
              </Link>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["baseline", proofEntry ? proofEntry.overall.toFixed(1) : "0.0"],
              ["intervention", `retry @ ${proofEntry?.attribution?.proof?.intervention.stepIndex ?? 2}`],
              ["replay", `${proofEntry?.attribution?.proof?.counterfactual.replayedSteps ?? 6} steps`],
              ["proof", proofEntry?.attribution?.proof ? proofEntry.attribution.proof.counterfactual.overall.toFixed(1) : "100.0"],
            ].map(([label, value], index) => (
              <div key={label} className="rounded-xl border border-border-subtle bg-panel p-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">{label}</p>
                <p className="mt-2 font-mono text-sm text-primary">{value}</p>
                <p className="mt-2 text-[9px] text-accent">{index === 3 ? "PASS" : "→"}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 05 CLI */}
      <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">\ 05 \ QUICK START</p>
          <h2 className="mt-2 font-display text-3xl tracking-[-0.02em]">Three commands.</h2>
          <p className="mt-3 text-sm leading-7 text-secondary">
            Organizer runs execute in Docker. The public app reads the immutable result and never
            runs an arbitrary command.
          </p>
        </div>
        <div className="rounded-xl border border-border-subtle bg-inset p-4 font-mono text-[11px] leading-6 text-secondary">
          <p><span className="text-accent">$</span> orivoxx bench --task itsdangerous-future-signature --chaos failing_tools</p>
          <p className="text-muted">49.7 · harness × recovery · 6 tool calls</p>
          <p className="mt-3"><span className="text-accent">$</span> orivoxx replay --result res_c1ba8d7</p>
          <p className="text-muted">retry_policy@2 → 98.3 · PASS</p>
          <p className="mt-3"><span className="text-accent">$</span> orivoxx diff --a res_c1ba8d7 --b res_85394c</p>
          <p className="text-muted">+48.6 score · -20% tool errors</p>
        </div>
      </section>

      {/* Your tasks */}
      <section className="rounded-xl border border-border-subtle bg-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">\ YOUR TASKS \</p>
            <p className="mt-1 text-sm text-primary">Submit a repo issue or review your validations.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/tasks/mine" className="rounded-full border border-border-subtle px-3 py-1.5 text-xs text-secondary">Your tasks</Link>
            <Link href="/tasks/new" className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-app">Submit</Link>
          </div>
        </div>
      </section>

      {/* 06 Chaos */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">\ 06 \ RESILIENCE</p>
        <h2 className="mt-2 font-display text-3xl tracking-[-0.02em]">Inject the fault. Measure the recovery.</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[
            ["tool_error", "A write fails with EACCES. The harness either retries or loses the artifact.", "Run with tool_error"],
            ["failing_tools", "The real-task apply_patch is intercepted. The replay retries it and re-runs the real test.", "Run with failing_tools"],
            ["latency", "Every model call is delayed. The stopping policy is tested against the clock.", "Run with latency"],
            ["context_pressure", "Context is truncated and the step budget shrinks. Completeness is tested.", "Run with context_pressure"],
          ].map(([kind, body, cta]) => (
            <div key={kind} className="rounded-xl border border-border-subtle bg-panel p-4">
              <p className="font-mono text-[11px] text-accent">{kind}</p>
              <p className="mt-2 text-xs leading-5 text-secondary">{body}</p>
              <Link href={`/submit?chaos=${kind}`} className="mt-4 inline-block text-[11px] text-accent-secondary hover:underline">{cta} →</Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
