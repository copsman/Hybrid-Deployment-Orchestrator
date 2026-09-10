# CLAUDE.md — MERIDIAN // VANTAGE

Hackathon entry: **Hybrid Deployment Orchestrator (Cloud + On-Prem + Air-Gapped Simulation)**. A Next.js 16 app that simulates one AI model (`mjc/scribe-8b`, the fictional SCRIBE assistant) deployed across three environments of the fictional **Meridian Joint Command**, with policy-based routing by classification, a signed artefact pipeline through a one-way data diode, a hash-chained decision ledger, a cinematic 3D control room, and a headless CLI that runs the same scenario. Full state, decisions and open items: `docs/HANDOFF.md`. Future work: `docs/ROADMAP.md`.

## Rules that must not be broken

- `src/engine` is pure TypeScript: relative imports only, no React, Next or DOM. The UI only subscribes to it. It must keep running headless via `npm run demo`.
- Policy is data in `src/engine/policy/rules.json`, evaluated deny-by-default. Do not hard-code routing decisions elsewhere. Every submission, allowed or refused, produces a full decision record with rule trace, candidates, verdict and ledger hash.
- Crypto is SHA-256 + Ed25519 (`@noble/*`) over canonical JSON, all through `src/engine/artefacts/crypto.ts`. **Nothing is encrypted anywhere**, deliberately. Do not add encryption, custom primitives or new crypto libraries.
- Fictional names only: Meridian Joint Command, OPEN / RESTRICTED / SECRET / ONYX, Meridian Cloud Region North, Fort Meridian Datacentre, Enclave OBSIDIAN. A test fails on real-world military terms.
- Simulated only: no API keys, no network calls, no database required to run or test.
- Dependencies are pinned exactly. React must stay at 19.2.8 (react-three-fiber peer range), TypeScript 5.x, ESLint 9.x, `@playwright/test` 1.56.1. `npm ci` must pass without `--legacy-peer-deps`.
- Determinism: same seed produces the same decisions, digests and ledger hashes. Keep the clock and PRNG injectable; never read wall-clock time inside the engine.

## Commands

```
npm ci                 # exact deps
npm run dev            # control room on :3000 (?intro=0 skips opener, ?speed=4 faster director, 2D toggle in top bar)
npm run demo           # headless scenario, exit 0 only if every check passes (--json for machine output)
npm test               # vitest + fast-check
npm run verify         # typecheck + lint + test + demo + build  — run before every push
npm run e2e            # Playwright smoke against a production build — run after UI changes
npm run submission     # rebuild docs/submission/*.pdf (SUBMISSION_TEAM / SUBMISSION_LIVE_URL / SUBMISSION_DATE)
```

## Working conventions

- Branch: `claude/hybrid-deployment-orchestrator-5bzv3m`. Commit with the harness-provided attribution trailer; never put model identifiers in code, docs or commit bodies.
- Keep zustand selectors stable (return existing references, derive with `useMemo`); a selector returning a fresh array caused a render loop once.
- Client components that touch `three`, `motion` or the stores start with `"use client"`. The 3D scene is loaded with `dynamic(..., { ssr: false })` from `src/components/scene/SceneCanvas.tsx`, which also falls back to the 2D map when WebGL is missing or the scene throws.
- shadcn components live in `src/components/ui` (fetched from the shadcn GitHub repo; the registry hosts are blocked in the cloud sandbox). Aceternity-style components in `src/components/aceternity` are hand-authored with registry names so they can be swapped later.
