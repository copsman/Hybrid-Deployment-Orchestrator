/**
 * Every literal string and text template rendered as 3D text.
 *
 * Kept in one pure module so `tests/scene/labels.test.ts` can prove that nothing the
 * scene ever draws falls outside SCENE_GLYPHS (a glyph the local font lacks would make
 * troika fetch a fallback font from a CDN). Site names, stack names, job ids, rule ids,
 * operator names and versions come from the engine; the test covers those too.
 */
import type { Classification, EnvId, EnvironmentSpec, NetworkPosture } from "@/engine";
import { NET_LABEL } from "@/lib/palette";
import type { VersionEntry } from "./selectors";

export const LAYER_ORDER = ["App", "AI gateway", "Model serving", "Database", "Identity", "Registry", "Secrets", "Observability", "Updates", "Network"] as const;

export const LAYER_ABBR: Record<(typeof LAYER_ORDER)[number], string> = {
  App: "APP",
  "AI gateway": "GATEWAY",
  "Model serving": "SERVING",
  Database: "DB",
  Identity: "IDENTITY",
  Registry: "REGISTRY",
  Secrets: "SECRETS",
  Observability: "OBSERVE",
  Updates: "UPDATES",
  Network: "NETWORK",
};

export function layerAbbr(layer: string): string {
  return (LAYER_ABBR as Record<string, string>)[layer] ?? layer.toUpperCase();
}

export const ZONE_INDEX: Record<EnvId, string> = { cloud: "01", onprem: "02", airgapped: "03" };
export const ZONE_WORD: Record<EnvId, string> = { cloud: "CLOUD", onprem: "SOVEREIGN", airgapped: "ENCLAVE" };
export const TRUST_MARK: Record<EnvId, string> = {
  cloud: "TRUST · EXTERNAL TENANCY",
  onprem: "TRUST · MJC-CONTROLLED",
  airgapped: "TRUST · ACCREDITED",
};

export const LABELS = {
  stripTitle: "POLICY PLANE · SINGLE ENTRY POINT · DENY BY DEFAULT",
  hub: "POLICY ROUTER",
  bench: "BUILD · SIGN · LOW SIDE",
  ledger: "LEDGER",
  chainIntact: "CHAIN INTACT",
  chainBroken: "CHAIN BROKEN",
  diode: "DATA DIODE",
  diodeIdle: "ONE-WAY · NO RETURN CHANNEL",
  outbox: "OUTBOX · LOW SIDE",
  quarantine: "QUARANTINE · HIGH SIDE",
  proxy: "INSPECTION PROXY",
  elastic: "ELASTIC",
  online: "ONLINE",
  approved: "APPROVED",
  awaiting: "AWAITING",
  standby: "STANDBY",
  noVersion: "SCRIBE —",
  pending: "PENDING",
  rejected: "REJECTED",
  returnBlocked: "RETURN PATH BLOCKED",
} as const;

export function zoneBanner(id: EnvId, network: NetworkPosture): string {
  return `PERIMETER ${ZONE_INDEX[id]}\n${ZONE_WORD[id]} · ${NET_LABEL[network]}`;
}

export function hubSubtitle(policyVersion: string, decisions: number): string {
  return `POLICY ${policyVersion} · DENY BY DEFAULT · ${decisions} ${decisions === 1 ? "DECISION" : "DECISIONS"}`;
}

export function siteStatus(running: number, queued: number): string {
  if (running > 0) return `BUSY ${running}`;
  if (queued > 0) return `QUEUE ${queued}`;
  return LABELS.online;
}

export function siteSubtitle(spec: EnvironmentSpec, running: number, queued: number): string {
  const capacity = spec.slots === null ? LABELS.elastic : `${spec.slots} GPU`;
  return `${spec.name}\n${capacity} · ${NET_LABEL[spec.network]} · ${siteStatus(running, queued)}`;
}

export interface PlaqueText {
  loaded: string;
  extra: string | null;
  extraTone: "amber" | "red" | null;
}

/** Plaque lines from the parsed version key: loaded versions in green, one pending/rejected line beneath. */
export function plaqueText(entries: VersionEntry[]): PlaqueText {
  const loaded = entries.filter((e) => e.presence === "loaded").map((e) => e.version);
  const rejected = entries.find((e) => e.presence === "rejected");
  const pending = entries.find((e) => e.presence === "present" || e.presence === "inflight");
  return {
    loaded: loaded.length ? `SCRIBE ${loaded.join(" · ")}` : LABELS.noVersion,
    extra: rejected ? `${rejected.version} ${LABELS.rejected}` : pending ? `${pending.version} ${LABELS.pending}` : null,
    extraTone: rejected ? "red" : pending ? "amber" : null,
  };
}

export function queueLabel(n: number): string {
  return `QUEUE ${n}`;
}

export function queueOverflow(hidden: number): string {
  return `+${hidden}`;
}

export function packetTag(jobId: string, classification: Classification): string {
  return `${jobId} · ${classification}`;
}

export function routedVerdict(jobId: string, to: EnvId, position: number | null): string {
  const base = `${jobId} → ${to.toUpperCase()}`;
  return position === null ? base : `${base} · QUEUE #${position}`;
}

export function refusedVerdict(ruleId: string | null): string {
  return `REFUSED · ${ruleId ?? "DENY BY DEFAULT"}`;
}

export function ledgerHeadline(length: number, head: string, ok: boolean): string {
  return `${LABELS.ledger} · ${length} ${length === 1 ? "ENTRY" : "ENTRIES"} · ${head.slice(0, 8)}\n${ok ? LABELS.chainIntact : LABELS.chainBroken}`;
}

export function diodeCounter(diode: { sent: number; total: number; bounces: number; active: boolean } | null): string {
  if (!diode) return LABELS.diodeIdle;
  if (!diode.active) return `TRANSFER COMPLETE · ${diode.total} CHUNKS`;
  return `${diode.sent}/${diode.total} CHUNKS · ${diode.bounces} RETURN ${diode.bounces === 1 ? "ATTEMPT" : "ATTEMPTS"} BLOCKED`;
}

export type ConsoleStatus = "approved" | "awaiting" | "standby";

export function consoleLabel(operator: string | undefined, index: number, status: ConsoleStatus): string {
  const who = operator ?? `OPERATOR ${index + 1}`;
  return `${who}\n${status === "approved" ? LABELS.approved : status === "awaiting" ? LABELS.awaiting : LABELS.standby}`;
}

export function bundleTag(version: string): string {
  return `SCRIBE ${version} · SIGNED`;
}

export function bundleRejected(version: string): string {
  return `SCRIBE ${version} · ${LABELS.rejected}`;
}
