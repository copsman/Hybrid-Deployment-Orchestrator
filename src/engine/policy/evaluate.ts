import rulesJson from "./rules.json";
import { parsePolicyFile } from "../schema";
import { ENV_ORDER } from "../environments";
import type { Candidate, EnvId, JobInput, PolicyRule, RuleCondition, RuleTrace } from "../types";

export const POLICY = parsePolicyFile(rulesJson);
export const RULES: PolicyRule[] = POLICY.rules as PolicyRule[];

export interface EnvFacts {
  env: EnvId;
  hasVersion: boolean;
  versionInFlight: boolean;
  egress: boolean;
  freeSlots: number | null;
  costPerMinute: number;
}

export interface PolicyOutcome {
  trace: RuleTrace[];
  candidates: Candidate[];
  refusal: { reason: string; ruleId: string } | null;
}

function matchesValue<T>(cond: T | T[] | undefined, actual: T): boolean {
  if (cond === undefined) return true;
  return Array.isArray(cond) ? cond.includes(actual) : cond === actual;
}

export function ruleMatches(when: RuleCondition, job: JobInput): boolean {
  return (
    matchesValue(when.classification, job.classification) &&
    matchesValue(when.pii, job.pii) &&
    matchesValue(when.egress, job.egress) &&
    matchesValue(when.releasability, job.releasability) &&
    matchesValue(when.latency, job.latency)
  );
}

export function estimateMinutes(job: JobInput): number {
  return job.latency === "interactive" ? 1.5 : 6;
}

/**
 * Deny by default. A job is only routable if at least one RESTRICT_TO rule grants a set of
 * environments; EXCLUDE rules subtract from that set; any matching REFUSE rule ends evaluation.
 * Capability checks (version present, egress available) run after policy and are traced with
 * CAP-* ids so the decision record shows exactly why each environment fell out.
 */
