/**
 * Final fresh-user end-to-end flow against a local production build with real
 * Upstash storage. It submits a community task, runs the real validation
 * worker, promotes it with a curator session, runs a real sandboxed agent, and
 * verifies the result, leaderboard, attribution, and replay pages.
 *
 *   node --env-file=.env.local scripts/e2e-final.mjs
 */
import { execFile as execFileCallback } from "node:child_process";
import { createHmac } from "node:crypto";
import { promisify } from "node:util";
import { chromium } from "@playwright/test";

const execFile = promisify(execFileCallback);
const base = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3101";
const root = new URL("..", import.meta.url).pathname;

function curatorCookie() {
  const secret = process.env.GITHUB_CLIENT_SECRET;
  if (!secret) throw new Error("GITHUB_CLIENT_SECRET is required");
  const payload = Buffer.from(
    JSON.stringify({ username: "onyebuchidaniel60", issuedAt: Date.now() }),
    "utf8",
  ).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "dark" });
const page = await context.newPage();
const report = [];

async function step(name, action) {
  const started = Date.now();
  await action();
  report.push({ step: name, ms: Date.now() - started });
  console.log(`✓ ${name} (${Date.now() - started}ms)`);
}

try {
  await step("landing hero", async () => {
    await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { level: 1 }).first().waitFor();
    const hero = await page.getByRole("heading", { level: 1 }).first().innerText();
    if (!/benchmark/i.test(hero)) throw new Error(`unexpected hero: ${hero}`);
  });

  await step("Try the benchmark -> /app", async () => {
    await page.getByRole("link", { name: /Try the benchmark/i }).first().click();
    await page.waitForURL(/\/app$/);
    await page.getByText(/Submit a repo issue/i).waitFor();
  });

  await step("Submit a task -> /tasks/new", async () => {
    await page.getByRole("link", { name: /^Submit$/ }).first().click();
    await page.waitForURL(/\/tasks\/new$/);
    await page.getByRole("heading", { name: /Submit a repository task/i }).waitFor();
  });

  const title = `E2E final flow ${Date.now()}`;
  await step("fill and submit the community task", async () => {
    await page.locator('input[name="title"]').fill(title);
    await page.locator('input[name="repoUrl"]').fill("https://github.com/wooorm/is-decimal");
    await page.locator('input[name="baseCommit"]').fill("edc9aaf05e07857a03654115cf5ae8bf9eb74b95");
    await page.locator('textarea[name="issueText"]').fill(
      "isDecimal('12') currently returns true because the implementation reads only the first code point. The API documents a single character or code point. Make multi-character strings return false without changing behavior for numbers or one-character strings.",
    );
    await page.locator('input[name="testCommand"]').fill(
      `node -e "import('./index.js').then(({isDecimal})=>process.exit(isDecimal('12')?1:0))"`,
    );
    await page.getByRole("button", { name: /Submit for validation/i }).click();
    await page.waitForURL(/\/tasks\/is-decimal-[a-z0-9]+$/);
  });

  const taskId = page.url().split("/tasks/").at(-1);
  await step("pending task detail", async () => {
    await page.getByRole("heading", { name: title }).waitFor();
    await page.getByText(/Validation gates/i).waitFor();
  });

  await step("run the six-gate validation worker", async () => {
    const { stdout } = await execFile(
      process.execPath,
      ["--env-file=.env.local", "packages/harness/scripts/validate-task.mjs"],
      { cwd: root, timeout: 600_000, maxBuffer: 4 * 1024 * 1024 },
    );
    const result = JSON.parse(stdout.slice(stdout.indexOf("{")));
    if (result.id !== taskId || result.failure !== null) {
      throw new Error(`validation failed for ${taskId}: ${stdout.slice(-400)}`);
    }
  });

  await step("polled validation gates", async () => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText(/validated/i).first().waitFor({ timeout: 20_000 });
    await page.getByText(/testFailsAtBase/i).waitFor();
    await page.getByText(/licenseOk/i).waitFor();
  });

  await step("curator promotion", async () => {
    await context.addCookies([
      {
        name: "orivoxx_session",
        value: curatorCookie(),
        domain: "127.0.0.1",
        path: "/",
      },
    ]);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /^Promote$/ }).click();
    await page.getByText(/public/i).first().waitFor({ timeout: 20_000 });
  });

  let resultId;
  await step("run a real sandboxed agent", async () => {
    const { stdout } = await execFile(
      process.execPath,
      [
        "--env-file=.env.local",
        "packages/harness/scripts/run-real-task.mjs",
        "--task",
        taskId,
        "--adapter",
        "python-openrouter",
        "--model",
        "openai/gpt-5.1",
      ],
      { cwd: root, timeout: 600_000, maxBuffer: 8 * 1024 * 1024 },
    );
    const start = stdout.indexOf("{\n  \"resultId\"");
    const summary = JSON.parse(stdout.slice(start));
    if (!summary.taskSuccess) throw new Error(`agent run failed: ${JSON.stringify(summary.test)}`);
    resultId = summary.resultId;
  });

  await step("result page shows the real test and score", async () => {
    await page.goto(`${base}/results/${resultId}`, { waitUntil: "domcontentloaded" });
    await page.getByText(/Repository task/i).first().waitFor();
    await page.getByText(/test passed/i).first().waitFor();
    await page.getByText(/100\.0/i).first().waitFor();
  });

  await step("leaderboard contains the task and result", async () => {
    await page.goto(`${base}/leaderboard?kind=all`, { waitUntil: "domcontentloaded" });
    await page.locator(`a[href="/results/${resultId}"]`).waitFor();
    await page.getByText(taskId).first().waitFor();
  });

  await step("attribution and replay proof are reachable", async () => {
    await page.goto(`${base}/results/res_c1ba8d7b435e4ae6b514138458fab8b7`, {
      waitUntil: "domcontentloaded",
    });
    await page.getByText(/harness × recovery/i).first().waitFor();
    await page.goto(`${base}/replay/res_c1ba8d7b435e4ae6b514138458fab8b7`, {
      waitUntil: "domcontentloaded",
    });
    await page.getByText(/counterfactual proof/i).first().waitFor();
    await page.getByText(/100\.0/i).first().waitFor();
  });

  console.log(JSON.stringify({ ok: true, taskId, resultId, report }, null, 2));
} finally {
  await browser.close();
}
