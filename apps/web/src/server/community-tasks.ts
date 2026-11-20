import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { Redis } from "@upstash/redis";
import {
  RealTaskSchema,
  RealTaskValidationSchema,
  type RealTask,
} from "@orivoxx/benchmarks";
import { z } from "zod";

import { getServerEnv } from "./env";

const PREFIX = "orivoxx";
const PENDING = `${PREFIX}:validations:pending`;
const PROCESSING = `${PREFIX}:validations:processing`;
const DAILY_GLOBAL = (day: string) => `${PREFIX}:validations:global:${day}`;
const DAILY_USER = (user: string, day: string) => `${PREFIX}:validations:user:${user}:${day}`;
const USER_TASKS = (user: string) => `${PREFIX}:user:${user}:tasks`;
const TASK_KEY = (id: string) => `${PREFIX}:task:${id}`;
const VALIDATION_KEY = (id: string) => `${PREFIX}:task:${id}:validation`;

export const COMMUNITY_LIMITS = {
  pendingPerUser: 3,
  dailyPerUser: 10,
  dailyGlobal: 20,
} as const;

export class CommunityStoreError extends Error {
  readonly code: "store_unavailable" | "rate_limited" | "not_found" | "forbidden";

  constructor(code: CommunityStoreError["code"], message: string) {
    super(message);
    this.name = "CommunityStoreError";
    this.code = code;
  }
}

let client: Redis | null | undefined;

function redis(): Redis {
  if (client !== undefined) {
    if (client === null) {
      throw new CommunityStoreError("store_unavailable", "The community store is not configured.");
    }
    return client;
  }

  const env = getServerEnv();

  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    client = null;
    throw new CommunityStoreError("store_unavailable", "The community store is not configured.");
  }

  client = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });

  return client;
}

export function hashUser(token: string): string {
  return createHash("sha256").update(`orivoxx:user:${token}`).digest("hex").slice(0, 32);
}

