"use client";

import { MultiStepLoader } from "@/components/aceternity/multi-step-loader";
import { useDirector } from "@/store/director";
import { useOrchestrator } from "@/store/orchestrator";
import { NEW_VERSION } from "@/engine/scenario";

const STATES = [
  { text: "QUARANTINE SCAN", detail: "ClamAV signatures · file type · no executable segments" },
  { text: "OPERATOR 1 APPROVAL", detail: "OPS-WATCH-1 · operations role" },
  { text: "OPERATOR 2 APPROVAL", detail: "SEC-OFFICER-2 · security role" },
  { text: "SIGNER MATCHES PINNED KEY", detail: "Ed25519 public key provisioned at enclave build time" },
  { text: "SIGNATURE VALID", detail: "over the canonical manifest" },
  { text: "SHA-256 DIGEST MATCHES", detail: "recomputed over the received bytes" },
  { text: "NOT A DOWNGRADE · LOAD IN vLLM", detail: "enclave serves the new version" },
];

/** Overlay shown on the scene while the director walks the high-side import ceremony. */
export function ImportCeremony() {
  const status = useDirector((s) => s.status);
  const stepId = useDirector((s) => (s.stepIndex >= 0 ? s.steps[s.stepIndex]?.id : null));
  const artefacts = useOrchestrator((s) => s.snapshot.artefacts);
  const a = artefacts.find((x) => x.version === NEW_VERSION);
  const active = status === "playing" || status === "paused";
  const show = active && (stepId === "scan" || stepId === "approve" || stepId === "verify");
  let value = 0;
  let done = false;
  if (a) {
    if (stepId === "scan") value = 0;
    if (stepId === "approve") value = Math.min(2, a.approvals.length);
    if (stepId === "verify") {
      if (a.state === "LOADED") {
        value = 6;
        done = true;
      } else if (a.state === "IMPORTED") value = 6;
      else if (a.state === "REJECTED") value = 3;
      else value = 3;
    }
  }
  return <MultiStepLoader loading={show} value={value} done={done} loadingStates={STATES} title={`Enclave OBSIDIAN · import ceremony · ${NEW_VERSION}`} />;
}
