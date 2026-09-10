# MERIDIAN // VANTAGE — handoff

**Repository:** `copsman/Hybrid-Deployment-Orchestrator` · **branch:** `claude/hybrid-deployment-orchestrator-5bzv3m`. All work is pushed. The default branch has not been touched and no pull request has been opened.

**What it is:** a hackathon entry for "Hybrid Deployment Orchestrator (Cloud + On-Prem + Air-Gapped Simulation)". A Next.js 16 app that simulates one AI model (`mjc/scribe-8b`, the fictional SCRIBE assistant) deployed across three environments of the fictional Meridian Joint Command, with policy-based routing by classification, a signed artefact pipeline through a one-way data diode, a hash-chained decision ledger, a cinematic 3D control room, and a headless CLI that runs the same scenario.

**Jury criteria the work targets:** fit to brief 20%, relevance 15%, runs end to end from README 25%, technical depth and correctness 25%, innovation 15%. The submission is a PDF of at most five pages: title, objective, solution, validation, results and conclusions.

## Decisions already made (do not reopen without the user)

- Fictional force **Meridian Joint Command**; markings **OPEN / RESTRICTED / SECRET / ONYX** (ONYX has no accredited environment and is always refused); environments **Meridian Cloud Region North** (elastic, metered, external), **Fort Meridian Datacentre** (4 GPU slots, queue, proxied egress), **Enclave OBSIDIAN** (2 GPU slots, no network, diode import). No real military names anywhere; a test enforces this.
- **Simulated only.** No API keys, no network calls, no database. Real stack names are shown per environment (Vercel, Vercel AI Gateway, Supabase Cloud, vLLM, Keycloak, Harbor, Vault, Langfuse, ClamAV) to tell the "same model, three stacks" story.
- Engine is **pure TypeScript** in `src/engine` (relative imports only, no React). Policy is **data** in `src/engine/policy/rules.json` (POL-01 to POL-08), evaluated deny-by-default with capability checks CAP-VERSION, CAP-EGRESS, CAP-SLOTS traced like rules. Selection: free capacity, then lowest cost, then most free slots.
- Crypto: SHA-256 + Ed25519 via `@noble/*` over canonical JSON (sorted keys). Keys derive from the demo seed. **No encryption anywhere**, on purpose: integrity and authenticity are the requirement, confidentiality across the gap is the diode's physical property, so there is no nonce to reuse.
- Artefact pipeline state machine: BUILT → SIGNED → PUBLISHED → MIRRORED → STAGED → IN_DIODE → QUARANTINE → VERIFYING (two distinct operators) → IMPORTED (pinned key, signature, digest, size, downgrade check) → LOADED, or REJECTED. The enclave's return-path attempt through the diode is counted and shown bouncing.
- UI: shadcn/ui components fetched from the shadcn GitHub repo (registries are blocked in the cloud sandbox), hand-authored Aceternity-style components under `src/components/aceternity`, a react-three-fiber scene with a 2D SVG fallback, zustand stores, and a scripted director that plays the 18-step scenario like a film.
- Pins that matter: React **19.2.8** (react-three-fiber 9.7 peer range), TypeScript 5.9.3, ESLint 9.39.5, `@playwright/test` 1.56.1 (matches the sandbox Chromium build). `npm ci` must pass without `--legacy-peer-deps`.

## State at handoff (all verified on 2026-09-09)

- `npm run verify` green: typecheck, lint, 40 vitest + fast-check tests, headless demo, production build.
- `npm run e2e` green: 2 Playwright tests (full scenario at 4x speed in 2D mode, malformed input + reset).
- Fresh-clone rehearsal passed (`npm ci`, demo, tests, build).
- CI workflow in `.github/workflows/ci.yml`: verify job, doubled headless run diffed for determinism, Playwright job.
- README complete with screenshots in `docs/screenshots`.
- Submission deck: `docs/submission/MERIDIAN-VANTAGE-submission.pdf` (5 pages, about 1.5 MiB). Source `docs/submission/submission.html`; rebuild with `npm run submission`.
- Roadmap: `docs/ROADMAP.md`.

## Commands

