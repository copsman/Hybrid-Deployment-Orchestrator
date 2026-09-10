/**
 * Records the ninety-second walkthrough of the control room with the Chromium that ships
 * with Playwright, and captures the README / deck screenshots from the same run.
 *
 *   npm run walkthrough
 *   WALKTHROUGH_HEADED=1 npm run walkthrough          # real GPU on a desktop machine (a window appears)
 *   WALKTHROUGH_MODE=2d WALKTHROUGH_SPEED=2 npm run walkthrough
 *
 * Outputs (paths relative to the repository root):
 *   docs/walkthrough/meridian-vantage-walkthrough.webm   VP8 video, no audio track
 *   docs/walkthrough/meridian-vantage-walkthrough.png    poster: the SCENARIO COMPLETE frame
 *   docs/screenshots/{intro,diode-transfer,import-ceremony,scenario-complete,decision-trace,deployments}.png
 *
 * Environment knobs (all optional):
 *   WALKTHROUGH_PORT         port for the production server (3112; never the e2e port)
 *   WALKTHROUGH_MODE         auto | 3d | 2d (auto: a two-second WebGL frame-rate probe decides, >= 18 fps means 3d)
 *   WALKTHROUGH_SPEED        director speed 0.5 | 1 | 2 | 4 (2 in 3d, 1 in 2d)
 *   WALKTHROUGH_INTRO        1 plays the cinematic opener first (3d only), 0 starts on the idle control room
 *   WALKTHROUGH_SKIP_BUILD   1 reuses an existing .next build instead of running `npm run build`
 *   WALKTHROUGH_EXECUTABLE   path to a Chrome/Chromium binary instead of Playwright's
 *   WALKTHROUGH_HEADED       1 launches a visible window without ANGLE flags so the real GPU renders
 *   WALKTHROUGH_SOFTWARE_GL  1 forces SwiftShader WebGL; also used automatically when the probe finds no WebGL
 *   WALKTHROUGH_OUT_DIR      video + poster directory (docs/walkthrough)
 *   WALKTHROUGH_SHOTS_DIR    screenshot directory (docs/screenshots)
 *   WALKTHROUGH_SHOTS        0 skips the screenshots
 *   WALKTHROUGH_JURY         1 appends &jury=1 to the URL (the jury view hides manual controls)
 *   WALKTHROUGH_WIDTH        viewport and video width (1440)
 *   WALKTHROUGH_HEIGHT       viewport and video height (900)
 *
 * Exit codes: 0 success · 1 guard failure (page error, video size, duration, timeout) · 2 browser not installed.
 */
import { chromium } from "@playwright/test";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/* global document, localStorage, performance, requestAnimationFrame, getComputedStyle */

const root = process.cwd();
const env = process.env;

const PORT = Number(env.WALKTHROUGH_PORT ?? 3112);
const MODE = env.WALKTHROUGH_MODE ?? "auto";
const INTRO = (env.WALKTHROUGH_INTRO ?? "1") !== "0";
const SKIP_BUILD = env.WALKTHROUGH_SKIP_BUILD === "1";
const EXECUTABLE = env.WALKTHROUGH_EXECUTABLE || undefined;
const HEADED = env.WALKTHROUGH_HEADED === "1";
const SOFTWARE_GL = env.WALKTHROUGH_SOFTWARE_GL === "1";
const OUT_DIR = path.resolve(root, env.WALKTHROUGH_OUT_DIR ?? "docs/walkthrough");
const SHOTS_DIR = path.resolve(root, env.WALKTHROUGH_SHOTS_DIR ?? "docs/screenshots");
const SHOTS = (env.WALKTHROUGH_SHOTS ?? "1") !== "0";
const JURY = (env.WALKTHROUGH_JURY ?? "1") !== "0";
const WIDTH = Number(env.WALKTHROUGH_WIDTH ?? 1440);
const HEIGHT = Number(env.WALKTHROUGH_HEIGHT ?? 900);

