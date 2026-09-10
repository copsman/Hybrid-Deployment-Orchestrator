# MERIDIAN // VANTAGE — handoff

**Repository:** `copsman/Hybrid-Deployment-Orchestrator` · **branch:** `claude/hybrid-deployment-orchestrator-5bzv3m`. The default branch has not been touched and no pull request has been opened. The commits of 2026-09-10 are local until the branch is pushed (open item 1).

**What it is:** a hackathon entry for "Hybrid Deployment Orchestrator (Cloud + On-Prem + Air-Gapped Simulation)". A Next.js 16 app that simulates one AI model (`mjc/scribe-8b`, the fictional SCRIBE assistant) deployed across three environments of the fictional Meridian Joint Command, with policy-based routing by classification, a signed artefact pipeline through a one-way data diode, a hash-chained decision ledger, a cinematic 3D control room, and a headless CLI that runs the same scenario.

**Jury criteria the work targets:** fit to brief 20%, relevance 15%, runs end to end from README 25%, technical depth and correctness 25%, innovation 15%. The submission is a PDF of at most five pages: title, objective, solution, validation, results and conclusions.

## Decisions already made (do not reopen without the user)

- Fictional force **Meridian Joint Command**; markings **OPEN / RESTRICTED / SECRET / ONYX** (ONYX has no accredited environment and is always refused); environments **Meridian Cloud Region North** (elastic, metered, external), **Fort Meridian Datacentre** (4 GPU slots, queue, proxied egress), **Enclave OBSIDIAN** (2 GPU slots, no network, diode import). No real military names anywhere; a test enforces this.
- **Simulated only.** No API keys, no network calls, no database. Real stack names are shown per environment (Vercel, Vercel AI Gateway, Supabase Cloud, vLLM, Keycloak, Harbor, Vault, Langfuse, ClamAV) to tell the "same model, three stacks" story.
- Engine is **pure TypeScript** in `src/engine` (relative imports only, no React). Policy is **data** in `src/engine/policy/rules.json` (POL-01 to POL-08), evaluated deny-by-default with capability checks CAP-VERSION, CAP-EGRESS, CAP-SLOTS traced like rules. Selection: free capacity, then lowest cost, then most free slots.
- Crypto: SHA-256 + Ed25519 via `@noble/*` over canonical JSON (sorted keys). Keys derive from the demo seed. **No encryption anywhere**, on purpose: integrity and authenticity are the requirement, confidentiality across the gap is the diode's physical property, so there is no nonce to reuse.
- Artefact pipeline state machine: BUILT → SIGNED → PUBLISHED → MIRRORED → STAGED → IN_DIODE → QUARANTINE → VERIFYING (two distinct operators) → IMPORTED (pinned key, signature, digest, size, downgrade check) → LOADED, or REJECTED. The enclave's return-path attempt through the diode is counted and shown bouncing.
- UI: shadcn/ui components fetched from the shadcn GitHub repo (registries are blocked in the cloud sandbox), hand-authored Aceternity-style components under `src/components/aceternity`, a react-three-fiber scene with a 2D SVG mirror, zustand stores, and a scripted director that plays the 18-step scenario like a film.
- **Scene layout (2026-09-10): a linear security gradient**, left to right by trust: CLOUD | inspection proxy | ON-PREM | DATA DIODE | ENCLAVE, with the policy plane in front (bench, router as the single entry point, ledger obelisk, one barrier arch every route passes). One generic campus per perimeter with the same ten-layer stack; only the enclosure differs by kind. The 2D map mirrors the same organisation. Details in "Scene architecture" below.
- **Presentation polish scope (2026-09-10):** keyboard presenter mode, opt-in jury view, WebAudio sound kit, recorded walkthrough. **The Aceternity registry swap was assessed and skipped on purpose:** the hand-authored components are progress- and value-driven variants the registry does not offer, and the registry CLI would touch pinned dependencies. The unused `hover-border-gradient.tsx` was deleted.
- **Media policy:** the walkthrough is one `.webm` (VP8, no audio track) plus a PNG poster, committed once and linked from the README. Re-record only for a visual change: every re-record adds about 11 MiB to history, so otherwise attach a new recording to a GitHub Release instead of committing it.
- Pins that matter: React **19.2.8** (react-three-fiber 9.7 peer range), TypeScript 5.9.3, ESLint 9.39.5, `@playwright/test` 1.56.1 (Chromium build 1194). `npm ci` must pass without `--legacy-peer-deps`. No dependency was added on 2026-09-10; `package-lock.json` is unchanged.

