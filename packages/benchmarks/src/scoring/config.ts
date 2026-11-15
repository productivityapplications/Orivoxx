import { ScoringConfigSchema, type ScoringConfig } from "../contracts/scoring.js";

export const SCORING_CONFIG_1_0_0: ScoringConfig = ScoringConfigSchema.parse({
  schemaVersion: "1.0.0",
  version: "1.0.0",
  benchWeights: {
    spec: 0.6,
    security: 0.25,
    maintainability: 0.15,
  },
  severityWeights: {
    critical: 8,
    high: 4,
    medium: 2,
    low: 1,
  },
  caps: {
    criticalSpec: 59.9,
    criticalSecurity: 49.9,
  },
  structural: {
    cycles: { good: 0, warn: 1 },
    maxFanOut: { good: 8, warn: 12 },
    orphanRatio: { good: 0.1, warn: 0.25 },
    moduleCount: { min: 3, max: 60 },
  },
});