const SPEEDS = [0.5, 1, 2, 4];
const FPS_FLOOR = 18;
const MIN_VIDEO_BYTES = 200 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const MAX_DURATION_MS = 120_000;
const COMPLETE_TIMEOUT_MS = 180_000;
const HOLD_MS = 3500;
const SWIFTSHADER_ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
const CHROMIUM_HINT = "Playwright's Chromium build 1194 is not installed for @playwright/test 1.56.1. Run: npx playwright install chromium — or set WALKTHROUGH_EXECUTABLE";

const base = `http://127.0.0.1:${PORT}`;
const videoName = "meridian-vantage-walkthrough.webm";
const posterName = "meridian-vantage-walkthrough.png";

if (!["auto", "3d", "2d"].includes(MODE)) fail(`WALKTHROUGH_MODE must be auto, 3d or 2d (got "${MODE}")`);
if (env.WALKTHROUGH_SPEED !== undefined && !SPEEDS.includes(Number(env.WALKTHROUGH_SPEED))) fail(`WALKTHROUGH_SPEED must be one of ${SPEEDS.join(", ")} (got "${env.WALKTHROUGH_SPEED}")`);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) fail(`WALKTHROUGH_PORT must be a port number (got "${env.WALKTHROUGH_PORT}")`);
if (!(WIDTH >= 320 && HEIGHT >= 240)) fail("WALKTHROUGH_WIDTH / WALKTHROUGH_HEIGHT are too small");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function rel(p) {
  const r = path.relative(root, p);
  return r.startsWith("..") ? p : r;
}

function fileSize(p) {
  try {
    return statSync(p).size;
  } catch {
    return null;
  }
}