## State at handoff (all verified on 2026-09-10)

- `npm run verify` green: typecheck, lint, 56 vitest + fast-check tests (40 engine, 16 scene), headless demo, production build.
- `npm run e2e` green: 4 Playwright tests in 3 spec files (smoke ×2, presenter, jury), zero page errors.
- 3D scene checked on a real GPU (headed Chromium, 60 fps) and headless under SwiftShader; about 120 draw calls at the idle overview (`?stats=1`), up to about 140 at a focused preset with its module labels mounted. The production server serves `/fonts/GeistMono-Regular.ttf` with 200 and makes no request to any CDN.
- Landed today on top of the 2026-09-09 handoff: the flaky canonical order-independence property test fixed (`__proto__` key in the test's shuffle); presenter mode (hotkeys, step rail in the top bar, shortcut legend); opt-in jury view (`?jury=1` / `J`); WebAudio sound kit with ambient bed; the 3D scene redesigned as the linear security gradient with state-driven details and in-world text from a local font; the 2D map redrawn in the same organisation; layout-invariant and glyph-coverage unit tests; presenter and jury e2e specs; `npm run walkthrough`; `.claude/` ignored by git and ESLint; the 2D map's queue parser and staged-total selector lifted into `scene/selectors.ts`.
- Media, produced by the recorder from the redesigned scene and committed separately: `docs/walkthrough/meridian-vantage-walkthrough.webm` (VP8, about 11 MiB, about 90 s, silent) plus `meridian-vantage-walkthrough.png` poster; the six `docs/screenshots/*.png` refreshed; `docs/submission/MERIDIAN-VANTAGE-submission.pdf` rebuilt with `npm run submission` (team and URL placeholders unchanged).
- CI workflow `.github/workflows/ci.yml`: verify job, doubled headless run diffed for determinism, Playwright job (`workers: 1` on CI).
- Fresh-clone rehearsal (2026-09-09) still applies: nothing added since needs the network at runtime; e2e and the recorder need `npx playwright install chromium` once.

## Commands

```
npm ci                 # exact deps
npm run dev            # control room on :3000 (?intro=0 skips opener, ?speed=4 faster director, ?jury=1 jury view, ?stats=1 draw calls; M 2D map, ? presenter keys)
npm run demo           # headless scenario, exit 0 only if all checks pass (--json for machine output)
npm test               # vitest + fast-check (tests/engine, tests/scene)
npm run verify         # typecheck + lint + test + demo + build
npm run e2e            # Playwright against a production build (run `npx playwright install chromium` once; E2E_PORT to move off 3111)
npm run walkthrough    # video + poster + screenshots (WALKTHROUGH_HEADED=1 for the real GPU; knobs in the script header)
npm run submission     # rebuild the PDF; SUBMISSION_TEAM / SUBMISSION_LIVE_URL / SUBMISSION_DATE stamp the title page
```

## Scene architecture

**Files** (`src/components/scene/`):

- `layout.ts` — every world coordinate: zone plates (`ZONE_CX` cloud −10.5 / onprem 0 / airgapped 10.5, half-width 4.8, z −6.5…3.5), `PROXY_X` −5.25 and `WALL_X` 5.25 in the gaps, the policy strip (x ±13, z 5…9.6) with `HUB`, `ARCH`, `BENCH`, `OBELISK`, the campus grid (`moduleLocal(i)`, tower index 2, gate/queue/plaque rows), the diode assembly (`GATE`, `OUTBOX`, `QUARANTINE`, `CONSOLES`, 8×4 `chunkSlot`s per tray), routes as `CurvePath`s (trunk hub → arch, then a fan; the air-gapped branch threads the gate), `refusedCurve()`, the artefact `CHANNEL`, `PACKET_TIMING`, `CAMERA_PRESETS` and `overviewPose()`.
- `selectors.ts`, `labels.ts`, `materials.ts` (lazy shared materials and geometries, merged campus edge lines), `SceneText.tsx`, `Zones.tsx` (plates, dashed borders, upright banners, trust marks, strip title, proxy checkpoint, wall with a real doorway), `Site.tsx` (rendered three times), `Hub.tsx` (Hub, Bench, Barrier), `Routes.tsx`, `Packets.tsx`, `Ledger.tsx`, `DiodeGate.tsx`, `ArtefactFlow.tsx`, `CameraRig.tsx`, `StatsProbe.tsx`, `Scene.tsx`, `SceneCanvas.tsx` (WebGL check, error boundary, 2D fallback), `Poster.tsx`.
- `src/lib/palette.ts` — `MJC` token hexes (equal to `globals.css` `:root`), `CLASS_HEX`, `ENV_ACCENT` / `ENV_TONE`, `NET_LABEL`, `ZONE_TINT`, `SCENE_FONT`, `SCENE_GLYPHS`, `hasSceneGlyphs()`. `ClassificationBadge` re-exports `CLASS_HEX` from it.
- `public/fonts/GeistMono-Regular.ttf` + `LICENSE-Geist.txt` (SIL OFL 1.1, copied from the `geist` package) — the only asset the scene loads.

**Data flow.** Scene and map components subscribe through `selectors.ts` only; nothing reads `snapshot.environments` by index. Selectors return primitives, string keys or references already in the store: `selSpec[id]`, `selRunning[id]`, `selQueueKey[id]` (`jobId:cls,...`), `selVersionKey[id]` (`1.3.0:L,1.4.0:F`, L loaded · P present · F in flight · X rejected · − absent), `selImportKey` (newest artefact as `version|state|approvals|scanned|op+op`), `selStagedTotal`, `selLedgerLen` / `selLedgerOk` / `selLedgerHead`, `selDecisions`, `selPacketCount`, `selLastPacket`, `selResetSeq`, and from the director `selStepId`, `selPlaying`, `selFocus`. Strings compare by value under `Object.is`, so a component re-renders only when its own key changes; `parseQueueKey` / `parseVersionKey` / `parseImportKey` turn a key into objects inside `useMemo`. The store gained additive fields for this: `Packet.verdict` / `ruleId` / `position`, `alert.ruleId`, `resetSeq`. Per-frame motion lives in `useFrame` with module-level scratch `Vector3` / `Object3D` / `Color`; every `useFrame` null-guards its refs and allocates nothing. Verdict flashes, packet removal, the scan sweep and the bounce are timers keyed on store changes and cancelled on `resetSeq` change, alert cleared or unmount, so a replay after reset fires them again.

**What the state drives.** GPU slot LEDs on the on-prem and enclave towers and elastic pods (≤ 8) on the cloud apron from `selRunning`; queue tokens (5 visible + `+n`) coloured by classification from `selQueueKey`; version plaques (`SCRIBE 1.3.0 · 1.4.0`, `1.4.0 PENDING` amber, `1.4.0 REJECTED` red) from `selVersionKey`; the busy halo spins and the accent light lerps only while jobs run; the router headline counts decisions with the real `POLICY.version`; the barrier arch pulses cyan with `JOB-B → ONPREM · QUEUE #n` per routed packet and flashes red with `REFUSED · POL-01` timed to the refused packet's arrival; the ledger obelisk carries up to 24 link rings, pulses per append and reads `CHAIN INTACT` / `CHAIN BROKEN`; the bench glows while the newest bundle is BUILT/SIGNED; the artefact token flies bench → cloud registry → proxy (scan plane brightens) → on-prem registry → outbox, hides while the chunks cross, reappears at the enclave registry and fades once LOADED (REJECTED shakes it red at quarantine); the diode conveyor parks all 32 chunks in the outbox at STAGED (`32 CHUNKS STAGED · LOW SIDE`), flies each newly sent chunk over the gate, counts `n/32 CHUNKS · n RETURN ATTEMPT(S) BLOCKED`, bounces the return attempt, sweeps the scanner during the scan step and lights the two operator consoles (real operator names, APPROVED / AWAITING / STANDBY, only during the newest bundle's ceremony).

