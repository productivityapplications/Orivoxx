import { z } from "zod";

import {
  ChaosKindSchema,
  ProjectFileSchema,
  TraceEventSchema,
  type ProjectFile,
} from "@orivoxx/core";
import { SemverSchema } from "@orivoxx/benchmarks";

/**
 * Hard ceilings for captured artifacts. These are security boundaries, not
 * tuning knobs: a produced repository larger than this is rejected, never
 * silently truncated into a better score.
 */
export const HARNESS_LIMITS = {
  maxFiles: 300,
  maxFileBytes: 307_200,
  maxAggregateBytes: 2_097_152,
  maxWarnings: 100,
  maxSummaryChars: 8_192,
} as const;

export const ADAPTER_ENV_ALLOWLIST = [
  "MODEL_PROXY_URL",
  "MODEL_PROXY_BASE_URL",
  "MODEL_NAME",
  "MODEL_PROVIDER",
  "OPENAI_API_BASE",
  "OPENAI_API_KEY",
  "TASK_ID",
  "TASK_VERSION",
  "RUN_ID",
  "MAX_STEPS",
  "OUTPUT_DIR",
  "PYTHONUNBUFFERED",
  "AIDER_MODEL",
  "AIDER_OPENAI_API_BASE",
  "AIDER_OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
  "CODEX_HOME",
  "ISSUE_PATH",
  "BRAND_AGENT",
  "ORIVOXX_CHAOS",
  "ORIVOXX_TRACE_FILE",
  "ORIVOXX_ACTION_FILE",
] as const;

export type AdapterEnvName = (typeof ADAPTER_ENV_ALLOWLIST)[number];

/** The sentinel key that lets a harness talk to the allowlisted proxy. */
export const SANDBOX_PROXY_KEY = "orivoxx-sandbox-proxy";

const SECRET_LIKE_PATTERN =
  /(sk-or-v1-[A-Za-z0-9]{16,}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})/;

const ALLOWLIST = new Set<string>(ADAPTER_ENV_ALLOWLIST);

export const AdapterIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{1,63}$/, "Adapter id must be lowercase kebab-case.");
export type AdapterId = z.infer<typeof AdapterIdSchema>;

export const AdapterKindSchema = z.enum(["baseline", "harness"]);
export type AdapterKind = z.infer<typeof AdapterKindSchema>;

export const AdapterModelSchema = z
  .object({
    provider: z.string().min(1).max(64),
    name: z.string().min(1).max(200),
    baseUrl: z.string().url().max(2048).nullable(),
  })
  .strict();
export type AdapterModel = z.infer<typeof AdapterModelSchema>;

export const TaskRunRefSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
    version: SemverSchema,
    rulesetVersion: SemverSchema,
    scoringConfigVersion: SemverSchema,
  })
  .strict();
export type TaskRunRef = z.infer<typeof TaskRunRefSchema>;

export const AdapterLimitsSchema = z
  .object({
    timeLimitSeconds: z.number().int().min(30).max(3600),
    maxSteps: z.number().int().min(1).max(500),
    maxOutputBytes: z.number().int().min(1024).max(10_485_760),
  })
  .strict();
export type AdapterLimits = z.infer<typeof AdapterLimitsSchema>;

export const AdapterRunInputSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    task: TaskRunRefSchema,
    startingFiles: z.array(ProjectFileSchema).min(1).max(300),
    limits: AdapterLimitsSchema,
    network: z.enum(["none", "model-proxy"]),
    model: AdapterModelSchema.nullable(),
    chaos: ChaosKindSchema.default("none"),
  })
  .strict();
export type AdapterRunInput = z.infer<typeof AdapterRunInputSchema>;

const noControlCharacters = (value: string) => !/[\0\n\r]/.test(value);

export const AgentCommandSchema = z
  .object({
    file: z
      .string()
      .min(1)
      .max(512)
      .refine(noControlCharacters, "Command file must not contain control characters."),
    args: z
      .array(
        z
          .string()
          .max(4096)
          .refine(
            noControlCharacters,
            "Command arguments must not contain control characters.",
          ),
      )
      .max(64),
    env: z
      .record(
        z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/),
        z.string().max(2048).refine(noControlCharacters, "Env values must not contain control characters."),
      )
      .superRefine((env, context) => {
        for (const [key, value] of Object.entries(env)) {
          if (!ALLOWLIST.has(key)) {
            context.addIssue({
              code: "custom",
              message: `Environment variable ${key} is not allowed inside the sandbox.`,
            });
          }

          if (SECRET_LIKE_PATTERN.test(value)) {
            context.addIssue({
              code: "custom",
              message: `Environment variable ${key} contains a provider secret.`,
            });
          }

          if (
            (key === "OPENAI_API_KEY" || key === "AIDER_OPENAI_API_KEY") &&
            value !== SANDBOX_PROXY_KEY
          ) {
            context.addIssue({
              code: "custom",
              message: "Harness API-key variables must use the sandbox proxy sentinel.",
            });
          }
        }
      }),
  })
  .strict();
