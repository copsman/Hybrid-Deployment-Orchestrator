"use client";

import { useDirector } from "@/store/director";
import { useOrchestrator } from "@/store/orchestrator";
import { sfx } from "@/lib/sfx";

/**
 * Wires the sound kit to the stores. Everything reacts to store changes, never to raw engine
 * events, so muting is instant and a muted run never replays a backlog. Zustand 5 hands the
 * previous state to subscribers, which is what every diff below uses.
 *
 * Why the ledger tick reads `snapshot.ledger.length`: the engine emits `ledger.appended` for
 * only three of its fifteen append sites; the snapshot sees all of them.
 */
export function bindSfx(): () => void {
  // hydrateDirectorPrefs() runs before this subscription exists: honour a restored preference.
  const d0 = useDirector.getState();
  if (d0.soundOn) {
    sfx.setEnabled(true);
    sfx.ambient(d0.status === "playing");
  }

  const offDirector = useDirector.subscribe((s, p) => {
    if (s.soundOn !== p.soundOn) {
      sfx.setEnabled(s.soundOn);
      sfx.ambient(s.soundOn && s.status === "playing");
    }
    if (!s.soundOn) return;
    if (s.status !== p.status) {
      sfx.ambient(s.status === "playing");
      if (s.status === "done") sfx.complete();
    }
    if (s.focus !== p.focus && !s.reducedMotion) sfx.whoosh();
    // Step 18: the director's own ledger verification.
    if (s.lastResult !== p.lastResult && s.lastResult?.ledger) sfx.chain(s.lastResult.ledger.ok);
  });

  const offOrchestrator = useOrchestrator.subscribe((s, p) => {
    if (!useDirector.getState().soundOn) return;

    if (s.packets !== p.packets && s.packets.length > p.packets.length) {
      const packet = s.packets[s.packets.length - 1];
      if (packet.to) sfx.route(packet.classification);
      else sfx.refuse();
    }

    if (s.diode !== p.diode && s.diode) {
      const sameTransfer = p.diode?.version === s.diode.version;
      if (s.diode.active && s.diode.sent !== (sameTransfer && p.diode ? p.diode.sent : -1)) sfx.chunk(s.diode.sent / s.diode.total);
      if (s.diode.bounces > (sameTransfer && p.diode ? p.diode.bounces : 0)) sfx.bounce();
    }

    // Manual tamper / restore in the LEDGER tab.
    if (s.ledgerStatus.ok !== p.ledgerStatus.ok) sfx.chain(s.ledgerStatus.ok);

    if (s.snapshot !== p.snapshot) {
      const added = s.snapshot.ledger.length - p.snapshot.ledger.length;
      if (added > 0) sfx.ledger(added); // negative on reset: silent
      for (const a of s.snapshot.artefacts) {
        const b = p.snapshot.artefacts.find((x) => x.version === a.version);
        if (!b) continue;
        if (b.state !== a.state) {
          if (a.state === "LOADED") sfx.verified();
          else if (a.state === "REJECTED") sfx.refuse();
        }
        // The scenario approves both operators in one step: stagger the two stamps.
        for (let n = b.approvals.length + 1; n <= a.approvals.length; n++) sfx.stamp(n, (n - b.approvals.length - 1) * 0.35);
      }
    }
  });

  return () => {
    offDirector();
    offOrchestrator();
    sfx.ambient(false);
  };
}
