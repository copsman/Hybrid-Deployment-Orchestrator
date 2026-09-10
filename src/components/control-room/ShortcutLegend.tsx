"use client";

import { Fragment } from "react";
import { Keyboard } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDirector } from "@/store/director";

const ROWS: { keys: string[]; action: string }[] = [
  { keys: ["SPACE"], action: "play · pause · resume" },
  { keys: ["N", "→"], action: "next step (during the diode transfer the remaining chunks are drained at once)" },
  { keys: ["←"], action: "re-centre the camera on the current step" },
  { keys: ["1", "2", "3", "4", "5", "6"], action: "overview · router · cloud · on-prem · diode · enclave" },
  { keys: ["+", "−"], action: "faster · slower (0.5× 1× 2× 4×)" },
  { keys: ["SHIFT", "R"], action: "reset the sandbox (same seed, identical second run)" },
  { keys: ["S"], action: "sound on · off" },
  { keys: ["M"], action: "2D map · 3D scene" },
  { keys: ["F"], action: "fullscreen" },
  { keys: ["J"], action: "jury view (hides the manual controls)" },
  { keys: ["?"], action: "this legend · ESC closes" },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-flex min-w-6 items-center justify-center rounded-sm border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] not-italic tracking-[0.12em] text-foreground">{children}</kbd>;
}

/** The presenter-keys legend ("?"). Radix owns Escape and the focus trap while it is open. */
export function ShortcutLegend() {
  const open = useDirector((s) => s.legendOpen);
  const setOpen = useDirector((s) => s.setLegendOpen);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="border-border bg-card sm:max-w-md" data-testid="shortcut-legend">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-sm tracking-[0.2em]">
            <Keyboard className="size-4 text-mjc-cyan" /> PRESENTER KEYS
          </DialogTitle>
          <DialogDescription>Keys are ignored while typing in a field and while the opener is on screen.</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-xs">
          {ROWS.map((row) => (
            <Fragment key={row.action}>
              <dt className="flex items-center gap-1">
                {row.keys.map((k, i) => (
                  <Fragment key={k}>
                    {i > 0 && <span className="text-[10px] text-muted-foreground">{row.keys[0] === "SHIFT" ? "+" : "/"}</span>}
                    <Kbd>{k}</Kbd>
                  </Fragment>
                ))}
              </dt>
              <dd className="text-muted-foreground">{row.action}</dd>
            </Fragment>
          ))}
        </dl>
        <div className="hud-label border-t border-border/60 pt-3">
          URL switches · ?intro=0 skips the opener · ?speed=4 runs the director faster
        </div>
      </DialogContent>
    </Dialog>
  );
}
