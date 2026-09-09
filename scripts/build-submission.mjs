/**
 * Renders docs/submission/submission.html to docs/submission/MERIDIAN-VANTAGE-submission.pdf
 * with the Chromium that ships with Playwright. No other tooling required.
 *
 *   npm run submission
 *   SUBMISSION_TEAM="Team Name" SUBMISSION_LIVE_URL="https://your-app.vercel.app" npm run submission
 *   SUBMISSION_PREVIEW_DIR=./previews npm run submission   # also writes one PNG per page
 */
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const srcPath = path.join(root, "docs/submission/submission.html");
const renderPath = path.join(root, "docs/submission/.render.html");
const outPath = path.join(root, "docs/submission/MERIDIAN-VANTAGE-submission.pdf");
const previewDir = process.env.SUBMISSION_PREVIEW_DIR;

const team = process.env.SUBMISSION_TEAM ?? "Team VANTAGE";
const liveUrl = process.env.SUBMISSION_LIVE_URL ?? "deployed on Vercel · URL in README";
const date = process.env.SUBMISSION_DATE ?? new Date().toISOString().slice(0, 10);

const html = readFileSync(srcPath, "utf8").replaceAll("{{TEAM}}", team).replaceAll("{{LIVE_URL}}", liveUrl).replaceAll("{{DATE}}", date);
writeFileSync(renderPath, html);

const browser = await chromium.launch({ args: ["--no-proxy-server"] });
try {
  const page = await browser.newPage({ viewport: { width: 1123, height: 794 }, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(renderPath).href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  if (previewDir) {
    mkdirSync(previewDir, { recursive: true });
    const pages = page.locator("section.page");
    const n = await pages.count();
    for (let i = 0; i < n; i++) {
      await pages.nth(i).screenshot({ path: path.join(previewDir, `page-${i + 1}.png`) });
    }
    console.log(`previews: ${n} page image(s) in ${previewDir}`);
  }

  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: outPath,
    format: "A4",
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    displayHeaderFooter: false,
  });
} finally {
  await browser.close();
  try {
    unlinkSync(renderPath);
  } catch {
    /* already gone */
  }
}

const bytes = statSync(outPath).size;
const raw = readFileSync(outPath, "latin1");
const pageCount = (raw.match(/\/Type\s*\/Page(?![s])/g) ?? []).length;
const mib = bytes / (1024 * 1024);
console.log(`wrote ${path.relative(root, outPath)} · ${pageCount} page(s) · ${mib.toFixed(2)} MiB`);
if (pageCount > 5) {
  console.error("Submission limit is 5 pages. Trim the HTML.");
  process.exit(1);
}
if (mib > 20) {
  console.error("Submission limit is 20 MiB.");
  process.exit(1);
}
