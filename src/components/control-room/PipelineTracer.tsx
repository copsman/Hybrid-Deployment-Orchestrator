"use client";

import { useMemo, useState } from "react";
import { ArrowRightToLine, Bug, Check, ShieldCheck, ShieldAlert, Users, X, Unplug, Package, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TracingBeam } from "@/components/aceternity/tracing-beam";
import { useOrchestrator } from "@/store/orchestrator";
import { useDirector } from "@/store/director";
import { short, compareSemver, type ArtefactState, type ArtefactVersion } from "@/engine";
import { cn } from "@/lib/utils";

const STAGES: { state: ArtefactState; label: string; where: string; detail: string }[] = [
  { state: "BUILT", label: "Build", where: "low side", detail: "weights produced, SHA-256 computed" },
  { state: "SIGNED", label: "Sign", where: "low side · HSM", detail: "Ed25519 over canonical manifest" },
  { state: "PUBLISHED", label: "Publish", where: "cloud · GHCR", detail: "cloud inference pool pulls + loads" },
  { state: "MIRRORED", label: "Mirror", where: "on-prem · Harbor", detail: "sync via inspection proxy" },
  { state: "STAGED", label: "Stage", where: "low-side outbox", detail: "bundle chunked for the diode" },
  { state: "IN_DIODE", label: "Diode", where: "one-way link", detail: "no return channel, no ACK" },
  { state: "QUARANTINE", label: "Quarantine", where: "high side", detail: "AV + file-type scan" },
  { state: "VERIFYING", label: "Approve", where: "two-person rule", detail: "two operators, separate roles" },
  { state: "IMPORTED", label: "Verify + import", where: "enclave · pinned key", detail: "signer, signature, digest, size, downgrade" },
  { state: "LOADED", label: "Load", where: "enclave · vLLM offline", detail: "enclave serves the new version" },
];

const ORDER = STAGES.map((s) => s.state);

function reached(a: ArtefactVersion, state: ArtefactState): boolean {
  if (a.state === "REJECTED") return ORDER.indexOf(state) <= ORDER.indexOf("VERIFYING");
  return ORDER.indexOf(a.state) >= ORDER.indexOf(state);
}

function nextVersion(versions: string[]): string {
  const latest = versions.slice().sort(compareSemver).at(-1) ?? "1.3.0";
  const [ma, mi] = latest.split(".").map(Number);
  return `${ma}.${mi + 1}.0`;
}

