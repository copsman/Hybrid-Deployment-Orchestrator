/** Deterministic simulation clock. The demo and tests never read the wall clock. */
export interface Clock {
  now(): Date;
  iso(): string;
  advance(ms: number): void;
}

export function createClock(startIso = "2031-03-14T08:00:00.000Z"): Clock {
  let t = new Date(startIso).getTime();
  return {
    now: () => new Date(t),
    iso: () => new Date(t).toISOString(),
    advance: (ms: number) => {
      t += Math.max(0, Math.floor(ms));
    },
  };
}