```
npm ci                 # exact deps
npm run dev            # control room on :3000 (?intro=0 skips opener, ?speed=4 faster director, 2D toggle in top bar)
npm run demo           # headless scenario, exit 0 only if all checks pass (--json for machine output)
npm test               # vitest + fast-check
npm run verify         # typecheck + lint + test + demo + build
npm run e2e            # Playwright against a production build (run `npx playwright install chromium` once outside the sandbox)
npm run submission     # rebuild the PDF; SUBMISSION_TEAM / SUBMISSION_LIVE_URL / SUBMISSION_DATE stamp the title page
```

## Repo map

```
src/engine/                   types, schema (zod v4), classification, environments, policy/{rules.json,evaluate.ts}, router,
                              artefacts/{canonical,crypto,manifest}, ledger, whatif, scenario, sim/{clock,rng}, index.ts (Engine class)
src/store/                    orchestrator.ts (engine snapshot, event log, packets, diode signal, pipeline actions),
                              director.ts (play/pause/next/stop, speed, reduced motion, intro flag, camera handler, URL params)
src/components/scene/         SceneCanvas (WebGL check + error boundary), Scene, Sites, Packets, DiodeGate, CameraRig, Poster, Fallback2D, layout.ts
src/components/control-room/  TopBar, EnvCards, JobsPanel, SubmitJobForm, DecisionTrace, DeploymentsMatrix, PipelineTracer, LedgerPanel,
                              PolicyPanel, WhatIfPanel, LogTicker, Captions, AlertOverlay, IntroOverlay, ImportCeremony, ControlRoom
src/components/aceternity/    spotlight-new, background-beams, tracing-beam, text-generate-effect, moving-border, hover-border-gradient,
                              glowing-effect, multi-step-loader
src/components/ui/            shadcn: button card badge tabs tooltip scroll-area separator table dialog switch progress input textarea select label checkbox sonner
src/components/shared/        ClassificationBadge, StatusLED, HudFrame, icons
src/app/                      layout.tsx (forced dark, Geist fonts), page.tsx, error.tsx, globals.css (tokens + animations)
scripts/                      demo.ts (headless run), build-submission.mjs (PDF)
tests/engine/                 canonical, crypto, ledger, policy (property-based), pipeline, scenario
tests/e2e/                    smoke.spec.ts
docs/                         screenshots/, submission/, ROADMAP.md, HANDOFF.md
```

## Open items (priority order)

1. **Deploy to Vercel.** User action: import the repo, default Next.js preset, no environment variables, Node is pinned to 22 in `package.json`. Then put the URL into the README quick start and regenerate the deck: `SUBMISSION_TEAM="…" SUBMISSION_LIVE_URL="https://…" npm run submission`, commit and push.
2. **Team name.** The title page currently reads "Team VANTAGE"; set the real name with `SUBMISSION_TEAM`.
3. **Optional polish not yet done:** keyboard-driven presenter mode, a recorded ninety-second walkthrough, richer sound design, swapping the hand-authored Aceternity-style components for registry versions with `npx shadcn add @aceternity/<name>` on a machine with internet.
4. **If time allows:** items from the "now" section of `docs/ROADMAP.md`, starting with real inference adapters behind the existing environment interface, simulated drivers staying the default.

## Conventions

- Commit messages end with the attribution trailer the harness provides. Never put model identifiers in code, docs or commit bodies.
- Run `npm run verify` before every push; run `npm run e2e` after UI changes.
- Keep the engine free of React and DOM imports; keep `rules.json` the single source of policy truth; keep every decision producing a full record; keep the "no encryption" stance.
- Fictional names only. The scenario test fails on real-world military terms.
- Known gotchas: zustand selectors must return stable references (derive with `useMemo`); the `LayoutProps` global type from Next only exists after a build, so `layout.tsx` types children explicitly; `pkill -f "next start"` in a script kills the script's own shell, so stop servers by PID.

## Suggested opening message for the next chat

> Continue the MERIDIAN // VANTAGE hackathon project in `copsman/Hybrid-Deployment-Orchestrator` on branch `claude/hybrid-deployment-orchestrator-5bzv3m`. Read `CLAUDE.md` and `docs/HANDOFF.md` first, then run `npm ci && npm run verify` to confirm the baseline is green. Then: [what you want next, for example "add the Vercel URL https://… and team name … to the README and regenerate the submission PDF"].