export function curatorUsernames(): Set<string> {
  return new Set(
    (process.env.CURATOR_USERNAMES ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export function isCurator(user: string): boolean {
  return curatorUsernames().has(user);
}

function dayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export const CreateTaskInputSchema = z
  .object({
    repoUrl: z
      .string()
      .regex(/^https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/),
    baseCommit: z.string().regex(/^[a-f0-9]{7,40}$/),
    issueText: z.string().min(20).max(8_000),
    testCommand: z.string().min(1).max(500),
    visibility: z.enum(["public", "private"]),
    title: z.string().min(3).max(120).optional(),
  })
  .strict();
export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;

function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "task";
}

export async function createCommunityTask(
  input: CreateTaskInput,
  user: string,
): Promise<RealTask> {
  const db = redis();
  const today = dayKey();
  const userKey = DAILY_USER(user, today);
  const globalKey = DAILY_GLOBAL(today);
  const userDaily = await db.incr(userKey);
  if (userDaily === 1) await db.expire(userKey, 86_400);
  if (userDaily > COMMUNITY_LIMITS.dailyPerUser) {
    throw new CommunityStoreError("rate_limited", "Daily validation limit reached.");
  }
  const globalDaily = await db.incr(globalKey);
  if (globalDaily === 1) await db.expire(globalKey, 86_400);
  if (globalDaily > COMMUNITY_LIMITS.dailyGlobal) {
    throw new CommunityStoreError("rate_limited", "Global validation limit reached.");
  }

  const ids = await db.smembers(USER_TASKS(user));
  const pending = await Promise.all(
    ids.slice(0, 50).map(async (id) => {
      const raw = await db.get(TASK_KEY(id));
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    }),
  );
  const active = pending.filter(
    (task) => task !== null && typeof task === "object" && ["pending", "validating"].includes((task as { status?: string }).status ?? ""),
  );
  if (active.length >= COMMUNITY_LIMITS.pendingPerUser) {
    throw new CommunityStoreError("rate_limited", "Pending validation limit reached.");
  }

  const repoName = input.repoUrl.split("/").at(-1) ?? "task";
  const task = RealTaskSchema.parse({
    id: `${slug(repoName)}-${randomUUID().slice(0, 8)}`,
    title: input.title ?? `Fix ${repoName} issue`,
    summary: input.issueText.slice(0, 200),
    source: input.visibility === "private" ? "private" : "community",
    visibility: input.visibility === "private" ? "private" : "community",
    repoUrl: input.repoUrl,
    baseCommit: input.baseCommit,
    issueText: input.issueText,
    testCommand: input.testCommand,
    passCondition: "exit0",
    difficulty: "medium",
    language: "node",
    license: "unknown",
    version: "1.0.0",
    status: "pending",
    submittedBy: user,
    submittedAt: new Date().toISOString(),
  });

  await db.set(TASK_KEY(task.id), JSON.stringify(task));
  await db.sadd(USER_TASKS(user), task.id);
  await db.lpush(PENDING, task.id);

  return task;
}

export async function getCommunityTask(id: string): Promise<RealTask | null> {
  const raw = await redis().get(TASK_KEY(id));
  if (raw === null || raw === undefined) return null;
  const parsed = RealTaskSchema.safeParse(typeof raw === "string" ? JSON.parse(raw) : raw);
  return parsed.success ? parsed.data : null;
}

export async function listUserTaskIds(user: string): Promise<string[]> {
  return redis().smembers(USER_TASKS(user));
}

export async function listUserTasks(user: string): Promise<RealTask[]> {
  const ids = await listUserTaskIds(user);
  const tasks = await Promise.all(ids.map((id) => getCommunityTask(id)));
  return tasks.filter((task): task is RealTask => task !== null);
}

export function canView(task: RealTask, user: string | null): boolean {
  if (task.visibility !== "private") return true;
  return user !== null && task.submittedBy === user;
}

export async function claimValidation(): Promise<RealTask | null> {
  const db = redis();
  const id = await db.rpop(PENDING);
  if (typeof id !== "string") return null;
  await db.lpush(PROCESSING, id);
  const task = await getCommunityTask(id);
  if (task === null) return null;
  const next = { ...task, status: "validating" as const };
  await db.set(TASK_KEY(id), JSON.stringify(next));
  return next;
}

export async function recordValidationEvent(
  taskId: string,
  event: { gate: string; status: "start" | "pass" | "fail"; detail: string },
): Promise<void> {
  const db = redis();
  await db.rpush(
    VALIDATION_KEY(taskId),
    JSON.stringify({ ...event, at: new Date().toISOString() }),
  );
  await db.ltrim(VALIDATION_KEY(taskId), -50, -1);
}

export async function finishValidation(
  task: RealTask,
  status: "validated" | "rejected",
  validation: z.infer<typeof RealTaskValidationSchema>,
  rejectionReason?: string,
): Promise<RealTask> {
  const db = redis();
  const next = RealTaskSchema.parse({
    ...task,
    status,
    validation,
    ...(rejectionReason === undefined ? {} : { rejectionReason: rejectionReason.slice(0, 500) }),
  });
  await db.set(TASK_KEY(next.id), JSON.stringify(next));
  await db.lrem(PROCESSING, 0, next.id);
  return next;
}

export async function validationEvents(
  taskId: string,
): Promise<{ gate: string; status: string; detail: string; at: string }[]> {
  const rows = await redis().lrange(VALIDATION_KEY(taskId), 0, -1);
  return rows
    .map((row) => {
      if (row !== null && typeof row === "object") {
        return row as { gate: string; status: string; detail: string; at: string };
      }
      try {
        return JSON.parse(row) as { gate: string; status: string; detail: string; at: string };
      } catch {
        return null;
      }
    })
    .filter((row): row is { gate: string; status: string; detail: string; at: string } => row !== null);
}

export async function promoteTask(id: string): Promise<RealTask | null> {
  const task = await getCommunityTask(id);
  if (task === null) return null;
  const next = RealTaskSchema.parse({
    ...task,
    visibility: "community",
    status: "public",
  });
  await redis().set(TASK_KEY(id), JSON.stringify(next));
  return next;
}

export async function rejectTask(id: string, reason: string): Promise<RealTask | null> {
  const task = await getCommunityTask(id);
  if (task === null) return null;
  const next = RealTaskSchema.parse({
    ...task,
    status: "rejected",
    rejectionReason: reason.slice(0, 500),
  });
  await redis().set(TASK_KEY(id), JSON.stringify(next));
  return next;
}

/** Tests only. */
export function resetCommunityStore(): void {
  client = undefined;
}

export async function listPublicCommunityTasks(): Promise<RealTask[]> {
  const db = redis();
  const keys = await db.keys(`${PREFIX}:task:*`);
  const tasks: RealTask[] = [];
  for (const key of keys) {
    if (key.endsWith(":validation")) continue;
    const raw = await db.get(key);
    const parsed = RealTaskSchema.safeParse(typeof raw === "string" ? JSON.parse(raw) : raw);
    if (parsed.success && parsed.data.visibility === "community" && parsed.data.status === "public") {
      tasks.push(parsed.data);
    }
  }
  return tasks.sort((left, right) => (right.submittedAt ?? "").localeCompare(left.submittedAt ?? ""));
}