**Camera.** `CAMERA_PRESETS` is keyed by `Focus` (overview, hub, cloud, onprem, diode, airgapped); keys `1`–`6` and the scenario steps map to them. The overview is aspect-aware: `overviewPose(aspect, heightPx)` bisects the distance along a fixed pitch (about 48°) until eight fit points (plate corners, strip ends) are inside the frame and the hub and ledger headlines clear the 110 px caption box; `CameraRig` re-solves it from the live canvas size on resize, so the default 7/12 panel, the 8/12 jury panel and the stacked `<xl` layout all frame the whole gradient. The layout test asserts it for five frame shapes.

**Labels and the glyph rule.** All 3D text goes through `SceneText` (drei `Text` → troika SDF) with `font=/fonts/GeistMono-Regular.ttf` and `characters=SCENE_GLYPHS`. troika ships no font: a missing font or a glyph outside the file makes it fetch a fallback from a CDN, which the no-network rule forbids. `SCENE_GLYPHS` is printable ASCII plus `· → ← × – — … •`, verified in the TTF cmap (`✓ ▮ ▪` are absent). Every literal string and template lives in `labels.ts`; `tests/scene/labels.test.ts` runs the scenario and checks everything the engine can hand the scene (site and stack names, job ids, rule ids, operator names, versions, hashes). Headlines are `Billboard` + `ScreenSizer` (pixel-sized, 1 px outline); in-world text uses world-unit outlines; flat/engraved text and text on dark bodies use no outline. Module labels mount only for the focused site, trust marks only for the focused plate, the bench label only at the hub preset. No drei `<Html>` in the scene.

