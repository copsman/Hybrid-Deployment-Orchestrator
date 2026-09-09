import type { Classification } from "./types";

export interface ClassificationMeta {
  level: Classification;
  rank: number;
  label: string;
  marking: string;
  colour: "cyan" | "amber" | "red" | "violet";
  description: string;
  /** which environments are accredited for the level (informational; policy is the source of truth) */
  accredited: string;
}

export const CLASSIFICATION_META: Record<Classification, ClassificationMeta> = {
  OPEN: {
    level: "OPEN",
    rank: 0,
    label: "Open",
    marking: "MJC OPEN",
    colour: "cyan",
    description: "Publicly releasable material. Public affairs, recruitment, weather, open reference data.",
    accredited: "Cloud, On-prem",
  },
  RESTRICTED: {
    level: "RESTRICTED",
    rank: 1,
    label: "Restricted",
    marking: "MJC RESTRICTED",
    colour: "amber",
    description: "Internal operational data. Logistics, maintenance, personnel records. Sovereign perimeter only.",
    accredited: "On-prem",
  },
  SECRET: {
    level: "SECRET",
    rank: 2,
    label: "Secret",
    marking: "MJC SECRET",
    colour: "red",
    description: "Mission planning and intelligence fusion. Accredited enclave only, no external network.",
    accredited: "Enclave OBSIDIAN",
  },
  ONYX: {
    level: "ONYX",
    rank: 3,
    label: "Onyx",
    marking: "MJC ONYX // COMPARTMENTED",
    colour: "violet",
    description: "Compartmented material. No environment in this deployment is accredited for ONYX.",
    accredited: "None",
  },
};

export function compareClassification(a: Classification, b: Classification): number {
  return CLASSIFICATION_META[a].rank - CLASSIFICATION_META[b].rank;
}