export type AgentCommand = z.infer<typeof AgentCommandSchema>;

export type AdapterPlan =
  | { kind: "materialize"; files: readonly ProjectFile[] }
  | { kind: "process"; command: AgentCommand };

export interface AgentAdapter {
  readonly id: string;
  readonly version: string;
  readonly label: string;
  readonly kind: AdapterKind;
  readonly model: AdapterModel | null;
  plan(input: AdapterRunInput): AdapterPlan;
}

export const CapturedFileSchema = z
  .object({
    path: z.string().min(1).max(1024),
    content: z.string().max(HARNESS_LIMITS.maxFileBytes),
    byteSize: z.number().int().nonnegative().max(HARNESS_LIMITS.maxFileBytes),
    lineCount: z.number().int().nonnegative(),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    language: z.string().min(1).max(64),
    redacted: z.boolean(),
  })
  .strict();
export type CapturedFile = z.infer<typeof CapturedFileSchema>;

export const ArtifactStatsSchema = z
  .object({
    fileCount: z.number().int().nonnegative(),
    totalBytes: z.number().int().nonnegative(),
    redactedFiles: z.number().int().nonnegative(),
    excludedFiles: z.number().int().nonnegative(),
  })
  .strict();
export type ArtifactStats = z.infer<typeof ArtifactStatsSchema>;

export const RunStatusSchema = z.enum(["completed", "failed", "timeout", "invalid"]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const AdapterRunOutputSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    runId: z.uuid(),
    status: RunStatusSchema,
    adapter: z
      .object({
        id: AdapterIdSchema,
        version: SemverSchema,
        label: z.string().min(1).max(120),
        kind: AdapterKindSchema,
      })
      .strict(),
    model: AdapterModelSchema.nullable(),
    task: TaskRunRefSchema,
    exitCode: z.number().int().min(0).max(255).nullable(),
    startedAt: z.iso.datetime({ offset: true }),
    completedAt: z.iso.datetime({ offset: true }),
    durationMs: z.number().int().nonnegative(),
    stdoutSummary: z.string().max(HARNESS_LIMITS.maxSummaryChars),
    stderrSummary: z.string().max(HARNESS_LIMITS.maxSummaryChars),
    trace: z.array(TraceEventSchema).max(500).optional(),
    traceTruncated: z.boolean().optional(),
    test: z
      .object({
        command: z.string().min(1).max(500),
        exitCode: z.number().int().min(0).max(255).nullable(),
        timedOut: z.boolean(),
        durationMs: z.number().int().nonnegative(),
        passed: z.boolean(),
        outputSummary: z.string().max(8_192),
      })
      .strict()
      .optional(),
    warnings: z.array(z.string().max(500)).max(HARNESS_LIMITS.maxWarnings),
    repositoryFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    files: z.array(CapturedFileSchema).max(HARNESS_LIMITS.maxFiles),
    stats: ArtifactStatsSchema,
  })
  .strict()
  .superRefine((output, context) => {
    if (output.stats.fileCount !== output.files.length) {
      context.addIssue({
        code: "custom",
        path: ["stats", "fileCount"],
        message: "Artifact file count must match the captured file list.",
      });
    }

    if (output.status === "completed" && output.exitCode !== 0) {
      context.addIssue({
        code: "custom",
        path: ["exitCode"],
        message: "A completed run must have exit code 0.",
      });
    }

    if (output.status === "timeout" && output.exitCode !== null) {
      context.addIssue({
        code: "custom",
        path: ["exitCode"],
        message: "A timed-out run must not report an exit code.",
      });
    }
  });
export type AdapterRunOutput = z.infer<typeof AdapterRunOutputSchema>;

export interface ExecutionRequest {
  command: AgentCommand;
  workspace: string;
  timeoutMs: number;
  maxOutputBytes: number;
}

export interface ReplayAction {
  stepIndex: number;
  toolName: string;
  path: string;
  content: string;
}

export interface ExecutionResult {
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
  /** Raw model-call trace events collected by the proxy sidecar. */
  trace?: unknown[];
}

export interface AgentExecutor {
  readonly id: string;
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
}