**Instancing and draw budget.** Static groups use drei `Instances` with `frames={1}`; animated groups (LEDs, pods, chunk conveyor, ledger rings) are raw `instancedMesh` with dirty flags and `instanceColor.needsUpdate` only when a colour changed. Each campus outlines pad, modules and tower in one `lineSegments`. Lights: ambient + hemisphere + directional + one accent point light per site. `PerformanceMonitor` drops DPR 1.5 → 1 on decline. `?stats=1` (dev builds only) logs draw calls, triangles, programs and memory every two seconds; the budget is about 120 at the idle overview.

**The 2D map mirror.** `Fallback2D.tsx` composes `map2d/` (`geometry.ts`, `primitives.tsx`, `Campus`, `Diode`, `PolicyPlane`, `Packets`, `Artefact`): viewBox 1000×560, zones at x 22–322 / 342–642 / 678–978, the wall at 652–668 with the gate glyph and the 32-tick bar, the policy strip at y 350–440 (kept above the caption box). It reads the same selectors and palette and imports neither `three` nor `layout.ts`, so the 2D bundle never executes module-level curve construction. All animation is keyed on store state inside `subscribe` callbacks or timers (no repeat loops); decorative loops stop under reduced motion. Contract the specs rely on: root `data-testid="scene-2d"`, `role="img"`, FocusBadge text `2D MAP · <LABEL>`, click-to-focus on sites, hub and gate, no `ledger-status`, no `RAW JSON` button.

**Import ceremony card** docks top-right (`right-3 top-10`, scale 0.85, no full-frame blur, `pointer-events-none`) so the enclave hardware stays visible at the airgapped preset; `MultiStepLoader` takes `cardClassName`.

## Presenter mode, jury view, sound