export function PipelineTracer() {
  const artefacts = useOrchestrator((s) => s.snapshot.artefacts);
  const selected = useOrchestrator((s) => s.selectedVersion);
  const selectVersion = useOrchestrator((s) => s.selectVersion);
  const pipeline = useOrchestrator((s) => s.pipeline);
  const diode = useOrchestrator((s) => s.diode);
  // Jury view: the tracer, transfer bar, approvals and verification lines stay; every manual control goes.
  const jury = useDirector((s) => s.jury);
  const a = artefacts.find((x) => x.version === selected) ?? artefacts.at(-1)!;
  const upcoming = useMemo(() => nextVersion(artefacts.map((x) => x.version)), [artefacts]);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [ops, setOps] = useState({ a: "OPS-WATCH-1", b: "SEC-OFFICER-2" });

  const progress = a.state === "REJECTED" ? ORDER.indexOf("VERIFYING") / (ORDER.length - 1) : ORDER.indexOf(a.state) / (ORDER.length - 1);
  const scanned = a.history.some((h) => h.state === "QUARANTINE" && h.note.startsWith("ClamAV"));
  const t = a.transfer;
  const transferPct = t ? (t.sentChunks / t.totalChunks) * 100 : 0;
  const canTamper = ["IN_DIODE", "QUARANTINE", "VERIFYING"].includes(a.state) && (t?.completedAt !== null || a.state === "IN_DIODE");

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="pipeline">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-1.5">
        <Package className="size-3 text-mjc-cyan" />
        <span className="hud-label">Artefact pipeline</span>
        <div className="ml-auto flex gap-1">
          {artefacts.map((x) => (
            <button
              key={x.version}
              type="button"
              onClick={() => selectVersion(x.version)}
              className={cn("rounded-sm border px-1.5 py-0.5 font-mono text-[10px]", a.version === x.version ? "border-mjc-cyan/60 text-mjc-cyan" : "border-border/60 text-muted-foreground hover:text-foreground")}
            >
              {x.version}
            </button>
          ))}
          {!jury && (
            <Button size="sm" variant="outline" className="h-6 gap-1 px-2 font-mono text-[9px] tracking-[0.14em]" onClick={() => pipeline.build(upcoming)} data-testid="build-next">
              + BUILD {upcoming}
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-3">
          <div className="rounded-md border border-border/70 bg-background/40 p-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px]">
              <span className="text-[12px] text-foreground">mjc/scribe-8b : {a.version}</span>
              <span className="text-muted-foreground">sha256 {short(a.manifest.manifest.digest, 10)}</span>
              <span className="text-muted-foreground">{(a.manifest.manifest.sizeBytes / 1024).toFixed(0)} KiB synthetic</span>
              <span className={cn("ml-auto rounded-sm border px-1.5 py-0.5 tracking-[0.16em]", a.state === "REJECTED" ? "border-mjc-red/60 text-mjc-red" : a.state === "LOADED" ? "border-mjc-green/60 text-mjc-green" : "border-mjc-amber/60 text-mjc-amber")}>{a.state}</span>
            </div>
            <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
              signer {a.manifest.publicKey ? short(a.manifest.publicKey, 10) : "(unsigned)"} · sig {a.manifest.signature ? short(a.manifest.signature, 8) : "—"}
            </div>
          </div>

          <TracingBeam progress={progress}>
            <ol className="space-y-1.5">
              {STAGES.map((s) => {
                const done = reached(a, s.state);
                const current = a.state === s.state || (a.state === "REJECTED" && s.state === "IMPORTED");
                const rejectedHere = a.state === "REJECTED" && s.state === "IMPORTED";
                const h = a.history.filter((x) => x.state === s.state).at(-1);
                return (
                  <li key={s.state} className={cn("relative rounded-sm border px-2.5 py-1.5", rejectedHere ? "border-mjc-red/60 bg-mjc-red/5" : current ? "border-mjc-cyan/60 bg-mjc-cyan/5" : done ? "border-border/70 bg-secondary/30" : "border-border/30 opacity-60")}>
                    <div className="flex items-center gap-2">
                      <span className={cn("grid size-4 place-items-center rounded-full border text-[9px]", rejectedHere ? "border-mjc-red text-mjc-red" : done ? "border-mjc-green text-mjc-green" : "border-border text-muted-foreground")}>
                        {rejectedHere ? <X className="size-2.5" /> : done ? <Check className="size-2.5" /> : null}
                      </span>
                      <span className="font-mono text-[11px] tracking-[0.14em] text-foreground">{s.label.toUpperCase()}</span>
                      <span className="hud-label">{s.where}</span>
                      <span className="ml-auto font-mono text-[9px] text-muted-foreground">{h ? h.at.slice(11, 19) : ""}</span>
                    </div>
                    <div className="mt-0.5 pl-6 text-[11px] text-muted-foreground">{h ? h.note : s.detail}</div>

                    {s.state === "IN_DIODE" && t && (
                      <div className="mt-2 pl-6">
                        <div className="flex items-center justify-between font-mono text-[10px]">
                          <span className="flex items-center gap-1 text-mjc-amber">
                            <ArrowRightToLine className="size-3" /> {t.id} · {t.sentChunks}/{t.totalChunks} chunks →
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Unplug className="size-3" /> return attempts blocked: {t.returnAttempts + (diode?.version === a.version ? 0 : 0)}
                          </span>
                        </div>
                        <Progress value={transferPct} className="mt-1 h-1.5 bg-secondary [&>div]:bg-mjc-amber" />
                        {!jury && (a.state === "STAGED" || a.state === "IN_DIODE") && (
                          <div className="mt-2 flex gap-2">
                            <Button size="sm" variant="outline" className="h-6 px-2 font-mono text-[9px] tracking-[0.14em]" onClick={() => pipeline.diodeStep(a.version, 4)}>
                              SEND 4 CHUNKS
                            </Button>
                            <Button size="sm" variant="outline" className="h-6 px-2 font-mono text-[9px] tracking-[0.14em] text-mjc-amber" onClick={() => pipeline.attemptReturn(a.version)}>
                              ATTEMPT RETURN PATH
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {s.state === "VERIFYING" && a.approvals.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-6">
                        <Users className="size-3 text-mjc-cyan" />
                        {a.approvals.map((ap) => (
                          <span key={ap.operator} className="rounded-sm border border-mjc-cyan/50 px-1.5 font-mono text-[9px] text-mjc-cyan">
                            {ap.operator} · {ap.at.slice(11, 19)}
                          </span>
                        ))}
                      </div>
                    )}

                    {s.state === "IMPORTED" && (a.state === "REJECTED" || done) && (
                      <div className="mt-1.5 pl-6">
                        {a.state === "REJECTED" ? (
                          <div className="flex items-start gap-2 text-[11px] text-mjc-red">
                            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" /> {a.rejectionReason}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-[11px] text-mjc-green">
                            <ShieldCheck className="size-3.5" /> pinned-key ✓ · signature ✓ · digest ✓ · size ✓ · downgrade ✓
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </TracingBeam>

          {!jury && (
            <div className="rounded-md border border-border/70 p-3" data-testid="pipeline-manual">
              <div className="hud-label mb-2">Manual controls · {a.version}</div>
              <div className="flex flex-wrap gap-2">
                <Ctl show={a.state === "SIGNED"} onClick={() => pipeline.publish(a.version)} icon={<Send className="size-3" />} label="PUBLISH TO CLOUD" />
                <Ctl show={a.state === "PUBLISHED"} onClick={() => pipeline.mirror(a.version)} icon={<Send className="size-3" />} label="MIRROR TO ON-PREM" />
                <Ctl show={a.state === "MIRRORED"} onClick={() => pipeline.stage(a.version)} icon={<ArrowRightToLine className="size-3" />} label="STAGE FOR DIODE" />
                <Ctl show={a.state === "QUARANTINE" && !scanned} onClick={() => pipeline.scan(a.version)} icon={<ShieldCheck className="size-3" />} label="RUN QUARANTINE SCAN" />
                <Ctl show={(a.state === "QUARANTINE" && scanned) || (a.state === "VERIFYING" && a.approvals.length < 2)} onClick={() => setApprovalOpen(true)} icon={<Users className="size-3" />} label="TWO-PERSON APPROVAL" testid="open-approval" />
                <Ctl show={a.state === "VERIFYING" && a.approvals.length >= 2} onClick={() => pipeline.verify(a.version)} icon={<ShieldCheck className="size-3" />} label="VERIFY + IMPORT" testid="verify-import" />
                <Ctl show={a.state === "IMPORTED"} onClick={() => pipeline.load(a.version)} icon={<Check className="size-3" />} label="LOAD IN ENCLAVE" />
                {canTamper && (
                  <>
                    <Ctl show tone="red" onClick={() => pipeline.tamper(a.version, "byte")} icon={<Bug className="size-3" />} label="TAMPER: FLIP A BYTE" testid="tamper-byte" />
                    <Ctl show tone="red" onClick={() => pipeline.tamper(a.version, "signer")} icon={<Bug className="size-3" />} label="TAMPER: WRONG SIGNER" />
                  </>
                )}
                {a.state === "LOADED" && <span className="text-[11px] text-muted-foreground">Version is live in every perimeter. Build the next one to run the pipeline again.</span>}
                {a.state === "REJECTED" && <span className="text-[11px] text-mjc-red">Rejected bundles never enter the enclave registry. Build a new version and transfer again.</span>}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <Dialog open={approvalOpen && !jury} onOpenChange={setApprovalOpen}>
        <DialogContent className="border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm tracking-[0.2em]">TWO-PERSON IMPORT APPROVAL</DialogTitle>
            <DialogDescription>
              Importing {a.version} into Enclave OBSIDIAN requires two operators with separate roles. Approvals are recorded in the ledger before verification runs.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {(["a", "b"] as const).map((k, i) => {
              const id = ops[k];
              const done = a.approvals.some((ap) => ap.operator === id);
              return (
                <div key={k} className="flex items-center gap-2">
                  <span className="hud-label w-20">{i === 0 ? "Operations" : "Security"}</span>
                  <Input value={id} onChange={(e) => setOps({ ...ops, [k]: e.target.value })} className="h-8 font-mono text-xs" disabled={done} />
                  <Button size="sm" className="h-8 font-mono text-[10px] tracking-[0.14em]" disabled={done || !id.trim()} onClick={() => pipeline.approve(a.version, id.trim())} data-testid={`approve-${k}`}>
                    {done ? "APPROVED" : "APPROVE"}
                  </Button>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setApprovalOpen(false)} className="font-mono text-[10px] tracking-[0.14em]">
              CLOSE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Ctl({ show, onClick, icon, label, tone, testid }: { show: boolean; onClick: () => void; icon: React.ReactNode; label: string; tone?: "red"; testid?: string }) {
  if (!show) return null;
  return (
    <Button size="sm" variant="outline" className={cn("h-7 gap-1.5 font-mono text-[10px] tracking-[0.14em]", tone === "red" && "border-mjc-red/50 text-mjc-red hover:bg-mjc-red/10")} onClick={onClick} data-testid={testid}>
      {icon} {label}
    </Button>
  );
}