export function evaluatePolicy(job: JobInput, facts: Record<EnvId, EnvFacts>): PolicyOutcome {
  const trace: RuleTrace[] = [];
  const reasons: Record<EnvId, string[]> = { cloud: [], onprem: [], airgapped: [] };
  let grant: Set<EnvId> | null = null;
  const excluded = new Set<EnvId>();
  let refusal: PolicyOutcome["refusal"] = null;

  for (const rule of RULES) {
    if (refusal) {
      trace.push({ ruleId: rule.id, title: rule.title, matched: false, effect: "NOOP", note: "not evaluated: an earlier rule refused the job" });
      continue;
    }
    const matched = ruleMatches(rule.when, job);
    if (!matched) {
      trace.push({ ruleId: rule.id, title: rule.title, matched: false, effect: "NOOP", note: "condition not met" });
      continue;
    }
    if (rule.effect === "REFUSE") {
      refusal = { reason: rule.justification, ruleId: rule.id };
      trace.push({ ruleId: rule.id, title: rule.title, matched: true, effect: "REFUSE", note: rule.justification });
      for (const env of ENV_ORDER) reasons[env].push(`${rule.id}: refused`);
      continue;
    }
    const envs = rule.environments ?? [];
    if (rule.effect === "RESTRICT_TO") {
      const set = new Set<EnvId>(envs);
      grant = intersect(grant, set);
      for (const env of ENV_ORDER) {
        if (!set.has(env)) reasons[env].push(`${rule.id}: not in permitted set [${envs.join(", ")}]`);
      }
      trace.push({ ruleId: rule.id, title: rule.title, matched: true, effect: "RESTRICT_TO", environments: envs, note: rule.justification });
    } else {
      for (const env of envs) {
        excluded.add(env);
        reasons[env].push(`${rule.id}: excluded`);
      }
      trace.push({ ruleId: rule.id, title: rule.title, matched: true, effect: "EXCLUDE", environments: envs, note: rule.justification });
    }
  }

  if (!refusal && grant === null) {
    refusal = { reason: "No policy rule grants execution for this request. The default effect is DENY.", ruleId: "POL-DEFAULT" };
    trace.push({ ruleId: "POL-DEFAULT", title: "Default effect", matched: true, effect: "REFUSE", note: refusal.reason });
    for (const env of ENV_ORDER) reasons[env].push("POL-DEFAULT: no grant");
  }

  // Capability checks, traced like rules.
  const capVersion: RuleTrace = { ruleId: "CAP-VERSION", title: `Model version ${job.modelVersion} present`, matched: false, effect: "EXCLUDE", environments: [], note: "" };
  const capEgress: RuleTrace = { ruleId: "CAP-EGRESS", title: "External network available", matched: false, effect: "EXCLUDE", environments: [], note: "" };

  const candidates: Candidate[] = ENV_ORDER.map((env) => {
    const f = facts[env];
    let allowed = !refusal && grant !== null && grant.has(env) && !excluded.has(env);
    if (!f.hasVersion) {
      if (allowed) {
        capVersion.matched = true;
        capVersion.environments!.push(env);
      }
      reasons[env].push(
        f.versionInFlight
          ? `CAP-VERSION: ${job.modelVersion} not yet imported (diode transfer pending)`
          : `CAP-VERSION: ${job.modelVersion} not deployed`,
      );
      allowed = false;
    }
    if (job.egress && !f.egress) {
      if (allowed) {
        capEgress.matched = true;
        capEgress.environments!.push(env);
      }
      reasons[env].push("CAP-EGRESS: no outbound network");
      allowed = false;
    }
    return {
      env,
      allowed,
      reasons: reasons[env],
      cost: round2(f.costPerMinute * estimateMinutes(job)),
      freeSlots: f.freeSlots,
      hasVersion: f.hasVersion,
    };
  });

  capVersion.note = capVersion.matched
    ? `excluded ${capVersion.environments!.join(", ")}: version ${job.modelVersion} not present`
    : "all permitted environments hold the requested version";
  capEgress.note = capEgress.matched
    ? `excluded ${capEgress.environments!.join(", ")}: no outbound network`
    : job.egress
      ? "all permitted environments can reach external sources"
      : "job does not require external retrieval";
  if (!capVersion.matched) capVersion.effect = "NOOP";
  if (!capEgress.matched) capEgress.effect = "NOOP";
  trace.push(capVersion, capEgress);

  if (!refusal && candidates.every((c) => !c.allowed)) {
    // Policy granted something but capability/exclusion removed every option.
    const granted = candidates.filter((c) => grant!.has(c.env));
    const versionBlocked = granted.filter((c) => !c.hasVersion && !excluded.has(c.env));
    if (versionBlocked.length) {
      const inFlight = versionBlocked.some((c) => facts[c.env].versionInFlight);
      refusal = {
        ruleId: "CAP-VERSION",
        reason: `Model ${job.modelVersion} is not deployed in ${versionBlocked.map((c) => c.env).join(", ")}${inFlight ? " yet: diode transfer pending manual import" : ""}. Resubmit once the version is imported.`,
      };
    } else {
      const last = granted.flatMap((c) => c.reasons.filter((r) => !r.startsWith("POL-DEFAULT")));
      refusal = {
        ruleId: lastRuleId(last) ?? "POL-DEFAULT",
        reason: `Every environment permitted by policy was excluded: ${granted.map((c) => `${c.env} (${c.reasons[c.reasons.length - 1]})`).join("; ")}.`,
      };
    }
  }

  return { trace, candidates, refusal };
}

function intersect(current: Set<EnvId> | null, next: Set<EnvId>): Set<EnvId> {
  if (current === null) return next;
  return new Set<EnvId>([...current].filter((e) => next.has(e)));
}

function lastRuleId(reasons: string[]): string | null {
  if (!reasons.length) return null;
  const m = /^(POL-\d{2}|CAP-[A-Z]+)/.exec(reasons[reasons.length - 1]);
  return m ? m[1] : null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