- `src/components/control-room/Hotkeys.tsx`: one `window` keydown listener that reads `useDirector.getState()` and never re-renders. Ignores keys with modifiers, IME composition, everything while the opener is up, text entry (`input, textarea, select, contenteditable, combobox/listbox/option/menu/slider`), anything inside a `[role=dialog]`, and everything but `?` while the legend is open. Space blurs a focused button/switch/tab first so it never double-fires; `e.repeat` is ignored for toggles. Map: Space play/pause/resume; `N` / `→` next; `←` re-centre on the current step's focus; `1`–`6` overview/hub/cloud/onprem/diode/airgapped; `+` `=` / `−` speed through `SPEEDS`; `Shift+R` stop + reset (plain `R` toasts "Reset needs SHIFT+R"); `S` sound; `M` 2D/3D (`reducedMotion`); `F` fullscreen on the root element; `J` jury; `?` legend.
- `src/store/director.ts`: exports `SPEEDS` and `DirectorState`; `jury` (from `?jury=1` only, deliberately never persisted), `legendOpen`, and the module-level `skipRequested` flag: `next()` sets it and resolves the current wait; the play loop then skips the remaining generator waits (draining the diode chunks synchronously, so the last frame shows 32/32) and the step's hold; during a camera flight the flight lands first. `next()` is a no-op when idle or done; the flag is cleared at the top of every step, on `stop()` and on completion.
- `PresenterRail.tsx` replaces the DIRECTOR pill in the top bar (`data-testid="presenter-rail"`, `data-step`, `data-status`): LED, `STEP 09/18 · DIODE · ONE-WAY TRANSFER` (tiered by breakpoint; the full text is in `title`), 18 segments coloured by phase (done 0.8 · current 1 with glow · upcoming 0.22). Below `lg` the compact `PresenterPill` stands in. `ShortcutLegend.tsx` is a radix dialog (`data-testid="shortcut-legend"`).
- Jury view: with `jury === false` the DOM is the operator page byte for byte (the smoke spec depends on it). With jury: the submit form, the pipeline manual card (`pipeline-manual`), `build-next`, tamper buttons and the approval dialog, ledger verify/tamper/restore, the CARDS/RAW JSON toggle, next/stop/speed/reset and the WHAT-IF tab are hidden; the scene takes 8/12 with a taller frame; a `VIEW · JURY` pill appears; tabs are controlled and follow `TAB_FOR_STEP` (boot → jobs, jobs → decision, build…verify → pipeline, parity → deployments, complete → jobs, ledger → ledger) from inside a director subscription through a `tabRef`; a manual click sticks until the mapped tab changes.
- Sound (`src/lib/sfx.ts`, `sfx-bindings.ts`): a small synth, voices → fx → compressor → master (0.28); bed of 55 / 82.4 / 110 / 164.8 Hz partials plus LFO-swept band-passed noise; everything scheduled on the audio clock (no `setTimeout`), at most 16 live voices, per-sound rate limits; the `AudioContext` is created only inside a user gesture (a restored preference arms a one-shot unlock), the bed starts only once the context is running, every public method is wrapped so it never throws. Bindings diff zustand `(state, prev)`: route motif per classification or buzzer on packet growth, chunk ticks (900 → 1800 Hz) and a thud from `diode`, stamps from approvals (the two scenario approvals staggered 0.35 s), verified chord on LOADED, buzzer on REJECTED, ledger ticks from the `snapshot.ledger.length` delta (the engine emits `ledger.appended` for only 3 of its 15 append sites), chain chime from `ledgerStatus.ok` and the director's step-18 result, whoosh on focus change (not in reduced motion), bed while playing, sting on done. `ControlRoom` mounts it with `useEffect(() => bindSfx(), [])`. Verified with an analyser tap on the master gain (no audio device in the sandbox), not by ear.

## Recording and media

```
npm run walkthrough                              # headless Chromium; 3D when the 2 s WebGL probe reaches 18 fps, else the 2D map
WALKTHROUGH_HEADED=1 npm run walkthrough         # a visible window on the machine's GPU (needs DISPLAY and the default TMPDIR)
WALKTHROUGH_MODE=2d WALKTHROUGH_SPEED=2 npm run walkthrough
npm run submission                               # rebuild the deck from the refreshed screenshots
```

`scripts/record-walkthrough.mjs` reuses a server answering on `WALKTHROUGH_PORT` (3112) or builds and starts `next start` (stopped by process group, never `pkill`); prints the `npx playwright install chromium` hint and exits 2 when Chromium is missing; records 1440×900 through Playwright `recordVideo` at `/?speed=2&jury=1` with the opener, clicks `intro-play`, waits for `SCENARIO COMPLETE`, holds 3.5 s; writes `docs/walkthrough/meridian-vantage-walkthrough.webm` (VP8, no audio track) and the `.png` poster (the completion frame); captures `docs/screenshots/{intro,diode-transfer,import-ceremony,scenario-complete,decision-trace,deployments}.png` from the same run by watching `presenter-rail[data-step]` (diode at step 9 mid-transfer with the return attempt blocked, ceremony at step 11, completion, then the DECISION and DEPLOYMENTS tabs). Guards: page errors, 200 KiB–25 MiB, ≤ 120 s wall-clock. Every knob is documented in the script header: `WALKTHROUGH_MODE auto|3d|2d`, `WALKTHROUGH_SPEED`, `WALKTHROUGH_INTRO`, `WALKTHROUGH_SKIP_BUILD`, `WALKTHROUGH_EXECUTABLE`, `WALKTHROUGH_HEADED`, `WALKTHROUGH_SOFTWARE_GL`, `WALKTHROUGH_OUT_DIR`, `WALKTHROUGH_SHOTS_DIR`, `WALKTHROUGH_SHOTS`, `WALKTHROUGH_JURY`, `WALKTHROUGH_WIDTH` / `HEIGHT`.

