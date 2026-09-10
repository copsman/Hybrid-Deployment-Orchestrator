/**
 * Stable zustand selectors for the scene and the 2D map.
 *
 * Every selector returns a primitive, a string key or a reference that already lives in
 * the store. Strings compare by value under Object.is, so a key rebuilt on each store
 * read is still a stable selector result: a component subscribed to `selQueueKey.onprem`
 * re-renders only when the on-prem queue actually changes, not on every engine refresh.
 * Objects and arrays are never constructed inside a selector (a fresh array from a
 * selector caused a render loop once).
 */
import { ENVIRONMENTS, type ArtefactState, type ArtefactVersion, type Classification, type EnvId, type EnvironmentRuntime, type EnvironmentSpec } from "@/engine";
import type { OrchestratorState, Packet } from "@/store/orchestrator";
import type { DirectorState } from "@/store/director";

type S = OrchestratorState;
type D = DirectorState;

const IDS: EnvId[] = ["cloud", "onprem", "airgapped"];

function env(s: S, id: EnvId): EnvironmentRuntime | undefined {
  const list = s.snapshot.environments;
  for (let i = 0; i < list.length; i++) if (list[i].spec.id === id) return list[i];
  return undefined;
}

function byId<T>(make: (id: EnvId) => (s: S) => T): Record<EnvId, (s: S) => T> {
  return { cloud: make("cloud"), onprem: make("onprem"), airgapped: make("airgapped") };
}

/** The environment spec (identity-stable: the engine hands out the ENVIRONMENTS object). */
export const selSpec: Record<EnvId, (s: S) => EnvironmentSpec> = byId((id) => (s) => env(s, id)?.spec ?? ENVIRONMENTS[id]);

/** Number of jobs running in the environment (lit GPU slots / elastic pods). */
export const selRunning: Record<EnvId, (s: S) => number> = byId((id) => (s) => env(s, id)?.running.length ?? 0);

/** Queue as `jobId:classification,...` (empty string when nothing waits). */
export const selQueueKey: Record<EnvId, (s: S) => string> = byId((id) => (s) => {
  const e = env(s, id);
  if (!e || e.queue.length === 0) return "";
  const jobs = s.snapshot.jobs;
  let out = "";
  for (let i = 0; i < e.queue.length; i++) {
    const jobId = e.queue[i];
    let cls: Classification = "OPEN";
    for (let j = 0; j < jobs.length; j++) {
      if (jobs[j].id === jobId) {
        cls = jobs[j].classification;
        break;
      }
    }
    out += (i ? "," : "") + jobId + ":" + cls;
  }
  return out;
});

export interface QueueEntry {
  jobId: string;
  classification: Classification;
}

export function parseQueueKey(key: string): QueueEntry[] {
  if (!key) return [];
  return key.split(",").map((part) => {
    const i = part.lastIndexOf(":");
    return { jobId: part.slice(0, i), classification: (part.slice(i + 1) || "OPEN") as Classification };
  });
}

export type VersionPresence = "loaded" | "present" | "inflight" | "rejected" | "absent";

const IN_FLIGHT: ReadonlySet<ArtefactState> = new Set<ArtefactState>(["STAGED", "IN_DIODE", "QUARANTINE", "VERIFYING"]);

function presenceCode(a: ArtefactVersion, id: EnvId): string {
  if (a.loadedIn[id]) return "L";
  if (a.presentIn[id]) return "P";
  if (id === "airgapped") {
    if (a.state === "REJECTED") return "X";
    if (IN_FLIGHT.has(a.state)) return "F";
  }
  return "-";
}

/** Versions as `1.3.0:L,1.4.0:F` (L loaded, P present, F in flight to the enclave, X rejected, - absent). */
export const selVersionKey: Record<EnvId, (s: S) => string> = byId((id) => (s) => {
  const list = s.snapshot.artefacts;
  let out = "";
  for (let i = 0; i < list.length; i++) out += (i ? "," : "") + list[i].version + ":" + presenceCode(list[i], id);
  return out;
});

export interface VersionEntry {
  version: string;
  presence: VersionPresence;
}

const PRESENCE: Record<string, VersionPresence> = { L: "loaded", P: "present", F: "inflight", X: "rejected", "-": "absent" };

export function parseVersionKey(key: string): VersionEntry[] {
  if (!key) return [];
  return key.split(",").map((part) => {
    const i = part.lastIndexOf(":");
    return { version: part.slice(0, i), presence: PRESENCE[part.slice(i + 1)] ?? "absent" };
  });
}

/**
 * Newest built artefact as `version|state|approvals|scanned|operator+operator`.
 * Drives the diode conveyor, the consoles, the bench and the artefact token.
 */
export const selImportKey = (s: S): string => {
  const list = s.snapshot.artefacts;
  if (list.length === 0) return "";
  const a = list[list.length - 1];
  let scanned = 0;
  for (let i = 0; i < a.history.length; i++) {
    const h = a.history[i];
    if (h.state === "QUARANTINE" && h.note.startsWith("ClamAV")) {
      scanned = 1;
      break;
    }
  }
  let ops = "";
  for (let i = 0; i < a.approvals.length; i++) ops += (i ? "+" : "") + a.approvals[i].operator;
  return `${a.version}|${a.state}|${a.approvals.length}|${scanned}|${ops}`;
};

export interface ImportInfo {
  version: string;
  state: ArtefactState | null;
  approvals: number;
  scanned: boolean;
  operators: string[];
}

export function parseImportKey(key: string): ImportInfo {
  if (!key) return { version: "", state: null, approvals: 0, scanned: false, operators: [] };
  const [version, state, approvals, scanned, ops] = key.split("|");
  return {
    version,
    state: (state as ArtefactState) || null,
    approvals: Number(approvals) || 0,
    scanned: scanned === "1",
    operators: ops ? ops.split("+") : [],
  };
}

export const selLedgerLen = (s: S): number => s.snapshot.ledger.length;
export const selLedgerOk = (s: S): boolean => s.ledgerStatus.ok;
export const selLedgerHead = (s: S): string => s.ledgerStatus.head;
export const selDecisions = (s: S): number => s.snapshot.decisions.length;
export const selPacketCount = (s: S): number => s.packets.length;
/** The newest packet (a stored reference) or null. */
export const selLastPacket = (s: S): Packet | null => (s.packets.length ? s.packets[s.packets.length - 1] : null);
export const selResetSeq = (s: S): number => s.resetSeq;

export const selStepId = (d: D): string | null => (d.stepIndex >= 0 ? (d.steps[d.stepIndex]?.id ?? null) : null);
export const selPlaying = (d: D): boolean => d.status === "playing" || d.status === "paused";
export const selFocus = (d: D) => d.focus;

export { IDS as ENV_IDS_ORDERED };
