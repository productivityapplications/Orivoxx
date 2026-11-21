/**
 * Renders pitch/deck.html to pitch/Orivoxx_Deck.pdf.
 *
 *   node pitch/render.mjs
 */
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const requireFromWeb = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { chromium } = requireFromWeb("@playwright/test");

const here = dirname(fileURLToPath(import.meta.url));
const html = resolve(here, "deck.html");
const pdf = resolve(here, "Orivoxx_Deck.pdf");
const previews = resolve(here, "previews");

await mkdir(previews, { recursive: true });

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--disable-lcd-text"],
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
});

page.on("console", (message) => {
  if (message.type() === "error") console.error("console:", message.text());
});

await page.goto(pathToFileURL(html).href, { waitUntil: "networkidle", timeout: 60_000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1200);

const slides = page.locator(".slide");
const count = await slides.count();

for (let index = 0; index < count; index += 1) {
  await slides.nth(index).screenshot({
    path: resolve(previews, `slide-${String(index + 1).padStart(2, "0")}.png`),
  });
}

await page.pdf({
  path: pdf,
  width: "1280px",
  height: "720px",
  printBackground: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
  preferCSSPageSize: true,
});

await browser.close();
console.log(`rendered ${count} slides → ${pdf}`);