Known: Playwright's recorder plays back 11–14 % longer than wall-clock (frame repetition; retime with the bundled ffmpeg and a `setpts` filter if it matters); the last seconds of the video show the aside switching tabs for the two screenshots; the step-9 and step-11 shot offsets assume the engine's 260 ms chunk cadence and 1400 ms bounce. Re-record policy: only for a visual change; otherwise attach the recording to a GitHub Release.

## Repo map

```
src/engine/                   types, schema (zod v4), classification, environments, policy/{rules.json,evaluate.ts}, router,
                              artefacts/{canonical,crypto,manifest}, ledger, whatif, scenario, sim/{clock,rng}, index.ts (Engine class)
src/store/                    orchestrator.ts (engine snapshot, event log, packets with verdict/rule/position, diode signal, resetSeq, pipeline actions),
                              director.ts (play/pause/next/stop, skip, speed, reduced motion, sound, intro, jury, legend, camera handler, URL params)
src/lib/                      palette.ts (scene colours, font, glyph set), sfx.ts (WebAudio kit), sfx-bindings.ts (store → sound), utils.ts
src/components/scene/         SceneCanvas, Scene, CameraRig, Zones, Site, Hub (Hub/Bench/Barrier), Routes, Packets, Ledger, DiodeGate, ArtefactFlow,
                              SceneText, StatsProbe, Poster, layout.ts, selectors.ts, labels.ts, materials.ts, Fallback2D + map2d/{geometry,primitives,Campus,Diode,PolicyPlane,Packets,Artefact}
src/components/control-room/  TopBar, PresenterRail, Hotkeys, ShortcutLegend, EnvCards, JobsPanel, SubmitJobForm, DecisionTrace, DeploymentsMatrix,
                              PipelineTracer, LedgerPanel, PolicyPanel, WhatIfPanel, LogTicker, Captions, AlertOverlay, IntroOverlay, ImportCeremony, ControlRoom
src/components/aceternity/    spotlight-new, background-beams, tracing-beam, text-generate-effect, moving-border, glowing-effect, multi-step-loader
src/components/ui/            shadcn: button card badge tabs tooltip scroll-area separator table dialog switch progress input textarea select label checkbox sonner
src/components/shared/        ClassificationBadge, StatusLED, HudFrame, icons
src/app/                      layout.tsx (forced dark, Geist fonts), page.tsx, error.tsx, globals.css (tokens + animations)
public/fonts/                 GeistMono-Regular.ttf, LICENSE-Geist.txt (OFL)
scripts/                      demo.ts (headless run), record-walkthrough.mjs (video + screenshots), build-submission.mjs (PDF)
tests/engine/                 canonical, crypto, ledger, policy (property-based), pipeline, scenario
tests/scene/                  layout.test.ts (gradient invariants, camera), labels.test.ts (glyph coverage, fictional vocabulary)
tests/e2e/                    smoke.spec.ts (×2), presenter.spec.ts, jury.spec.ts
docs/                         screenshots/, walkthrough/, submission/, ROADMAP.md, HANDOFF.md
```

## Open items (priority order)

1. **Push the branch, then deploy to Vercel.** Today's commits are local (the integrating shell had no GitHub credentials): `npm run verify && git push origin claude/hybrid-deployment-orchestrator-5bzv3m`. Then import the repo in Vercel (default Next.js preset, no environment variables, Node pinned to 22 in `package.json`), put the URL into the README quick start, regenerate the deck with `SUBMISSION_TEAM="…" SUBMISSION_LIVE_URL="https://…" npm run submission`, commit and push.
2. **Team name.** The title page still reads "Team VANTAGE"; set the real name with `SUBMISSION_TEAM` in the same `npm run submission`.
3. **Optional polish, not done:** narration audio synced to the captions (a separate layer; `sfx.setEnabled` / `sfx.ambient` are safe to call from anywhere and the video has no audio track to merge with); the judges' presenter follow-ups — hide the upright zone banners at the close presets where they fill the frame, and a key-hint strip on the presenter rail when the top bar is wide enough.
4. **If time allows:** items from the "now" section of `docs/ROADMAP.md`, starting with real inference adapters behind the existing environment interface, simulated drivers staying the default.