function sizeLabel(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(2)} MiB` : `${(bytes / 1024).toFixed(0)} KiB`;
}

function secs(ms) {
  return `${(ms / 1000).toFixed(1)} s`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------------------------
// Server: reuse one that already answers on the port, otherwise build and start `next start`.
// Stopped by PID (its own process group) in the finally block and on SIGINT / SIGTERM.
// ---------------------------------------------------------------------------------------------

async function serverAnswers() {
  try {
    const r = await fetch(`${base}/`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

let server = null;
let serverExit = null;

function stopServer() {
  if (!server || serverExit !== null) return;
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    try {
      server.kill("SIGTERM");
    } catch {
      /* already gone */
    }
  }
}

async function ensureServer() {
  if (await serverAnswers()) {
    console.log(`server: reusing ${base}`);
    return;
  }
  if (SKIP_BUILD && existsSync(path.join(root, ".next/BUILD_ID"))) {
    console.log("server: WALKTHROUGH_SKIP_BUILD=1, using the existing .next build");
  } else {
    console.log("server: npm run build");
    const build = spawnSync("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
    if (build.status !== 0) fail(`build failed (exit ${build.status ?? build.signal})`);
  }
  console.log(`server: npx next start -p ${PORT}`);
  server = spawn("npx", ["next", "start", "-p", String(PORT)], { cwd: root, stdio: ["ignore", "inherit", "inherit"], detached: true });
  server.on("exit", (code, signal) => {
    serverExit = code ?? signal ?? 0;
  });
  const t0 = Date.now();
  while (Date.now() - t0 < 90_000) {
    if (serverExit !== null) fail(`next start exited early (${serverExit})`);
    if (await serverAnswers()) {
      console.log(`server: ready on ${base} after ${secs(Date.now() - t0)} (pid ${server.pid})`);
      return;
    }
    await sleep(500);
  }
  fail("server: not ready after 90 s");
}

// ---------------------------------------------------------------------------------------------
// Browser
// ---------------------------------------------------------------------------------------------

async function launch(softwareGl) {
  const args = ["--no-proxy-server"];
  if (softwareGl) args.push(...SWIFTSHADER_ARGS);
  try {
    const browser = await chromium.launch({ headless: !HEADED, executablePath: EXECUTABLE, args });
    console.log(`browser: ${HEADED ? "headed" : "headless"}${softwareGl ? " · SwiftShader WebGL" : HEADED ? " · system GPU" : ""}${EXECUTABLE ? ` · ${EXECUTABLE}` : ""}`);
    return browser;
  } catch (e) {
    if (/executable doesn't exist/i.test(String(e?.message ?? e))) {
      console.error(CHROMIUM_HINT);
      process.exit(2);
    }
    throw e;
  }
}

/** Opens the control room in a throwaway context and measures the 3D frame rate over two seconds. */
async function probeWebgl(browser) {
  const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1, colorScheme: "dark", reducedMotion: "no-preference" });
  try {
    const page = await context.newPage();
    await page.goto(`${base}/?intro=0&speed=4`, { waitUntil: "load" });
    await page.locator('[data-testid="scene-3d"] canvas, [data-testid="scene-2d"]').first().waitFor({ state: "attached", timeout: 20_000 });
    if ((await page.locator('[data-testid="scene-3d"] canvas').count()) === 0) return { webgl: false, fps: 0 };
    await page.waitForTimeout(1500);
    const fps = await page.evaluate(
      () =>
        new Promise((resolve) => {
          let frames = 0;
          const t0 = performance.now();
          const tick = () => {
            frames++;
            const dt = performance.now() - t0;
            if (dt < 2000) requestAnimationFrame(tick);
            else resolve((frames * 1000) / dt);
          };
          requestAnimationFrame(tick);
        }),
    );
    return { webgl: true, fps };
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------------------------
// Screenshot plan. Steps are read from the "STEP nn/18" fragment the caption renders; the titles
// (src/engine/scenario.ts, upper-cased by Captions.tsx) are the fallback if the number is absent.
// "afterMs" counts from the moment the caption for that step appears. Neither step starts with a
// camera flight (the previous step already looks at the same place), and the diode step yields a
// chunk pair every 260 ms at 1x with a 1400 ms pause on the bounced return attempt half way
// through, so the diode shot targets the middle of that bounce (about 1.4 s at 2x).
// ---------------------------------------------------------------------------------------------

function shotPlan(speed) {
  return [
    { file: "diode-transfer.png", step: 9, title: "ONE-WAY TRANSFER", afterMs: (8 * 260 + 700) / speed, done: false },
    { file: "import-ceremony.png", step: 11, title: "TWO-PERSON APPROVAL", afterMs: 1000, done: false },
  ];
}

function readCaption(page) {
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="caption"]');
    if (!el) return null;
    const spans = el.querySelectorAll("span");
    return { text: el.textContent ?? "", title: spans[1]?.textContent ?? "" };
  });
}

function parseStep(caption, plan) {
  if (!caption) return null;
  const m = /STEP\s+(\d+)\s*\/\s*(\d+)/.exec(caption.text);
  if (m) return Number(m[1]);
  const byTitle = plan.find((s) => caption.title === s.title || caption.text.includes(s.title));
  return byTitle ? byTitle.step : null;
}

async function shot(page, file) {
  mkdirSync(path.dirname(file), { recursive: true });
  const png = await page.screenshot({ path: file, type: "png" });
  outputs.push(file);
  console.log(`shot: ${rel(file)} · ${sizeLabel(png.length)}`);
  return png;
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------

const outputs = [];
const pageErrors = [];
let browser = null;
let tmp = null;
let exitCode = 0;

let interrupted = false;

const onSignal = (signal) => {
  if (interrupted) return;
  interrupted = true;
  console.error(`\n${signal}: stopping`);
  stopServer();
  if (browser) {
    // Closing the browser rejects the pending Playwright call; the finally block below then cleans up.
    void browser.close().catch(() => {});
  } else {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
    process.exit(130);
  }
};
process.on("SIGINT", () => onSignal("SIGINT"));
process.on("SIGTERM", () => onSignal("SIGTERM"));
process.on("exit", stopServer);

try {
  await ensureServer();

  let mode = MODE;
  let fps = null;
  let software = SOFTWARE_GL;
  browser = await launch(software);

  if (mode !== "2d") {
    let probe = await probeWebgl(browser);
    if (!probe.webgl && !software) {
      console.log("browser: no WebGL reported, relaunching with SwiftShader");
      await browser.close();
      software = true;
      browser = await launch(software);
      probe = await probeWebgl(browser);
    }
    if (!probe.webgl) {
      if (mode === "3d") fail("WALKTHROUGH_MODE=3d but the browser has no WebGL context");
      console.log("webgl probe: no WebGL → 2d");
      mode = "2d";
    } else {
      fps = probe.fps;
      if (mode === "auto") mode = fps >= FPS_FLOOR ? "3d" : "2d";
      console.log(`webgl probe: ${fps.toFixed(1)} fps → ${mode}${MODE === "3d" ? " (forced)" : ""}`);
    }
  }

  const speed = env.WALKTHROUGH_SPEED !== undefined ? Number(env.WALKTHROUGH_SPEED) : mode === "3d" ? 2 : 1;
  const withIntro = mode === "3d" && INTRO;
  const query = `${withIntro ? "" : "intro=0&"}speed=${speed}${JURY ? "&jury=1" : ""}`;
  console.log(`recording: ${mode} · speed ${speed} · intro ${withIntro ? "on" : "off"} · jury ${JURY ? "on" : "off"} · ${WIDTH}x${HEIGHT}`);

  tmp = mkdtempSync(path.join(tmpdir(), "mjc-walkthrough-"));
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    reducedMotion: "no-preference",
    recordVideo: { dir: tmp, size: { width: WIDTH, height: HEIGHT } },
  });
  if (mode === "2d") await context.addInitScript(() => localStorage.setItem("mjc.reducedMotion", "1"));
  const recordingStartedAt = Date.now();
  const page = await context.newPage();
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await page.goto(`${base}/?${query}`, { waitUntil: "load" });

  let playedAt;
  if (withIntro) {
    await page.getByTestId("intro").waitFor({ state: "visible", timeout: 20_000 });
    // The play button fades in about four seconds after the opener mounts; wait for it to be fully
    // opaque (the overlay auto-dismisses at nine seconds, so keep well inside that).
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('[data-testid="intro-play"]');
        if (!btn) return false;
        for (let n = btn; n && n !== document.body; n = n.parentElement) {
          if (parseFloat(getComputedStyle(n).opacity) < 0.95) return false;
        }
        return true;
      },
      null,
      { timeout: 15_000 },
    );
    await page.waitForTimeout(1500);
    if (SHOTS) await shot(page, path.join(SHOTS_DIR, "intro.png"));
    try {
      await page.getByTestId("intro-play").click({ timeout: 2500 });
      playedAt = Date.now();
    } catch {
      console.log("intro: already dismissed, using the top bar play button");
      await page.getByTestId("play-scenario").click();
      playedAt = Date.now();
    }
  } else {
    await page.getByTestId("play-scenario").waitFor({ state: "visible", timeout: 20_000 });
    await page.waitForTimeout(2500);
    await page.getByTestId("play-scenario").click();
    playedAt = Date.now();
  }

  // Follow the caption until SCENARIO COMPLETE, taking the timed screenshots on the way.
  const plan = SHOTS ? shotPlan(speed) : [];
  await page.getByTestId("caption").waitFor({ state: "visible", timeout: 20_000 });
  let current = null;
  for (;;) {
    const caption = await readCaption(page);
    if (caption && caption.text.includes("SCENARIO COMPLETE")) break;
    const step = parseStep(caption, plan);
    if (step !== null && step !== current?.step) {
      current = { step, since: Date.now() };
      console.log(`  step ${String(step).padStart(2, "0")}/18 · +${secs(Date.now() - playedAt).padStart(6)} · ${caption.title}`);
    }
    const due = current && plan.find((s) => s.step === current.step && !s.done);
    if (due && Date.now() - current.since >= due.afterMs) {
      due.done = true;
      await shot(page, path.join(SHOTS_DIR, due.file));
    }
    if (Date.now() - playedAt > COMPLETE_TIMEOUT_MS) throw new Error(`no SCENARIO COMPLETE caption after ${secs(COMPLETE_TIMEOUT_MS)}`);
    await page.waitForTimeout(100);
  }
  const completedAt = Date.now();
  console.log(`  complete   · +${secs(completedAt - playedAt).padStart(6)} · SCENARIO COMPLETE`);
  await page.waitForTimeout(HOLD_MS);
  const durationMs = Date.now() - playedAt;

  // Poster and completion frame, then the two aside tabs (the tab switch is the last second of the video).
  mkdirSync(OUT_DIR, { recursive: true });
  const poster = await page.screenshot({ type: "png" });
  const posterPath = path.join(OUT_DIR, posterName);
  writeFileSync(posterPath, poster);
  outputs.push(posterPath);
  if (SHOTS) {
    const completePath = path.join(SHOTS_DIR, "scenario-complete.png");
    mkdirSync(SHOTS_DIR, { recursive: true });
    writeFileSync(completePath, poster);
    outputs.push(completePath);
    console.log(`shot: ${rel(completePath)} · ${sizeLabel(poster.length)}`);
    for (const s of plan) if (!s.done) console.error(`shot: ${s.file} was not captured (step ${s.step} never appeared in the caption)`);
    const activeTab = page.locator('[role="tab"][data-state="active"]').first();
    const previous = (await activeTab.count()) ? await activeTab.getAttribute("data-testid") : null;
    for (const [tab, file] of [
      ["tab-decision", "decision-trace.png"],
      ["tab-deployments", "deployments.png"],
    ]) {
      await page.getByTestId(tab).click();
      await page.waitForTimeout(700);
      await shot(page, path.join(SHOTS_DIR, file));
    }
    if (previous && previous !== "tab-deployments") {
      await page.getByTestId(previous).click();
      await page.waitForTimeout(600);
    }
  }

  const video = page.video();
  await context.close();
  const footageMs = Date.now() - recordingStartedAt;
  const videoPath = path.join(OUT_DIR, videoName);
  await video.saveAs(videoPath);
  await video.delete();
  outputs.push(videoPath);

  const problems = [];
  const videoBytes = fileSize(videoPath) ?? 0;
  console.log("");
  console.log(`walkthrough: mode ${mode} · ${fps === null ? "no probe" : `${fps.toFixed(1)} fps`} · ${secs(durationMs)} from play to completion + ${secs(HOLD_MS)} hold · ${secs(footageMs)} of footage`);
  for (const f of outputs) {
    const bytes = fileSize(f);
    if (bytes === null) problems.push(`${rel(f)} is missing`);
    console.log(`wrote ${rel(f)} · ${bytes === null ? "MISSING" : sizeLabel(bytes)}`);
  }

  if (pageErrors.length) problems.push(`${pageErrors.length} page error(s):\n  ${pageErrors.join("\n  ")}`);
  if (videoBytes < MIN_VIDEO_BYTES) problems.push(`video is only ${sizeLabel(videoBytes)}; the recording is probably blank`);
  if (videoBytes > MAX_VIDEO_BYTES) problems.push(`video is ${sizeLabel(videoBytes)}, above the 25 MiB limit`);
  if (durationMs > MAX_DURATION_MS) problems.push(`recording ran ${secs(durationMs)}, above the 120 s limit; raise WALKTHROUGH_SPEED`);
  for (const p of problems) console.error(`guard: ${p}`);
  if (problems.length) exitCode = 1;
} catch (e) {
  if (!interrupted) throw e;
} finally {
  if (browser) await browser.close().catch(() => {});
  stopServer();
  for (let i = 0; server && serverExit === null && i < 20; i++) await sleep(250);
  if (tmp) rmSync(tmp, { recursive: true, force: true });
}

process.exit(interrupted ? 130 : exitCode);
