import Link from "next/link";

import { MarketingShell } from "@/components/marketing-shell";
import { StatusChip } from "@/components/status-chip";
import { groupReliability } from "@orivoxx/results";

import { webLeaderboard } from "@/server/results";
import { taskSummaries } from "@/server/tasks";

export const dynamic = "force-dynamic";

const LAYER_COLORS: Record<string, string> = {
  spec: "bg-progress",
  model: "bg-accent-secondary",
  harness: "bg-fail",
  tool: "bg-unverified",
  environment: "bg-neutral",
};

function ReliabilityBar({ distribution }: { distribution: Record<string, number> }) {
  const total = Object.values(distribution).reduce((sum, value) => sum + value, 0);
  const layers = Object.entries(distribution).filter(([, value]) => value > 0);

  return (
    <div className="flex h-1.5 w-28 overflow-hidden rounded-full bg-raised" aria-hidden="true">
      {total === 0 ? <span className="h-full w-full bg-border-strong" /> : null}
      {layers.map(([layer, value]) => (
        <span
          key={layer}
          className={`h-full ${LAYER_COLORS[layer] ?? "bg-neutral"}`}
          style={{ width: `${(value / total) * 100}%` }}
        />
      ))}
    </div>
  );
}

export default async function LandingPage() {
  const [board, tasks] = await Promise.all([
    webLeaderboard({ limit: 50, kind: "agents" }),
    Promise.resolve(taskSummaries()),
  ]);
  const reliability = groupReliability(board.entries);
  const topRows = board.entries.slice(0, 4);
  const attributed =
    board.entries.find((entry) => entry.realTask !== undefined && entry.attribution?.proof != null) ??
    board.entries.find((entry) => entry.attribution?.proof != null);
  const proof = attributed?.attribution?.proof;
  const realTasks = tasks.filter((task) => task.kind === "real");
  const sampleTask = realTasks[0] ?? tasks[0];

  return (
    <MarketingShell>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border-subtle">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]"
        />
        <div className="relative mx-auto grid w-full max-w-[1280px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              HackCulture Global AI Hackathon — Benchmarking track
            </span>
            <h1 className="mt-6 font-display text-[clamp(3rem,6vw,4.5rem)] leading-[0.98] tracking-[-0.03em] text-primary">
              Benchmark the agent, not just the model.
            </h1>
            <p className="mt-6 max-w-xl text-[15px] leading-7 text-secondary">
              Orivoxx runs an agent against a versioned specification in a hardened sandbox,
              scores the produced repository deterministically, and attributes every failure to a
              layer and a mode — with a replay that proves the fix.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/leaderboard"
                className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-app transition-opacity hover:opacity-90"
              >
                View leaderboard
              </Link>
              <Link
                href="/docs"
                className="rounded-full border border-border-strong px-5 py-2.5 text-sm text-primary transition-colors hover:border-accent"
              >
                Read the docs
              </Link>
            </div>

            <div className="mt-7 flex flex-wrap gap-2">
              {["Deterministic", "Model-agnostic", "Failure attribution", "Reproducible"].map(
                (pill) => (
                  <span
                    key={pill}
                    className="rounded-full border border-border-subtle bg-panel px-3 py-1 text-xs text-secondary"
                  >
                    {pill}
                  </span>
                ),
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
              <span>No LLM in the score</span>
              <span>Sandboxed execution</span>
              <span>Attributed tool failures carry proof</span>
            </div>
          </div>

          {/* Real artifact: attributed result card */}
          <div className="rounded-2xl border border-border-subtle bg-panel p-4 shadow-2xl shadow-black/30">
            <div className="flex items-center justify-between gap-2 border-b border-border-subtle pb-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                latest attributed run
              </p>
              <StatusChip tone="harness">Organizer-run</StatusChip>
            </div>

            {attributed !== undefined && proof != null ? (
              <>
                <div className="mt-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[11px] text-muted">{attributed.taskId}</p>
                    <p className="mt-1 text-sm text-primary">
                      {attributed.adapter.label}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted">
                      {attributed.model?.name ?? "no model"}
                    </p>
                  </div>
                  <p className="font-mono text-3xl text-primary">{attributed.overall.toFixed(1)}</p>
                </div>

                <div className="mt-4 rounded-xl border border-fail/30 bg-fail/5 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip tone="fail">Attributed</StatusChip>
                    <p className="text-sm text-primary">
                      {attributed.attribution?.layer} × {attributed.attribution?.mode}
                    </p>
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-secondary">
                    {attributed.attribution?.evidence[0]?.detail}
                  </p>
                  <p className="mt-2 font-mono text-[11px] text-accent">
                    proof: {proof.baseline.overall.toFixed(1)} → {proof.counterfactual.overall.toFixed(1)} after retry at step {proof.intervention.stepIndex}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-muted">
                  <span>{board.entries.length} results in store</span>
                  <Link href={`/results/${attributed.resultId}`} className="text-accent-secondary hover:underline">
                    Open result →
                  </Link>
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-border-subtle p-5 text-sm text-secondary">
                No attributed run is stored yet. Run the baseline with a chaos mode to create one.
                <Link href="/app" className="mt-3 block text-accent-secondary hover:underline">
                  Open the app →
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="border-b border-border-subtle">
        <div className="mx-auto w-full max-w-[1280px] px-5 py-20 sm:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            \ THE PROBLEM \ <span className="text-accent">\ 01 \</span>
          </p>
          <div className="mt-5 grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <h2 className="font-display text-[clamp(2.4rem,4.5vw,3.8rem)] leading-[1.02] tracking-[-0.03em]">
              A trace tells you what happened. It does not tell you why.
            </h2>
            <div className="space-y-5 text-sm leading-7 text-secondary">
              <p>
                Developers stare at a 47-step trace and guess which layer failed. The model? The
                harness? A tool? The specification itself? Every guess costs another full run.
              </p>
              <div className="rounded-xl border border-border-subtle bg-panel p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                  the hand-offs where signal is lost
                </p>
                <div className="mt-4 grid grid-cols-5 gap-1 text-center font-mono text-[10px]">
                  {["SPEC", "MODEL", "HARNESS", "TOOL", "ENV"].map((layer, index) => (
                    <div key={layer} className="rounded border border-border-subtle bg-inset px-1 py-3">
                      <span className="block text-accent">{String(index + 1).padStart(2, "0")}</span>
                      <span className="mt-1 block text-secondary">{layer}</span>
                      <span className="mt-2 block text-[9px] text-fail">signal lost</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] leading-5 text-muted">
                  The agent sees an error, retries the wrong thing, or silently drops the result.
                  The artifact fails, but the cause is not in the diff.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-3 md:grid-cols-3">
            {[
              ["Model blamed for harness bugs", "A swallowed tool error looks like bad reasoning when the harness never retried."],
              ["Tool failures look like decisions", "A transient EACCES and a wrong design choice produce the same failed artifact."],
              ["No way to test a fix", "Re-running the whole agent to test one policy change is slow, noisy, and expensive."],
            ].map(([title, body], index) => (
              <div key={title} className="rounded-xl border border-border-subtle bg-panel p-5">
                <span className="font-mono text-[11px] text-accent">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 text-sm font-medium text-primary">{title}</h3>
                <p className="mt-2 text-xs leading-6 text-secondary">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="border-b border-border-subtle bg-panel/30">
        <div className="mx-auto w-full max-w-[1280px] px-5 py-20 sm:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            \ THE SOLUTION \ <span className="text-accent">\ 02 \</span>
          </p>
          <div className="mt-5 grid gap-10 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <h2 className="font-display text-[clamp(2.4rem,4.5vw,3.8rem)] leading-[1.02] tracking-[-0.03em]">
                A deterministic benchmark with an attribution layer.
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-secondary">
                The score is the substrate. The attribution is the product. Every failure gets a
                cell in a 5×4 taxonomy and a counterfactual replay that crosses the pass threshold.
              </p>
              <div className="mt-8 space-y-3">
                {[
                  ["Deterministic scoring", "Declared checks and static analysis. No LLM in the loop; every point traces to a rule.", "SCORE"],
                  ["Counterfactual attribution", "Layer × mode with evidence, then a replay that changes one thing and proves the delta.", "ATTRIBUTE"],
                  ["Reproducibility", "Versioned tasks, rulesets, adapters, and a repository fingerprint on every row.", "REPLAY"],
                ].map(([title, body, label], index) => (
                  <div key={title} className="flex gap-4 rounded-xl border border-border-subtle bg-app p-4">
                    <span className="font-mono text-[11px] text-accent">{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <p className="text-sm text-primary">{title}</p>
                      <p className="mt-1 text-xs leading-6 text-secondary">{body}</p>
                      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-app p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">attribution card</p>
              <div className="mt-4 flex items-center gap-2">
                <StatusChip tone="fail">FAIL</StatusChip>
                <span className="text-sm text-primary">harness × recovery</span>
              </div>
              <div className="mt-4 space-y-2 font-mono text-[11px] leading-5 text-secondary">
                <p><span className="text-muted">evidence</span> step 2, write_file → EACCES, no retry</p>
                <p><span className="text-muted">proof</span> replay with retry policy → PASS</p>
                <p><span className="text-muted">delta</span> 0.0 → 100.0</p>
                <p><span className="text-muted">scope</span> intervention at 2, replay 3–7, static scoring</p>
              </div>
              <div className="mt-4 h-px bg-border-subtle" />
              <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-muted">
                <div><span className="block font-mono text-lg text-primary">5×4</span>taxonomy cells</div>
                <div><span className="block font-mono text-lg text-primary">0</span>model calls in replay</div>
              </div>
              {attributed !== undefined ? (
                <Link href={`/results/${attributed.resultId}`} className="mt-4 inline-block text-xs text-accent-secondary hover:underline">
                  View the real proof →
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-border-subtle">
        <div className="mx-auto w-full max-w-[1280px] px-5 py-20 sm:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            \ HOW IT WORKS \ <span className="text-accent">\ 03 \</span>
          </p>
          <h2 className="mt-5 max-w-3xl font-display text-[clamp(2.4rem,4.5vw,3.8rem)] leading-[1.02] tracking-[-0.03em]">
            Five steps. One reproducible record.
          </h2>
          <div className="mt-10 grid gap-3 md:grid-cols-5">
            {[
              ["01", "Spec", "A versioned task pins the spec, ruleset, scoring config, and starting files."],
              ["02", "Run", "The agent executes in Docker; model calls pass through one allowlisted proxy."],
              ["03", "Score", "Static checks and structural analysis produce the artifact score."],
              ["04", "Attribute", "Rules map the failure to layer × mode with step-level evidence."],
              ["05", "Replay", "A recorded intervention re-runs the tail and proves pass/fail."],
            ].map(([index, title, body]) => (
              <div key={index} className="rounded-xl border border-border-subtle bg-panel p-4">
                <p className="font-mono text-[10px] text-accent">{index}</p>
                <p className="mt-2 text-sm text-primary">{title}</p>
                <p className="mt-2 text-[11px] leading-5 text-secondary">{body}</p>
                <div className="mt-4 rounded border border-border-subtle bg-inset px-2 py-1.5 font-mono text-[9px] text-muted">
                  {index === "01" && "task 1.0.0 · ruleset 1.0.0"}
                  {index === "02" && "trace 54 events · 7 tools"}
                  {index === "03" && "score 0.0 · test failed"}
                  {index === "04" && "harness × recovery"}
                  {index === "05" && "0.0 → 100.0 · PASS"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Measurement */}
      <section className="border-b border-border-subtle bg-panel/30">
        <div className="mx-auto w-full max-w-[1280px] px-5 py-20 sm:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            \ MEASUREMENT \ <span className="text-accent">\ 04 \</span>
          </p>
          <div className="mt-5 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <h2 className="font-display text-[clamp(2.4rem,4.5vw,3.8rem)] leading-[1.02] tracking-[-0.03em]">
                Six metrics. Four chaos modes. One reliability profile.
              </h2>
              <p className="mt-5 text-sm leading-7 text-secondary">
                The track asks for six metrics and resilience testing. Those are the substrate.
                Attribution is the layer above them: it names where the loss entered and proves a
                fix without guessing.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ["Artifact score", "0–100, severity weighted"],
                ["Steps", "model + tool steps"],
                ["Tool calls", "count + error rate"],
                ["Tokens", "prompt + completion"],
                ["Cost", "provider usage"],
                ["Duration", "wall clock"],
              ].map(([metric, detail]) => (
                <div key={metric} className="rounded-xl border border-border-subtle bg-app p-3">
                  <p className="text-xs text-primary">{metric}</p>
                  <p className="mt-1 font-mono text-[10px] text-muted">{detail}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {[
              ["tool_error", "One write fails with EACCES; the harness either retries or loses the file."],
              ["failing_tools", "The real-task apply_patch is intercepted; the replay retries it."],
              ["latency", "Every model call gets a fixed delay; the stopping policy is tested."],
              ["context_pressure", "Context is truncated and the step budget shrinks; completeness is tested."],
            ].map(([kind, body]) => (
              <div key={kind} className="rounded-xl border border-border-subtle bg-app p-4">
                <p className="font-mono text-[11px] text-accent">{kind}</p>
                <p className="mt-2 text-xs leading-5 text-secondary">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Real tasks */}
      <section className="border-b border-border-subtle">
        <div className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                \ REAL REPOSITORY TASKS \
              </p>
              <h2 className="mt-2 font-display text-[clamp(2rem,3.5vw,3rem)] leading-[1.05] tracking-[-0.03em]">
                A base commit, an issue, a real test.
              </h2>
            </div>
            <Link href="/tasks" className="text-xs text-accent-secondary hover:underline">
              Browse the task catalogue →
            </Link>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {realTasks.slice(0, 3).map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="rounded-xl border border-border-subtle bg-panel p-4 transition-colors hover:border-border-strong"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-muted">{task.language} · {task.license}</span>
                  <StatusChip tone="pass">public</StatusChip>
                </div>
                <p className="mt-2 font-mono text-[11px] text-accent">{task.id}</p>
                <p className="mt-1 text-sm text-primary">{task.title}</p>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-secondary">{task.summary}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Leaderboard preview */}
      <section className="border-b border-border-subtle">
        <div className="mx-auto w-full max-w-[1280px] px-5 py-20 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                \ LEADERBOARD \ <span className="text-accent">\ 05 \</span>
              </p>
              <h2 className="mt-4 font-display text-[clamp(2.4rem,4.5vw,3.8rem)] leading-[1.02] tracking-[-0.03em]">
                Reliability, not a single lucky run.
              </h2>
            </div>
            <Link href="/leaderboard" className="text-sm text-accent-secondary hover:underline">
              View full leaderboard →
            </Link>
          </div>

          <div className="mt-8 overflow-x-auto rounded-xl border border-border-subtle">
            <table className="w-full min-w-[54rem] border-collapse text-left text-sm">
              <caption className="sr-only">Top benchmark results with reliability</caption>
              <thead>
                <tr className="border-b border-border-subtle bg-panel font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                  <th scope="col" className="px-3 py-2.5 font-medium">#</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Adapter</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Task</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Model</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Score</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Pass@k</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Reliability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle bg-panel/50">
                {topRows.map((entry, index) => {
                  const profile = reliability.find(
                    (group) => group.adapterId === entry.adapter.id && group.taskId === entry.taskId,
                  )?.profile;
                  return (
                    <tr key={entry.resultId}>
                      <td className="px-3 py-3 font-mono text-xs text-muted">{index + 1}</td>
                      <td className="px-3 py-3 text-secondary">{entry.adapter.label}</td>
                      <td className="px-3 py-3 text-secondary">{entry.taskId}</td>
                      <td className="px-3 py-3 font-mono text-[11px] text-muted">{entry.model?.name ?? "no model"}</td>
                      <td className="px-3 py-3 text-right font-mono text-primary">{entry.overall.toFixed(1)}</td>
                      <td className="px-3 py-3 text-right font-mono text-xs text-secondary">
                        {profile === undefined ? "—" : `${Math.round(profile.passAtK * 100)}%`}
                      </td>
                      <td className="px-3 py-3">
                        {profile === undefined ? (
                          <span className="text-xs text-muted">—</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <ReliabilityBar distribution={profile.layerDistribution} />
                            <span className="font-mono text-[10px] text-muted">{profile.runs} runs</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Attribution preview */}
      <section className="border-b border-border-subtle bg-panel/30">
        <div className="mx-auto grid w-full max-w-[1280px] gap-8 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              \ ATTRIBUTION \ <span className="text-accent">\ 06 \</span>
            </p>
            <h2 className="mt-4 font-display text-[clamp(2.4rem,4.5vw,3.8rem)] leading-[1.02] tracking-[-0.03em]">
              Every failure named. Every fix proven.
            </h2>
            <p className="mt-5 text-sm leading-7 text-secondary">
              An attribution without a counterfactual is an opinion. Orivoxx stores the baseline
              trace, the intervention, and the replay score. If no intervention crosses the
              threshold, the result says so.
            </p>
            <Link href={attributed ? `/replay/${attributed.resultId}` : "/leaderboard"} className="mt-6 inline-block text-sm text-accent-secondary hover:underline">
              Open a replay proof →
            </Link>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-app p-5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">proof</p>
              <StatusChip tone="pass">Sufficient</StatusChip>
            </div>
            <p className="mt-4 font-mono text-2xl text-primary">
              {proof == null ? "0.0 → 100.0" : `${proof.baseline.overall.toFixed(1)} → ${proof.counterfactual.overall.toFixed(1)}`}
            </p>
            <div className="mt-5 space-y-2">
              {["baseline trace", "intervention at step " + (proof?.intervention.stepIndex ?? 2), "replay remaining steps", "deterministic score"].map((step, index) => (
                <div key={step} className="flex items-center gap-3 text-[11px] text-secondary">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border-subtle font-mono text-[9px] text-accent">
                    {index + 1}
                  </span>
                  {step}
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-lg border border-accent/30 bg-accent/5 p-3 font-mono text-[10px] leading-5 text-accent">
              PASS · harness × recovery · no model call in replay
            </div>
          </div>
        </div>
      </section>

      {/* Developers */}
      <section className="border-b border-border-subtle">
        <div className="mx-auto grid w-full max-w-[1280px] gap-8 px-5 py-20 sm:px-8 lg:grid-cols-2">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              \ FOR DEVELOPERS \ <span className="text-accent">\ 07 \</span>
            </p>
            <h2 className="mt-4 font-display text-[clamp(2.4rem,4.5vw,3.8rem)] leading-[1.02] tracking-[-0.03em]">
              Run it, attribute it, replay it.
            </h2>
            <p className="mt-5 text-sm leading-7 text-secondary">
              The organizer CLI uses the same deterministic engine as the web app. Real adapters
              run in Docker; the public app reads the immutable result.
            </p>
            <Link href="/docs/adapters" className="mt-5 inline-block text-sm text-accent-secondary hover:underline">
              Adapter guide →
            </Link>
          </div>
          <div className="rounded-xl border border-border-subtle bg-inset p-4 font-mono text-[11px] leading-6 text-secondary">
            <p><span className="text-accent">$</span> orivoxx bench --task taskboard --chaos tool_error</p>
            <p className="text-muted">run 0.0 · harness × recovery · proof 100.0</p>
            <p className="mt-3"><span className="text-accent">$</span> orivoxx replay --result res_64068a</p>
            <p className="text-muted">intervention retry_policy@2 · replayed 6 · PASS</p>
            <p className="mt-3"><span className="text-accent">$</span> orivoxx diff --a res_64068a --b res_df4fc5</p>
            <p className="text-muted">score +100.0 · real test passes · no model in score</p>
          </div>
        </div>
      </section>

      {/* Resources */}
      <section className="border-b border-border-subtle">
        <div className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            \ RESOURCES \ <span className="text-accent">\ 08 \</span>
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              ["Documentation", "Attribution, replay proof, metrics, resilience, and the sandbox contract.", "/docs"],
              ["Source", "Every package, test, and benchmark task. MIT licensed.", "https://github.com/productivityapplications/Orivoxx"],
              ["Method", "The published scoring formula, taxonomy, and honest limitations.", "/docs/attribution"],
            ].map(([title, body, href]) => (
              <Link key={title} href={href ?? "/docs"} className="rounded-xl border border-border-subtle bg-panel p-5 transition-colors hover:border-border-strong">
                <p className="text-sm text-primary">{title}</p>
                <p className="mt-2 text-xs leading-6 text-secondary">{body}</p>
                <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-accent">Open →</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-border-subtle">
        <div className="mx-auto w-full max-w-[1280px] px-5 py-20 sm:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            \ FAQ \ <span className="text-accent">\ 09 \</span>
          </p>
          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            {[
              ["Is this another trace viewer?", "No. A trace viewer shows steps. Orivoxx names the layer and mode, then proves the attribution with a replay."],
              ["How is attribution verified?", "The proof is a counterfactual replay that crosses the pass threshold. If no intervention works, the result says unattributed."],
              ["Does it work with any framework?", "The adapter contract is framework-agnostic: one argv command inside the sandbox. Python and Aider ship today."],
              ["What is deterministic?", "The score, the rules, the replay, and the attribution. No model output enters the score path."],
              ["What if the model provider is down?", "Stored results stay available. The score path makes no model call; a missing trace is reported as unavailable."],
              ["What can't it attribute?", "Failures outside the trace, unseen conditions, and cells the ruleset does not cover. Recall is published, not assumed."],
            ].map(([question, answer]) => (
              <details key={question} className="group rounded-xl border border-border-subtle bg-panel p-4">
                <summary className="cursor-pointer list-none text-sm text-primary marker:hidden">
                  <span className="flex items-center justify-between gap-3">
                    {question}
                    <span className="text-muted transition-transform group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-3 text-xs leading-6 text-secondary">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-accent/10 blur-[100px]" />
        <div className="relative mx-auto w-full max-w-[1280px] px-5 py-24 text-center sm:px-8">
          <p className="font-display text-[clamp(2.4rem,5vw,4rem)] leading-[1.02] tracking-[-0.03em]">
            Benchmark the agent. Prove the failure.
          </p>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-secondary">
            {sampleTask?.title ?? "A versioned task"} is waiting. Run the baseline, inject a fault,
            and open the replay.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/app" className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-app hover:opacity-90">
              Try the benchmark
            </Link>
            <Link href="/docs" className="rounded-full border border-border-strong px-5 py-2.5 text-sm text-primary hover:border-accent">
              Read the docs
            </Link>
          </div>
          <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Open source · MIT · Benchmark the agent, not just the model
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}