## Conventions

- Commit messages end with the attribution trailer the harness provides. Never put model identifiers in code, docs or commit bodies. Stage explicit paths; never `git add -A`; never stage `.claude/`.
- Run `npm run verify` before every push; run `npm run e2e` after UI changes (four tests, zero page errors; the 3D scene mounts briefly before the 2D toggle, so every `useFrame` is exercised).
- Keep the engine free of React and DOM imports; keep `rules.json` the single source of policy truth; keep every decision producing a full record; keep the "no encryption" stance.
- Keep the e2e contract (testids, `2D MAP · <LABEL>`, `ledger-status`, one "Submission rejected" element, jury hides). Keep scene text inside `SCENE_GLYPHS` through `labels.ts`; keep selectors primitive; keep the 2D map free of `three` and `layout.ts`.
- Fictional names only. The scenario test and the labels test fail on real-world military terms.
- Known gotchas:
  - zustand selectors must return stable references (derive with `useMemo`); the `LayoutProps` global type from Next only exists after a build, so `layout.tsx` types children explicitly; `pkill -f "next start"` in a script kills the script's own shell, so stop servers by PID (kill the process group of the `npx → sh → next` chain; killing only the npx parent leaves `next-server` alive).
  - `@playwright/test` 1.56.1 needs Chromium build 1194: `npx playwright install chromium` once; a newer build already on the machine is not used.
  - Headed recording (`WALKTHROUGH_HEADED=1`) must run with the default `TMPDIR`: a long `TMPDIR` path crashes headed Chromium at launch (SIGTRAP; the profile singleton socket exceeds the Unix socket path limit).
  - `?stats=1` works in dev builds only (`StatsProbe` is gated on `NODE_ENV !== "production"`); measure against `next dev` on a `localhost` origin, since Next 16's `allowedDevOrigins` blocks dev resources from `127.0.0.1`.
  - `next dev` (Next 16) rewrites `CLAUDE.md` with a `nextjs-agent-rules` comment block whenever a dev server starts; restore it (`git checkout CLAUDE.md`) after dev sessions and never commit the block.
  - The smoke spec's `getByText("Submission rejected")` must keep matching exactly one element (the toast). The orchestrator's schema-rejection log line reads "rejected by the schema" on purpose; any log line or toast repeating "submission rejected" brings back a strict-mode race that fails about one run in three.
  - Hotkeys ignore keys inside any `[role=dialog]`: close the approval dialog before using Space.
  - The engine emits no diode signal for `stage()`, so `diode` is null until the first chunk is sent; both maps read `selStagedTotal` to show a full outbox.
  - Scratch `Vector3` / `Object3D` / `Color` objects for instance writes are module-level singletons: `react-hooks/immutability` rejects mutating a memoised value listed in effect deps. `react-hooks/set-state-in-effect` is on: derive state inside `subscribe` callbacks or timers.
  - Headless Chromium on the dev host reports about 40 fps for the 3D scene, enough for the recorder's 18 fps floor; a slower machine falls back to the 2D map unless `WALKTHROUGH_MODE=3d` (or `WALKTHROUGH_HEADED=1`) is set.
  - Playwright `recordVideo` output plays 11–14 % longer than wall-clock; the guards use wall-clock.

## Suggested opening message for the next chat

> Continue the MERIDIAN // VANTAGE hackathon project in `copsman/Hybrid-Deployment-Orchestrator` on branch `claude/hybrid-deployment-orchestrator-5bzv3m`. Read `CLAUDE.md` and `docs/HANDOFF.md` first, then run `npm ci && npm run verify` to confirm the baseline is green (56 tests; `npm run e2e` for the four browser tests). Then: [what you want next, for example "add the Vercel URL https://… and team name … to the README and regenerate the submission PDF"].
