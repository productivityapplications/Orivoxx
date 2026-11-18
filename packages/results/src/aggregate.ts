import type {
  AttributionLayer,
  ChaosKind,
  ReliabilityProfile,
} from "@orivoxx/core";
import { ATTRIBUTION_LAYERS, ChaosKindSchema, ReliabilityProfileSchema } from "@orivoxx/core";

export interface ReliabilitySample {
  adapter: { id: string };
  taskId: string;
  overall: number;
  createdAt: string;
  run: { status: string };
  chaos?: { kind: string } | undefined;
  attribution?: { layer: string } | null | undefined;
}

export const DEFAULT_PASS_THRESHOLD = 70;

function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: readonly number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const average = mean(values);

  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

export function passed(
  result: ReliabilitySample,
  passThreshold = DEFAULT_PASS_THRESHOLD,
): boolean {
  return result.run.status === "completed" && result.overall >= passThreshold;
}

/**
 * Reliability is computed over stored results for one adapter and task. It is
 * descriptive, not a prediction: a profile with one run is not evidence of
 * stability.
 */
export function reliabilityProfile(
  results: readonly ReliabilitySample[],
  passThreshold = DEFAULT_PASS_THRESHOLD,
): ReliabilityProfile {
  const scores = results.map((result) => result.overall);
  const layerDistribution = Object.fromEntries(
    ATTRIBUTION_LAYERS.map((layer) => [layer, 0]),
  ) as Record<AttributionLayer, number>;

  for (const result of results) {
    const layer = result.attribution?.layer;

    if (layer !== undefined && layer !== null) {
      layerDistribution[layer as AttributionLayer] += 1;
    }
  }

  const chaosSensitivity: Partial<Record<ChaosKind, number>> = {};

  for (const kind of ChaosKindSchema.options) {
    const group = results.filter(
      (result) => (result.chaos?.kind ?? "none") === kind,
    );

    if (group.length > 0) {
      chaosSensitivity[kind] =
        group.filter((result) => passed(result, passThreshold)).length / group.length;
    }
  }

  const ordered = [...results].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
  const half = Math.floor(ordered.length / 2);
  const trend =
    ordered.length < 2
      ? 0
      : mean(ordered.slice(-half).map((result) => result.overall)) -
        mean(ordered.slice(0, half).map((result) => result.overall));

  return ReliabilityProfileSchema.parse({
    runs: results.length,
    artifactScoreMean: Math.round(mean(scores) * 10) / 10,
    artifactScoreStd: Math.round(stdDev(scores) * 10) / 10,
    passAtK:
      results.length === 0
        ? 0
        : results.filter((result) => passed(result, passThreshold)).length / results.length,
    passThreshold,
    layerDistribution,
    chaosSensitivity: Object.fromEntries(
      Object.entries(chaosSensitivity).filter(([, value]) => value !== undefined),
    ),
    trend: Math.round(trend * 10) / 10,
  });
}

export interface AdapterTaskGroup {
  adapterId: string;
  taskId: string;
  results: ReliabilitySample[];
  profile: ReliabilityProfile;
}

export function groupReliability(
  results: readonly ReliabilitySample[],
  passThreshold = DEFAULT_PASS_THRESHOLD,
): AdapterTaskGroup[] {
  const groups = new Map<string, ReliabilitySample[]>();

  for (const result of results) {
    const key = `${result.adapter.id}\u0000${result.taskId}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(result);
    groups.set(key, bucket);
  }

  return [...groups.entries()].map(([key, bucket]) => {
    const [adapterId, taskId] = key.split("\u0000");

    return {
      adapterId: adapterId ?? "",
      taskId: taskId ?? "",
      results: bucket,
      profile: reliabilityProfile(bucket, passThreshold),
    };
  });
}
