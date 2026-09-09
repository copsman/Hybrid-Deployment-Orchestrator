# Roadmap — MERIDIAN // VANTAGE

What exists today is a deterministic simulator with the architecture of the real thing: a pure engine, policy as data, a signed artefact pipeline through a one-way link, and a tamper-evident ledger. Everything below keeps those interfaces and swaps simulation for adapters, one layer at a time.

Status legend: **now** = next sprint after the hackathon, **next** = one to three months, **later** = research and larger integrations. Nothing here is promised; it is the order we would do it in.

---

## 1. From simulator to product (now)

- **Real inference adapters behind the same `Environment` interface.** Cloud and on-prem lanes call an OpenAI-compatible endpoint (Vercel AI Gateway, a managed vLLM pool, or on-prem vLLM) when `MJC_CLOUD_BASE_URL` / `MJC_ONPREM_BASE_URL` are set; the air-gapped lane accepts only a loopback URL and keeps the egress guard. Simulated drivers stay the default so the demo never needs keys.
- **Ledger persistence.** Append entries to Postgres (Supabase Cloud in the cloud lane, self-hosted Supabase on-prem, plain Postgres in the enclave) with the hash chain verified on read. Each perimeter keeps its own chain; a periodic signed head is published outward through the diode's return-less channel (see §5).
- **Policy export to OPA / Cedar.** Generate Rego and Cedar from `rules.json` so the same policy can run as a sidecar next to a real gateway. The JSON stays the source of truth; the exporters are tested by replaying the scenario through each engine and diffing verdicts.
- **cosign-signed bundles.** Replace the synthetic artefact with an OCI artefact (safetensors weights + manifest) signed with Sigstore cosign, keyless in cloud and with an HSM key on the low side. The enclave verifies with the pinned public key exactly as today.
- **Operator identity.** Two-person approval bound to real identities (Keycloak on-prem and in the enclave, Supabase Auth in cloud) with role separation enforced by the identity provider, not the form.
- **Deployment recipes.** Docker Compose bundles for on-prem and for the enclave (standalone Next.js image, Postgres, Keycloak, Harbor, vLLM), plus the diode export/import scripts that produce and consume the signed bundle.

## 2. Policy and data (next)

- **Attributes from sources, not forms.** Derive classification, personal-data and releasability flags from labelled data sources (document labels, dataset manifests) and identity claims, with the submitted values treated as a request that the policy can tighten but never loosen.
- **Coalition releasability.** Model partner enclaves as first-class environments with their own accreditation and pinned keys; `REL TO`-style caveats route to the intersection of permitted perimeters.
- **Declassification and downgrade workflow.** A separate, two-person ceremony with its own ledger kind for moving outputs from a higher perimeter to a lower one, including redaction evidence.
- **Policy testing as a product feature.** Ship the property-based invariants ("no SECRET path to cloud, ever") as a policy test suite that runs on every rule change, with a diff view of which historical decisions would change.
- **Time and capacity aware scheduling.** Batch jobs can be given a window; the router picks the cheapest permitted perimeter that has capacity inside the window, and the decision record shows the alternatives it considered.

## 3. Supply chain and assurance (next)

- **SLSA provenance and SBOMs travel with the bundle.** in-toto attestations for the build, an SBOM for the serving image, and a model card, all covered by the same signature and checked before import.
- **Reproducible model builds.** Rebuild the artefact from source and data manifests on the low side and compare digests before signing.
- **Hardware attestation before load.** The enclave's vLLM nodes present TPM or TEE quotes; the load step refuses nodes whose measured boot does not match the accredited baseline.
- **Model watermarking and output tagging.** Embed a per-perimeter watermark so exfiltrated outputs can be traced back to the environment that produced them.

## 4. Operations (next)

- **Drift and parity monitoring.** Continuous parity checks across perimeters with alerts when an environment serves a digest that is not the approved one.
- **Capacity forecasting.** Use the ledger's dispatch history to forecast queue depth per perimeter and recommend when to schedule the next diode import window.
- **Cost attribution.** Charge simulated or real credits back to the requesting unit, per perimeter, from the same ledger entries.
- **Runbooks generated from the ledger.** Turn an import ceremony into a printable record for accreditation audits.

## 5. Research directions (later)

- **Outbound telemetry through a second diode** with differential privacy applied inside the enclave, so operators outside can see health and usage without any content leaving.
- **Formal verification of the policy.** Model the evaluator and rule set in TLA+ or Alloy and prove the safety properties the tests currently sample.
- **Federated evaluation.** Score model quality inside each perimeter on local data and compare only signed summary statistics.
- **Multi-model routing.** Extend "one artefact everywhere" to families of models with per-perimeter allow-lists, so a frontier model can be permitted for OPEN work in cloud while the open-weight model remains the only one accredited for SECRET.
- **Red-team mode.** A scripted adversary that tries misclassified submissions, tampered bundles, replayed approvals and rolled-back versions, with the control room showing each attempt being caught.

## 6. Demo and presentation polish (now)

- Vercel deployment URL in the README and on the title page of the submission (`SUBMISSION_LIVE_URL=... npm run submission`).
- A ninety-second recorded walkthrough of director mode for judges who cannot run the app.
- Keyboard-driven presenter mode (space to advance, arrows for camera presets) and a "jury view" that hides the manual controls.
- Optional narration audio synced to the captions.

## Non-goals

- Replacing Kubernetes, registries, identity providers or diodes. VANTAGE is the policy and evidence plane on top of them.
- Encrypting artefacts in transit as a substitute for the diode. Confidentiality across the gap is a physical property of the link; the software's job is integrity, authenticity and evidence.
- Automating the two-person rule away. The ceremony is the point.
