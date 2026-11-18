# Orivoxx — Failure Attribution Spec

**Version:** 1.0 · **Status:** deterministic attribution + counterfactual proof.

## 1. The claim

A benchmark score alone cannot tell a developer whether to change the model, the harness, the tools, or the task specification. Orivoxx attributes a failure to a **layer × mode** cell and proves the attribution with a replay that changes one thing and crosses the pass threshold.

No LLM is used for attribution. Every attribution is a rule over the trace, scorecard, and chaos metadata.

## 2. Taxonomy

### Layers — where the fault was introduced

| Layer | Definition |
|---|---|
| **Spec** | The task is contradictory, ambiguous, or underspecified |
| **Model** | The model output is wrong: bad reasoning, ignored instruction, hallucinated API |
| **Harness** | Orchestration is wrong: swallowed error, no retry, bad stopping condition, dropped state |
| **Tool** | A tool returned a wrong result or failed from its own fault |
| **Environment** | An external service failed: network, timeout, quota |

### Modes — what kind of mistake

| Mode | Definition |
|---|---|
| **Decision** | Wrong choice among viable options |
| **Execution** | Correct choice, failed to execute correctly |
| **Recovery** | Should have recovered from a fault, did not |
| **Detection** | Should have noticed an inconsistency or contradiction, did not |

### The 20 cells

| | Decision | Execution | Recovery | Detection |
|---|---|---|---|---|
| **Spec** | Ambiguous task produced a defensible wrong artifact | Spec required an impossible step | Spec omitted a required recovery path | Spec contradicted itself and the agent followed the wrong side |
| **Model** | Hallucinated API / wrong design choice | Malformed output or invalid edit | Ignored a failed tool and continued | Missed an inconsistency in the returned data |
| **Harness** | Wrong stopping policy | Swallowed an error, dropped state | No retry after a recoverable fault | Did not surface a failed check |
| **Tool** | Tool chose a wrong target | Tool returned garbage or failed from its own bug | Tool retried without backoff and gave up | Tool result contradicted the request and was accepted |
| **Environment** | Nondeterministic external state | Network/timeout/quota failure | No fallback after an external outage | Did not notice stale external data |

## 3. Rules (deterministic, ordered)

Rules run over the trace. First match wins per failure; multiple failures may produce multiple attributions. Each rule returns evidence step indices and a confidence (`high` when a counterfactual proof exists, `medium` for a rule-only match).

| Rule id | Cell | Trigger |
|---|---|---|
| `tool_error_unhandled` | harness × recovery | `tool_call_finished.status=error` followed by `run_finished` without a retry |
| `tool_error_retried_gave_up` | tool × execution | ≥2 failed calls to the same tool/args, no success between, then exit |
| `adapter_error_after_model_call` | model/harness × execution | model call succeeded but the following step errored; split by whether output validated |
| `misleading_spec_followed` | spec × detection | produced artifact contradicts a declared check that the spec also contradicts |
| `step_limit_hit` | harness × execution | `exitReason=step_limit` with unfinished plan |
| `token_limit_hit` | harness × execution | `exitReason=token_limit` or a call with `finishReason=length` before completion |
| `zero_edit_then_fail` | spec × decision | run completed with zero successful edits and score below threshold |
| `flaky_across_runs` | environment × decision | same adapter/task/model, different scores across runs, no trace-level fault |
| `ignored_contradiction` | model × detection | model call returned an error/contradiction, next step continued unchanged |
| `hallucinated_api` | model × decision | produced import of a package not declared and not in the task allowlist |
| `dropped_tool_result` | harness × execution | tool result present but never referenced by the next step, followed by failure |
| `tool_returned_garbage` | tool × execution | tool finished `ok` with an empty/invalid result for a required path |

## 4. Counterfactual replay

### Inputs

- Recorded trace and action log (write actions with path and content, in memory only).
- Task starting files, ruleset, scoring config.
- Intervention spec.

### Algorithm

1. Materialize the task’s starting files into an in-memory file map.
2. Replay actions `1..k-1` exactly. No model calls. The file map is byte-identical to the recorded prefix.
3. Apply the intervention at step `k`:
   - **Retry policy**: retry the failed action once (transient tool/environment fault).
   - **Stop policy**: continue past a step/token limit when recorded actions remain.
   - **Action replacement**: replace aₖ with a declared alternative action (used only for action-level tests).
4. Replay actions `k+1..n` from the record.
5. Score the resulting file map with the existing deterministic engine.
6. If `score >= passThreshold` and `exitReason=completed`, the intervention is **causally sufficient**.

The smallest sufficient intervention wins (fewest changed steps, then smallest scope). If none crosses the threshold, the result is `unattributed` with reason `no_sufficient_intervention`; no cell is fabricated.

### Proof record

```ts
AttributionProof = {
  layer, mode,
  evidence: [{ stepIndex, kind, detail }],
  intervention: { kind, stepIndex, summary },
  baseline: { overall, passed },
  counterfactual: { overall, passed },
  divergenceStep,
  replayedSteps,
  passThreshold,
  sufficient: true
}
```

### Invariants

- Replay with **no intervention** reproduces the baseline score exactly and a byte-identical action sequence.
- Exactly one divergence point exists at `k`.
- No model call is made during replay.
- Replay never executes produced code; it writes text files and scores them statically.
- Action paths are validated with the same traversal rules as capture.

## 5. Greedy search

Candidate interventions are generated from the rule match:

1. Retry the failing tool call once.
2. Retry with a different tool target (when the trace records multiple candidates).
3. Extend the step/token budget (when actions remain).
4. Replace the failing action with the recorded alternative (tests only).

Candidates are tried in that order; the first sufficient one is stored. All attempted candidates are stored as `candidates[]` so the UI can switch proofs.

## 6. Validation and honest numbers

Chaos injections are labeled ground truth. For each fixture we know the layer and mode that caused the failure.

- **Precision:** of attributed runs, the fraction whose counterfactual proof crosses the threshold.
- **Recall:** of labeled faulty runs, the fraction for which the engine names the expected layer × mode.
- Reported separately. A rule that names the right cell without a proof is `medium` confidence and does not count toward precision.
- Real-model runs are a small sample; the fixture matrix is the reproducible measurement.

## 7. UI contract

The attribution card shows:

```text
Attributed: harness × recovery
Evidence: step 34, write_file → EACCES, no retry, downstream failure
Proof: replay with retry policy → PASS (47.3 → 89.1)
(intervention at step 34, replay steps 35–58, deterministic scoring)
```

- “View proof” opens `/replay/[id]` with baseline and counterfactual side by side.
- If unattributed: “Not attributable with the current ruleset” and the missing evidence, never a guessed cell.
- The card never shows a cell without at least one evidence step.

## 8. Non-goals

- No semantic model judging of “root cause”.
- No attribution of failures outside the trace (e.g. deployment bugs after capture).
- No claim that the taxonomy is complete; rule coverage is published with precision/recall.
