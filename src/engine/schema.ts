import * as z from "zod";
import { CLASSIFICATIONS, ENV_IDS, LATENCIES, RELEASABILITIES } from "./types";
import type { JobInput, PolicyRule } from "./types";

const semver = /^\d+\.\d+\.\d+$/;

export const JobInputSchema = z.strictObject({
  id: z.string().min(1).max(64).optional(),
  title: z.string().trim().min(1, { error: "title is required" }).max(120, { error: "title must be 120 characters or fewer" }),
  summary: z.string().trim().max(600, { error: "summary must be 600 characters or fewer" }).default(""),
  classification: z.enum(CLASSIFICATIONS, { error: `classification must be one of ${CLASSIFICATIONS.join(", ")}` }),
  pii: z.boolean({ error: "pii must be true or false" }).default(false),
  egress: z.boolean({ error: "egress must be true or false" }).default(false),
  releasability: z.enum(RELEASABILITIES, { error: `releasability must be one of ${RELEASABILITIES.join(", ")}` }).default("MJC"),
  modelVersion: z
    .string()
    .regex(semver, { error: "modelVersion must look like 1.4.0" })
    .default("1.3.0"),
  latency: z.enum(LATENCIES, { error: "latency must be interactive or batch" }).default("interactive"),
});

export type ParsedJobInput = z.infer<typeof JobInputSchema>;

export type ParseResult = { ok: true; value: JobInput } | { ok: false; errors: string[] };

/** Validates untrusted input. Never throws. */
export function parseJobInput(raw: unknown): ParseResult {
  const result = JobInputSchema.safeParse(raw);
  if (result.success) return { ok: true, value: result.data as JobInput };
  const errors = result.error.issues.map((i) => {
    const path = i.path.length ? i.path.map(String).join(".") : "(root)";
    return `${path}: ${i.message}`;
  });
  return { ok: false, errors };
}

const EnvIdSchema = z.enum(ENV_IDS);

const RuleConditionSchema = z.strictObject({
  classification: z.union([z.enum(CLASSIFICATIONS), z.array(z.enum(CLASSIFICATIONS)).min(1)]).optional(),
  pii: z.boolean().optional(),
  egress: z.boolean().optional(),
  releasability: z.union([z.enum(RELEASABILITIES), z.array(z.enum(RELEASABILITIES)).min(1)]).optional(),
  latency: z.enum(LATENCIES).optional(),
});

export const PolicyRuleSchema = z
  .strictObject({
    id: z.string().regex(/^POL-\d{2}$/),
    title: z.string().min(1),
    when: RuleConditionSchema,
    effect: z.enum(["REFUSE", "RESTRICT_TO", "EXCLUDE"]),
    environments: z.array(EnvIdSchema).min(1).optional(),
    justification: z.string().min(1),
  })
  .refine((r) => (r.effect === "REFUSE" ? r.environments === undefined : r.environments !== undefined), {
    error: "RESTRICT_TO and EXCLUDE need environments; REFUSE must not have them",
  });

export const PolicyFileSchema = z.strictObject({
  policyId: z.string().min(1),
  version: z.string().min(1),
  authority: z.string().min(1),
  defaultEffect: z.literal("DENY"),
  rules: z.array(PolicyRuleSchema).min(1),
});

export type PolicyFile = z.infer<typeof PolicyFileSchema>;

export function parsePolicyFile(raw: unknown): PolicyFile {
  const result = PolicyFileSchema.safeParse(raw);
  if (!result.success) {
    throw new Error("Invalid policy file: " + z.prettifyError(result.error));
  }
  const ids = new Set<string>();
  for (const rule of result.data.rules) {
    if (ids.has(rule.id)) throw new Error(`Invalid policy file: duplicate rule id ${rule.id}`);
    ids.add(rule.id);
  }
  return result.data as PolicyFile & { rules: PolicyRule[] };
}
