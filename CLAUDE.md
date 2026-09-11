# CLAUDE.md — MERIDIAN // VANTAGE

Hackathon entry: **Hybrid Deployment Orchestrator (Cloud + On-Prem + Air-Gapped Simulation)**. A Next.js 16 app that simulates one AI model (`mjc/scribe-8b`, the fictional SCRIBE assistant) deployed across three environments of the fictional **Meridian Joint Command**, with policy-based routing by classification, a signed artefact pipeline through a one-way data diode, a hash-chained decision ledger, a cinematic 3D control room, and a headless CLI that runs the same scenario. Full state, decisions and open items: `docs/HANDOFF.md`. Future work: `docs/ROADMAP.md`.

## Rules that must not be broken

- `src/engine` is pure TypeScript: relative imports only, no React, Next or DOM. The UI only subscribes to it. It must keep running headless via `npm run demo`.
- Policy is data in `src/engine/policy/rules.json`, evaluated deny-by-default. Do not hard-code routing decisions elsewhere. Every submission, allowed or refused, produces a full decision record with rule trace, candidates, verdict and ledger hash.
- Crypto is SHA-256 + Ed25519 (`@noble/*`) over canonical JSON, all through `src/engine/artefacts/crypto.ts`. **Nothing is encrypted anywhere**, deliberately. Do not add encryption, custom primitives or new crypto libraries.
- Fictional names only: Meridian Joint Command, OPEN / RESTRICTED / SECRET / ONYX, Meridian Cloud Region North, Fort Meridian Datacentre, Enclave OBSIDIAN. A test fails on real-world military terms.
- Simulated only: no API keys, no network calls, no database required to run or test. The scene loads exactly one asset, `public/fonts/GeistMono-Regular.ttf`, from its own origin.
- `next.config.ts` sets `output: "standalone"` for Docker only; it must stay off when `VERCEL` is set, because Vercel's adapter build does not emit `.next/next-server.js.nft.json` and the standalone copy step fails with ENOENT.
- Dependencies are pinned exactly. React must stay at 19.2.8 (react-three-fiber peer range), TypeScript 5.x, ESLint 9.x, `@playwright/test` 1.56.1. `npm ci` must pass without `--legacy-peer-deps`.
- Determinism: same seed produces the same decisions, digests and ledger hashes. Keep the clock and PRNG injectable; never read wall-clock time inside the engine.
- Keep the browser-test contract in `tests/e2e/*.spec.ts`: the `data-testid`s, the `2D MAP · <LABEL>` focus badge text, `ledger-status` reading `CHAIN INTACT` / `CHAIN BROKEN`, exactly one element matching "Submission rejected" (the toast; the orchestrator's log line says "rejected by the schema" on purpose), and the jury view hiding every manual control. Change a spec only for an intentional UI change.
- Scene text: every 3D label goes through `SceneText` with the local font and `characters=SCENE_GLYPHS` (`src/lib/palette.ts`); literal strings and templates live in `src/components/scene/labels.ts`, where `tests/scene/labels.test.ts` proves them. No drei `<Html>` labels in the scene and no glyph outside the set (troika would fetch a fallback font from a CDN).
- Scene selectors (`src/components/scene/selectors.ts`) return primitives, string keys or references already stored; never build an object or array inside a selector.
- The 2D map (`src/components/scene/Fallback2D.tsx`, `map2d/`) must not import `three` or `scene/layout.ts`; it reads the same selectors and `src/lib/palette.ts`.

## Commands

```
npm ci                 # exact deps
npm run build && npm start   # production server on :3000 — what judges, Vercel and Docker run (npm run prod does both)
npm run dev            # dev server on :3000, for editing only (?intro=0 skips opener, ?speed=4 faster director, ?jury=1 jury view, ?stats=1 logs draw calls; M toggles the 2D map, ? lists the presenter keys)
npm run demo           # headless scenario, exit 0 only if every check passes (--json for machine output)
npm test               # vitest + fast-check: engine invariants, scene layout invariants, label glyph coverage
npm run verify         # typecheck + lint + test + demo + build  — run before every push
npm run e2e            # Playwright (smoke ×2, presenter, jury) against a production build — run after UI changes
npm run walkthrough    # record docs/walkthrough/*.webm + poster and refresh docs/screenshots (WALKTHROUGH_HEADED=1 for a real GPU)
npm run submission     # rebuild docs/submission/*.pdf (team "Event Horizon" by default; SUBMISSION_TEAM / SUBMISSION_LIVE_URL / SUBMISSION_DATE override)

make up                 # docker compose: build the image, serve the same demo behind a local HTTPS proxy (Caddy, self-minted cert) — needs only Docker + Docker Compose, no Node
make down / make clean  # stop, or stop + drop volumes (Caddy's local CA)
make verify / make test / make demo   # same checks as above, run inside a throwaway container
```

## Working conventions

- Branch: `claude/hybrid-deployment-orchestrator-5bzv3m`. Commit with the harness-provided attribution trailer; never put model identifiers in code, docs or commit bodies. Stage explicit paths; never `git add -A`; never stage `.claude/`.
- Keep zustand selectors stable (return existing references, derive with `useMemo`); a selector returning a fresh array caused a render loop once. `react-hooks/set-state-in-effect` is on: derive state inside `subscribe` callbacks or timers, never `setState` synchronously in an effect body.
- Client components that touch `three`, `motion` or the stores start with `"use client"`. The 3D scene is loaded with `dynamic(..., { ssr: false })` from `src/components/scene/SceneCanvas.tsx`, which also falls back to the 2D map when WebGL is missing or the scene throws. Every `useFrame` null-guards its refs and allocates nothing.
- shadcn components live in `src/components/ui` (fetched from the shadcn GitHub repo; the registry hosts are blocked in the cloud sandbox). Aceternity-style components in `src/components/aceternity` are hand-authored on purpose: they are progress- and value-driven variants the registry does not offer, and the registry CLI would touch pinned dependencies. Do not swap them for registry versions.
- `next dev` (Next 16) rewrites this file with a `nextjs-agent-rules` comment block whenever a dev server starts. Remove the block (`git checkout CLAUDE.md`) after a dev session; never commit it.
