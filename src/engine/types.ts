/**
 * MERIDIAN // VANTAGE — engine types.
 * Pure TypeScript. No React, Next or DOM imports anywhere in src/engine.
 */

export const CLASSIFICATIONS = ["OPEN", "RESTRICTED", "SECRET", "ONYX"] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

export const RELEASABILITIES = ["MJC", "MJC-PARTNERS", "MJC-EYES-ONLY"] as const;
export type Releasability = (typeof RELEASABILITIES)[number];

export const LATENCIES = ["interactive", "batch"] as const;
export type Latency = (typeof LATENCIES)[number];

export const ENV_IDS = ["cloud", "onprem", "airgapped"] as const;
export type EnvId = (typeof ENV_IDS)[number];

export type NetworkPosture = "EXTERNAL" | "PROXIED" | "NONE";

export interface StackComponent {
  layer: string;
  name: string;
  detail: string;
  /** lucide icon name hint for the UI layer (engine does not import icons). */
  icon: string;
}

export interface EnvironmentSpec {
  id: EnvId;
  name: string;
  codename: string;
  kind: "cloud" | "onprem" | "airgapped";
  description: string;
  /** null = elastic */
  slots: number | null;
  /** simulated cost per GPU-minute in credits */
  costPerMinute: number;
  network: NetworkPosture;
  egress: boolean;
  /** how artefacts arrive */
  artefactChannel: "registry-pull" | "mirror-sync" | "diode-import";
  /** simulated latency to the dispatcher in ms */
  baseLatencyMs: number;
  stack: StackComponent[];
}

export interface JobInput {
  title: string;
  summary: string;
  classification: Classification;
  pii: boolean;
  egress: boolean;
  releasability: Releasability;
  modelVersion: string;
  latency: Latency;
  /** optional caller-supplied id, otherwise generated */
  id?: string;
}

export type JobStatus =
  | "SUBMITTED"
  | "ROUTED"
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "REFUSED";

export interface Job extends JobInput {
  id: string;
  submittedAt: string;
  status: JobStatus;
  environment: EnvId | null;
  decisionId: string;
  queuePosition?: number;
  outputPreview?: string;
}

export type RuleEffect = "REFUSE" | "RESTRICT_TO" | "EXCLUDE" | "QUEUE" | "SELECT";

export interface RuleCondition {
  classification?: Classification | Classification[];
  pii?: boolean;
  egress?: boolean;
  releasability?: Releasability | Releasability[];
  latency?: Latency;
}

export interface PolicyRule {
  id: string;
  title: string;
  when: RuleCondition;
  effect: "REFUSE" | "RESTRICT_TO" | "EXCLUDE";
  environments?: EnvId[];
  justification: string;
}

export interface RuleTrace {
  ruleId: string;
  title: string;
  matched: boolean;
  effect: RuleEffect | "NOOP";
  environments?: EnvId[];
  note: string;
}

export interface Candidate {
  env: EnvId;
  allowed: boolean;
  reasons: string[];
  cost: number;
  freeSlots: number | null;
  hasVersion: boolean;
}

export type Verdict =
  | { kind: "ROUTE"; env: EnvId; tieBreak: string }
  | { kind: "QUEUE"; env: EnvId; position: number; tieBreak: string }
  | { kind: "REFUSE"; reason: string; ruleId: string };

export interface Decision {
  id: string;
  jobId: string;
  at: string;
  input: JobInput;
  trace: RuleTrace[];
  candidates: Candidate[];
  verdict: Verdict;
  justification: string;
  ledgerHash: string;
  dryRun: boolean;
}

export type ArtefactState =
  | "BUILT"
  | "SIGNED"
  | "PUBLISHED"
  | "MIRRORED"
  | "STAGED"
  | "IN_DIODE"
  | "QUARANTINE"
  | "VERIFYING"
  | "IMPORTED"
  | "LOADED"
  | "REJECTED";

export interface Manifest {
  name: string;
  version: string;
  format: "safetensors";
  digest: string; // sha256 hex of artefact bytes
  sizeBytes: number;
  builtAt: string;
  builder: string;
}

export interface SignedManifest {
  manifest: Manifest;
  signature: string; // hex, Ed25519 over canonical JSON of manifest
  publicKey: string; // hex
  algorithm: "Ed25519";
  canonicalization: "sorted-keys-json";
}

export interface DiodeTransfer {
  id: string;
  version: string;
  totalChunks: number;
  sentChunks: number;
  /** a real diode has no return channel; we record attempted return traffic to show it bouncing */
  returnAttempts: number;
  startedAt: string;
  completedAt: string | null;
}

export interface ImportApproval {
  operator: string;
  at: string;
}

export interface ArtefactVersion {
  version: string;
  manifest: SignedManifest;
  /** raw synthetic bytes kept in memory so digests are real */
  bytes: Uint8Array;
  state: ArtefactState;
  presentIn: Record<EnvId, boolean>;
  loadedIn: Record<EnvId, boolean>;
  transfer: DiodeTransfer | null;
  approvals: ImportApproval[];
  rejectionReason: string | null;
  history: { at: string; state: ArtefactState; note: string }[];
}

export type LedgerKind =
  | "GENESIS"
  | "DECISION"
  | "DISPATCH"
  | "QUEUE"
  | "COMPLETE"
  | "ARTEFACT_BUILT"
  | "ARTEFACT_SIGNED"
  | "PUBLISHED"
  | "MIRRORED"
  | "DIODE_STAGED"
  | "DIODE_TRANSFER"
  | "QUARANTINE_SCAN"
  | "IMPORT_APPROVAL"
  | "IMPORT_VERIFIED"
  | "IMPORT_REJECTED"
  | "RESET";

export interface LedgerEntry {
  seq: number;
  at: string;
  kind: LedgerKind;
  subject: string;
  payload: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

export interface LedgerVerification {
  ok: boolean;
  length: number;
  head: string;
  brokenAt: number | null;
  detail: string;
}

export interface EnvironmentRuntime {
  spec: EnvironmentSpec;
  running: string[]; // job ids
  queue: string[]; // job ids
  completed: number;
  spentCredits: number;
  /** outbound attempts blocked by the network guard (air-gapped only) */
  blockedEgress: number;
}

export interface ParityReport {
  version: string;
  digests: Record<EnvId, string | null>;
  consistent: boolean;
  missing: EnvId[];
}

export interface WhatIfSuggestion {
  change: string;
  field: keyof JobInput;
  value: unknown;
  outcome: Verdict;
}

export interface WhatIfReport {
  baseline: Decision;
  suggestions: WhatIfSuggestion[];
}

export interface EngineSnapshot {
  jobs: Job[];
  decisions: Decision[];
  environments: EnvironmentRuntime[];
  artefacts: ArtefactVersion[];
  ledger: LedgerEntry[];
  now: string;
  seed: number;
}

export type EngineEvent =
  | { type: "job.decided"; decision: Decision; job: Job }
  | { type: "job.started"; job: Job }
  | { type: "job.completed"; job: Job }
  | { type: "artefact.state"; version: string; state: ArtefactState; note: string }
  | { type: "diode.progress"; transfer: DiodeTransfer }
  | { type: "ledger.appended"; entry: LedgerEntry }
  | { type: "egress.blocked"; env: EnvId; target: string }
  | { type: "reset" };
