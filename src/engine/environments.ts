import type { EnvId, EnvironmentRuntime, EnvironmentSpec, StackComponent } from "./types";

const cloudStack: StackComponent[] = [
  { layer: "App", name: "Vercel", detail: "Next.js app, edge network, preview deployments", icon: "cloud" },
  { layer: "AI gateway", name: "Vercel AI Gateway", detail: "Unified model routing, usage metering", icon: "route" },
  { layer: "Model serving", name: "Managed GPU inference", detail: "vLLM on cloud GPUs, autoscaled", icon: "cpu" },
  { layer: "Database", name: "Supabase Cloud", detail: "Postgres, pgvector, Storage", icon: "database" },
  { layer: "Identity", name: "Supabase Auth", detail: "OIDC federation to MJC directory", icon: "key-round" },
  { layer: "Registry", name: "GHCR", detail: "Signed OCI images and model bundles", icon: "package" },
  { layer: "Secrets", name: "Vercel Env", detail: "Encrypted at rest, scoped per environment", icon: "lock" },
  { layer: "Observability", name: "Langfuse Cloud", detail: "Traces, evals, cost dashboards", icon: "activity" },
  { layer: "Updates", name: "CI/CD push", detail: "Git push triggers build and deploy", icon: "git-branch" },
  { layer: "Network", name: "External", detail: "Public internet, egress permitted", icon: "globe" },
];

const onpremStack: StackComponent[] = [
  { layer: "App", name: "Next.js standalone on k3s", detail: "Same image as cloud, self-hosted", icon: "server" },
  { layer: "AI gateway", name: "Self-hosted gateway", detail: "OpenAI-compatible proxy in-cluster", icon: "route" },
  { layer: "Model serving", name: "vLLM on 4x GPU nodes", detail: "Fixed capacity, tensor parallel", icon: "cpu" },
  { layer: "Database", name: "Self-hosted Supabase", detail: "Postgres, pgvector, GoTrue, PostgREST", icon: "database" },
  { layer: "Identity", name: "Keycloak", detail: "MJC directory, smart-card login", icon: "key-round" },
  { layer: "Registry", name: "Harbor mirror", detail: "Pull-through cache via proxy", icon: "package" },
  { layer: "Secrets", name: "Vault", detail: "HSM-backed, in-cluster", icon: "lock" },
  { layer: "Observability", name: "Langfuse + Prometheus", detail: "Self-hosted, Grafana dashboards", icon: "activity" },
  { layer: "Updates", name: "Scheduled proxy pull", detail: "Registry sync window, change-controlled", icon: "refresh-cw" },
  { layer: "Network", name: "Proxied", detail: "Outbound only through inspection proxy", icon: "shield" },
];

const airgappedStack: StackComponent[] = [
  { layer: "App", name: "Next.js standalone (imported)", detail: "Identical image, arrived via diode", icon: "server" },
  { layer: "AI gateway", name: "Self-hosted gateway (offline)", detail: "No external providers configured", icon: "route" },
  { layer: "Model serving", name: "vLLM offline", detail: "Weights from signed bundle, 2x GPU", icon: "cpu" },
  { layer: "Database", name: "Postgres + pgvector", detail: "Offline, local backups only", icon: "database" },
  { layer: "Identity", name: "Keycloak (offline)", detail: "Local realm, smart-card login", icon: "key-round" },
  { layer: "Registry", name: "Harbor (diode-fed)", detail: "Populated only by verified imports", icon: "package" },
  { layer: "Secrets", name: "Vault (offline)", detail: "Sealed, manual unseal ceremony", icon: "lock" },
  { layer: "Observability", name: "Langfuse (offline)", detail: "Local only, exported by hand", icon: "activity" },
  { layer: "Updates", name: "Diode import", detail: "Scheduled, two-person approval", icon: "arrow-right-to-line" },
  { layer: "Network", name: "None", detail: "No DNS, no egress, local NTP", icon: "shield-ban" },
];

export const ENVIRONMENTS: Record<EnvId, EnvironmentSpec> = {
  cloud: {
    id: "cloud",
    name: "Meridian Cloud Region North",
    codename: "CLOUD",
    kind: "cloud",
    description: "Elastic, metered, external. Cheapest place to run anything that is allowed to leave the perimeter.",
    slots: null,
    costPerMinute: 4.2,
    network: "EXTERNAL",
    egress: true,
    artefactChannel: "registry-pull",
    baseLatencyMs: 38,
    stack: cloudStack,
  },
  onprem: {
    id: "onprem",
    name: "Fort Meridian Datacentre",
    codename: "ON-PREM",
    kind: "onprem",
    description: "Fixed capacity inside the sovereign perimeter. Outbound traffic only through the inspection proxy.",
    slots: 4,
    costPerMinute: 6.8,
    network: "PROXIED",
    egress: true,
    artefactChannel: "mirror-sync",
    baseLatencyMs: 9,
    stack: onpremStack,
  },
  airgapped: {
    id: "airgapped",
    name: "Enclave OBSIDIAN",
    codename: "AIR-GAPPED",
    kind: "airgapped",
    description: "Accredited enclave. No outbound network of any kind. Artefacts arrive through the data diode and a manual import.",
    slots: 2,
    costPerMinute: 9.5,
    network: "NONE",
    egress: false,
    artefactChannel: "diode-import",
    baseLatencyMs: 4,
    stack: airgappedStack,
  },
};

export const ENV_ORDER: EnvId[] = ["cloud", "onprem", "airgapped"];

export function createRuntime(id: EnvId): EnvironmentRuntime {
  return {
    spec: ENVIRONMENTS[id],
    running: [],
    queue: [],
    completed: 0,
    spentCredits: 0,
    blockedEgress: 0,
  };
}

export function freeSlots(rt: EnvironmentRuntime): number | null {
  if (rt.spec.slots === null) return null;
  return Math.max(0, rt.spec.slots - rt.running.length);
}

/**
 * Network guard for the enclave. Any attempt to reach an external endpoint from an
 * air-gapped runtime throws and is counted, which the tests assert on.
 */
export class EgressBlockedError extends Error {
  constructor(public readonly env: EnvId, public readonly target: string) {
    super(`Egress blocked: ${env} has no outbound network (attempted ${target})`);
    this.name = "EgressBlockedError";
  }
}

export function attemptEgress(rt: EnvironmentRuntime, target: string): void {
  if (!rt.spec.egress) {
    rt.blockedEgress += 1;
    throw new EgressBlockedError(rt.spec.id, target);
  }
}
