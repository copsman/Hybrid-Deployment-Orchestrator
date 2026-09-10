<div align="center">

# MERIDIAN // VANTAGE

### Hybrid Deployment Orchestrator — cloud + on-prem + air-gapped simulation

**One model. Three perimeters. Every decision justified.**

[![ci](https://github.com/copsman/Hybrid-Deployment-Orchestrator/actions/workflows/ci.yml/badge.svg)](https://github.com/copsman/Hybrid-Deployment-Orchestrator/actions/workflows/ci.yml)
![node](https://img.shields.io/badge/node-22.x-3c873a) ![next](https://img.shields.io/badge/next-16.3-black) ![tests](https://img.shields.io/badge/tests-vitest%20%2B%20fast--check%20%2B%20playwright-22d3ee)

</div>

MERIDIAN // VANTAGE is a simulator and control room for a single AI workload (the fictional **SCRIBE** mission assistant, artefact `mjc/scribe-8b`) deployed across three environments of the fictional **Meridian Joint Command**:

| | CLOUD · Meridian Cloud Region North | ON-PREM · Fort Meridian Datacentre | AIR-GAPPED · Enclave OBSIDIAN |
|---|---|---|---|
| Capacity | elastic, metered per minute | 4 GPU slots, queue when full | 2 GPU slots |
| Network | external, egress allowed | outbound via inspection proxy only | **none** |
| Artefacts arrive by | registry pull (GHCR) | Harbor mirror through the proxy | **one-way data diode + two-person manual import** |
| Stack | Vercel, Vercel AI Gateway, managed GPU inference (vLLM), Supabase Cloud, Supabase Auth, Langfuse Cloud | Next.js standalone on k3s, vLLM on GPU nodes, self-hosted Supabase, Keycloak, Harbor, Vault, Prometheus/Grafana | the same containers imported through the diode: vLLM offline, Postgres + pgvector, Keycloak, Harbor (diode-fed), Vault, ClamAV quarantine, pinned signing key |

A **policy router** takes each job, evaluates a declarative, deny-by-default rule set against the job's classification and attributes, dispatches it to the right environment (or refuses it), and records the full decision with its justification in a **hash-chained ledger**. A **deployment view** shows the same signed model artefact, with the same SHA-256 digest, present and versioned in all three environments, including how it crossed the diode. A **director mode** plays the whole story like a film.

> Everything is simulated and deterministic. No API keys, no network calls, no database. The same seed produces the same decisions, digests and ledger hashes on every run.

<p align="center">
  <img src="docs/screenshots/scenario-complete.png" alt="Control room after the scenario: three jobs routed, three refused" width="100%" />
</p>
<p align="center">
  <img src="docs/screenshots/diode-transfer.png" alt="One-way diode transfer with a blocked return attempt" width="49%" />
  <img src="docs/screenshots/import-ceremony.png" alt="Two-person import ceremony inside the enclave" width="49%" />
</p>
<p align="center">
  <img src="docs/screenshots/decision-trace.png" alt="Decision record with the full rule trace" width="49%" />
  <img src="docs/screenshots/deployments.png" alt="Same model, three stacks, digest parity" width="49%" />
</p>

---

## Quick start

Requires **Node 22** (`.nvmrc` provided) and npm.

```bash
npm ci            # exact, locked dependencies
npm run dev       # control room on http://localhost:3000
```

Press **PLAY SCENARIO** in the top bar (or **PLAY THE SCENARIO** on the intro screen). The director resets the sandbox, submits the jobs, refuses the ones policy forbids, ships version 1.4.0 through the diode, and finishes with a ledger verification. Press it again for an identical second run. Useful URL switches: `?intro=0` skips the opener, `?speed=4` runs the director four times faster, and the **2D** toggle swaps the 3D scene for the SVG map. Press `?` for the presenter keys.

### Presenter keys

The whole story can be driven from the keyboard; the rail in the top bar shows the step counter and one colour-coded segment per scenario step. Keys are ignored while typing in a field and while the opener is on screen.

| Key | Action |
|---|---|
| `SPACE` | play · pause · resume |
| `N` or `→` | next step (during the diode transfer the remaining chunks are drained at once) |
| `←` | re-centre the camera on the current step |
| `1` `2` `3` `4` `5` `6` | overview · router · cloud · on-prem · diode · enclave |
| `+` / `−` | faster / slower (0.5× 1× 2× 4×) |
| `SHIFT+R` | reset the sandbox (same seed, identical second run); plain `R` only warns |
| `S` | sound on / off |
| `M` | 2D map / 3D scene |
| `F` | fullscreen |
| `J` | jury view (hides the manual controls) |
| `?` | the legend; `ESC` closes it |

### Jury view

Open `/?jury=1` (or press `J`) for a presentation layout: the submit form, the pipeline and ledger tamper buttons, the raw policy JSON, the next/stop/speed/reset buttons and the WHAT-IF tab are hidden, the scene gets a wider frame, and the side panel follows the story on its own (JOBS → DECISION → PIPELINE → DEPLOYMENTS → DECISION → JOBS → LEDGER; a manual tab click sticks until the next chapter). Everything is still driven by the keys above, so nothing in the room can be edited by accident. The flag lives in the URL only and is never persisted; a plain visit always shows the operator controls.

Headless, no browser:

```bash
npm run demo             # runs the full scenario in Node and prints decisions, deployments, ledger checks
npm run demo -- --json   # machine-readable
npm test                 # unit + property-based tests (vitest + fast-check)
npm run verify           # typecheck + lint + test + demo + production build
npm run e2e              # Playwright smoke test against a production build (needs `npx playwright install chromium` once)
```

Production build and Vercel: `npm run build && npm start`. The project deploys to Vercel with the default Next.js preset and no environment variables.

---

## The scenario the jury asked for

| Step | Job | Classification / attributes | Outcome | Why |
|---|---|---|---|---|
| A | Public affairs brief | **OPEN** | → **CLOUD** | POL-05 permits cloud or on-prem; cloud wins on cost (6.3 vs 10.2 credits) |
| B | Maintenance log summarisation | **RESTRICTED**, personal data | → **ON-PREM** | POL-04 restricts to the sovereign perimeter; POL-06 excludes cloud for personal data |
| C (1st) | Intelligence fusion | **SECRET**, needs model 1.4.0 | ✖ **REFUSED** (CAP-VERSION) | Enclave still runs 1.3.0; the router refuses instead of silently downgrading |
| — | Ship 1.4.0 | build → sign → publish → mirror → stage → **diode** → quarantine → **two-person approval** → verify (pinned key, Ed25519, SHA-256, size, downgrade) → load | parity 1.4.0 consistent | Same digest in all three environments |
| C (2nd) | Same job again | **SECRET**, 1.4.0 | → **AIR-GAPPED** | POL-02: SECRET executes only inside the enclave |
| D | Compartmented tasking | **ONYX** | ✖ **REFUSED** (POL-01) | No environment in this deployment is accredited for ONYX |
| E | Live open-source cross-check | **SECRET**, live external retrieval | ✖ **REFUSED** (POL-03) | SECRET means the enclave; the enclave has no network; the constraints conflict |

Three classifications land in three environments, three requests are refused with three different, logged reasons.

---

## What is in the box

```
src/engine/                 pure TypeScript, no React — runs in the browser, in Node and in the tests
  policy/rules.json         the routing policy as data (POL-01 … POL-08), validated by zod at load
  policy/evaluate.ts        deny-by-default evaluator, per-rule trace, capability checks (CAP-VERSION, CAP-EGRESS)
  router.ts                 selection among permitted environments: free capacity → cost → free slots
  artefacts/crypto.ts       SHA-256 + Ed25519 (noble), the only crypto module
  artefacts/canonical.ts    canonical JSON used for every signature and hash
  artefacts/manifest.ts     signed manifests, bundle verification against the pinned key
  ledger.ts                 hash-chained decision ledger + verifier
  index.ts                  Engine: environments, jobs, artefact pipeline state machine, diode, import, parity
  scenario.ts / whatif.ts   the director script; counterfactual explanations for refused jobs
src/store/                  zustand stores: engine snapshot, event log, packets for the scene, the director
src/components/scene/       react-three-fiber scene (sites, packets, diode gate, camera rig) + 2D SVG fallback
src/components/control-room Jobs, Decision trace, Deployments (stack matrix + parity), Pipeline, Ledger, Policy, What-if
scripts/demo.ts             headless run of the scenario
tests/                      vitest unit tests, fast-check invariants, Playwright smoke test
```

### Policy as data

Rules live in [`src/engine/policy/rules.json`](src/engine/policy/rules.json) and are shown verbatim in the POLICY tab. Evaluation is top to bottom with a default effect of **DENY**: a job is only routable if a `RESTRICT_TO` rule grants a set of environments, `EXCLUDE` rules subtract from it, and any matching `REFUSE` rule ends evaluation. Two capability checks then run and are traced like rules: the requested model version must be loaded in the environment (`CAP-VERSION`, which reports "pending diode transfer" while a bundle is in flight) and live external retrieval needs an environment with outbound network (`CAP-EGRESS`). Fixed-capacity environments queue when full; nothing ever spills to a less restrictive perimeter.

Every submission, allowed or refused, produces a decision record: the input snapshot, every rule with matched / effect / note, a candidate table with the reason each environment was excluded, the verdict, the tie-break, and the hash of the ledger entry that recorded it.

### The artefact pipeline and the diode

```
BUILT → SIGNED → PUBLISHED (cloud) → MIRRORED (on-prem) → STAGED → IN_DIODE → QUARANTINE → VERIFYING → IMPORTED → LOADED
                                                                                    └────────────── REJECTED
```

The artefact bytes are a deterministic synthetic buffer, so the digests are real. The manifest (`name, version, digest, sizeBytes, format, builtAt, builder`) is canonicalised and signed with Ed25519. The signing key lives on the low side; each environment holds only the pinned public key. The diode is modelled as a chunked, one-way transfer with no acknowledgement; the enclave's attempt to send an ACK back is counted and shown bouncing off the gate. On the high side the bundle sits in quarantine, needs two distinct operators to approve, and is verified before import: signer equals pinned key, signature valid over the canonical manifest, SHA-256 of the received bytes equals the signed digest, size matches, and the version is not a downgrade. The PIPELINE tab has "tamper" buttons that flip one byte or re-sign with a rogue key so you can watch the import get rejected.

### The ledger

`hash_n = SHA-256( hash_{n-1} ‖ canonical-json(entry_n) )`, genesis previous hash all zeros. Every decision, dispatch, completion, publish, mirror, diode transfer, scan, approval, import and rejection is a link. The LEDGER tab can verify the chain, tamper with a historical decision (the verifier points at the exact entry) and restore it.

### What-if

A dry run of the policy plus single-attribute counterfactuals: "drop the live retrieval requirement → would route to AIR-GAPPED", "pseudonymise the input → would route to CLOUD", or "no single change makes this routable". Nothing is dispatched or recorded.

---

## Cryptography notes (what we did and did not do)

- SHA-256 for digests and the ledger chain, Ed25519 (RFC 8032, strict verification, `zip215: false`) for manifests, both from the audited `@noble` libraries. No home-made primitives.
- Signatures are over a canonical JSON encoding (sorted keys, no whitespace, no `undefined`/`NaN`), property-tested for idempotence and key-order independence, so a re-serialised manifest verifies and an edited one does not.
- **Nothing is encrypted.** The requirement is integrity and authenticity of artefacts and decisions, not confidentiality of the bytes on the wire; confidentiality across the gap is the diode's physical property. That also means there is no nonce anywhere to reuse.
- Keys are derived from the demo seed so runs are reproducible. In production the build key sits in an HSM on the low side and only the public half is provisioned into each environment.

---

## Testing and reproducibility

- `npm test`: 40 tests. Property-based invariants (fast-check) include: SECRET never lands on cloud or on-prem, ONYX is always refused, jobs needing external retrieval never land in the enclave, personal data never lands in cloud, every decision has a rule id and a justification, the ledger detects tampering at any position, a flipped byte or a wrong signer is always rejected, the input schema never throws on arbitrary JSON, and two fresh runs produce identical ledgers.
- `npm run demo` runs the same scenario headless and exits non-zero if any step fails or the ledger does not verify. CI runs it twice and diffs the results.
- `npm run e2e` drives the real UI in Chromium: plays the scenario to "SCENARIO COMPLETE", checks where each job landed, breaks and restores the ledger, submits garbage JSON, and resets.
- Reset restores the seed: a second run in the same tab reproduces the first, hash for hash.

## Accessibility and fallbacks

The 3D scene is decoration. The **2D** switch in the top bar (or `prefers-reduced-motion`) swaps it for an SVG map with the same packets and diode animation, and the control room falls back to the map automatically if WebGL is unavailable or the scene fails to render. Sound is off by default.

## Mapping to real tooling

The policy engine plays the role an OPA or Cedar sidecar plays in production; the artefact signing mirrors Sigstore cosign and SLSA provenance; the diode and import ceremony mirror commercial unidirectional gateways and cross-domain solutions; the three environments correspond to a sovereign cloud region, an on-prem Kubernetes estate and an air-gapped distributed-cloud appliance. The same open-weight model is served by vLLM everywhere and addressed through one OpenAI-compatible gateway, which is what makes "same model, three stacks" practical.

## Continuing this project

`docs/HANDOFF.md` is the state-of-the-world document for anyone (or any assistant) picking this up: decisions already made, what is verified, open items, and conventions. `CLAUDE.md` carries the short version that Claude Code loads automatically.

## Submission deck and roadmap

- `docs/submission/MERIDIAN-VANTAGE-submission.pdf` is the five-page jury deck (title, objective, solution, validation, results). Regenerate it with `npm run submission`; set `SUBMISSION_TEAM` and `SUBMISSION_LIVE_URL` to stamp your team name and Vercel URL onto the title page. The source is `docs/submission/submission.html`.
- `docs/ROADMAP.md` lists what comes after the hackathon: real inference adapters, ledger persistence, OPA/Cedar export, cosign-signed bundles, coalition releasability, attestation, and the research directions.

## Limitations

This is a simulator. Capacity, cost and latency are modelled, not measured; jobs produce a simulated output line rather than real inference; the diode is a state machine, not a protocol implementation. The architecture is deliberately the one a real deployment would have, so swapping the evaluator for OPA, the signer for cosign, and the environments for real clusters changes adapters, not the control room.

## Licence

MIT. All names, units, markings and places are fictional.
