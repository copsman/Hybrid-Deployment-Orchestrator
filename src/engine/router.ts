import { ENV_ORDER } from "./environments";
import type { Candidate, EnvId, Verdict } from "./types";

/**
 * Selection among allowed candidates:
 *   1. environments with free capacity (or elastic) before environments that would queue,
 *   2. lowest simulated cost,
 *   3. most free slots (elastic counts as unlimited),
 *   4. stable order cloud → onprem → airgapped.
 * The tie-break text is logged with the decision.
 */
export function select(candidates: Candidate[], queueLengths: Record<EnvId, number>): Verdict | null {
  const allowed = candidates.filter((c) => c.allowed);
  if (!allowed.length) return null;

  const hasRoom = (c: Candidate) => c.freeSlots === null || c.freeSlots > 0;
  const slotsValue = (c: Candidate) => (c.freeSlots === null ? Number.POSITIVE_INFINITY : c.freeSlots);

  const ranked = allowed.slice().sort((a, b) => {
    const roomA = hasRoom(a) ? 0 : 1;
    const roomB = hasRoom(b) ? 0 : 1;
    if (roomA !== roomB) return roomA - roomB;
    if (a.cost !== b.cost) return a.cost - b.cost;
    if (slotsValue(a) !== slotsValue(b)) return slotsValue(b) - slotsValue(a);
    return ENV_ORDER.indexOf(a.env) - ENV_ORDER.indexOf(b.env);
  });

  const winner = ranked[0];
  const others = ranked.slice(1);
  let tieBreak: string;
  if (allowed.length === 1) {
    tieBreak = `only permitted environment`;
  } else if (!hasRoom(winner)) {
    tieBreak = `all permitted environments at capacity; queued at lowest cost`;
  } else if (others.some((o) => !hasRoom(o))) {
    tieBreak = `free capacity (${others.filter((o) => !hasRoom(o)).map((o) => o.env).join(", ")} at capacity)`;
  } else if (others.every((o) => o.cost > winner.cost)) {
    tieBreak = `lowest cost (${winner.cost} vs ${others.map((o) => `${o.env} ${o.cost}`).join(", ")} credits)`;
  } else {
    tieBreak = `most free capacity at equal cost`;
  }

  if (!hasRoom(winner)) {
    return { kind: "QUEUE", env: winner.env, position: queueLengths[winner.env] + 1, tieBreak };
  }
  return { kind: "ROUTE", env: winner.env, tieBreak };
}
