import type { Engine } from "./index";
import type { JobInput, WhatIfReport, WhatIfSuggestion } from "./types";

interface Mutation {
  applies: (j: JobInput) => boolean;
  change: string;
  field: keyof JobInput;
  value: (j: JobInput, engine: Engine) => unknown;
}

const MUTATIONS: Mutation[] = [
  {
    applies: (j) => j.egress,
    change: "Drop the live external retrieval requirement (use the enclave's offline corpus instead)",
    field: "egress",
    value: () => false,
  },
  {
    applies: (j) => j.pii,
    change: "Pseudonymise the input so it no longer contains personal data",
    field: "pii",
    value: () => false,
  },
  {
    applies: (j) => j.releasability === "MJC-EYES-ONLY",
    change: "Releasability widened to MJC (requires originator consent)",
    field: "releasability",
    value: () => "MJC",
  },
  {
    applies: () => true,
    change: "Request the model version currently loaded where policy would send the job",
    field: "modelVersion",
    value: (j, engine) => {
      const env = j.classification === "SECRET" ? "airgapped" : j.classification === "RESTRICTED" ? "onprem" : "cloud";
      return engine.latestLoadedVersion(env) ?? j.modelVersion;
    },
  },
  {
    applies: (j) => j.classification === "ONYX",
    change: "Reclassify to SECRET (requires a classification authority decision; the router cannot do this)",
    field: "classification",
    value: () => "SECRET",
  },
];

/**
 * Dry-run evaluation plus single-change counterfactuals. Nothing here touches engine state.
 */
export function whatIf(engine: Engine, input: JobInput): WhatIfReport {
  const baseline = engine.evaluate(input, true);
  if (baseline.verdict.kind !== "REFUSE") return { baseline, suggestions: [] };
  const suggestions: WhatIfSuggestion[] = [];
  for (const m of MUTATIONS) {
    if (!m.applies(input)) continue;
    const value = m.value(input, engine);
    if (value === input[m.field]) continue;
    const mutated = { ...input, [m.field]: value } as JobInput;
    const outcome = engine.evaluate(mutated, true).verdict;
    if (outcome.kind !== "REFUSE") suggestions.push({ change: m.change, field: m.field, value, outcome });
  }
  return { baseline, suggestions };
}
