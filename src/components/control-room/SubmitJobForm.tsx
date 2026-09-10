"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Braces, FlaskConical, Send, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CLASSIFICATIONS, RELEASABILITIES, LATENCIES, type Classification, type JobInput, type Latency, type Releasability } from "@/engine";
import { SCENARIO_JOBS } from "@/engine/scenario";
import { useOrchestrator } from "@/store/orchestrator";
import { ClassificationBadge } from "@/components/shared/ClassificationBadge";
import { cn } from "@/lib/utils";

const PRESETS = Object.entries(SCENARIO_JOBS) as [keyof typeof SCENARIO_JOBS, JobInput][];

export function SubmitJobForm() {
  const submit = useOrchestrator((s) => s.submit);
  const whatIf = useOrchestrator((s) => s.whatIf);
  const artefacts = useOrchestrator((s) => s.snapshot.artefacts);
  const [mode, setMode] = useState<"form" | "raw">("form");
  const [form, setForm] = useState<JobInput>({ ...SCENARIO_JOBS.A });
  const [raw, setRaw] = useState<string>(JSON.stringify({ title: "Ad-hoc tasking", classification: "SECRET", egress: true }, null, 2));

  const versionOptions = useMemo(() => Array.from(new Set([...artefacts.map((a) => a.version), form.modelVersion, "1.5.0"])).sort(), [artefacts, form.modelVersion]);

  const onSubmit = (input: unknown) => {
    const r = submit(input, mode === "raw" ? "raw-json" : "operator");
    if (!r.ok) {
      // The event log already says "<source>: submission rejected · …"; a different title here keeps
      // the two messages distinguishable on screen and by text locators.
      toast.error("Invalid submission", { description: r.errors.slice(0, 4).join("\n") });
      return;
    }
    const v = r.decision.verdict;
    if (v.kind === "REFUSE") toast.error(`${r.job.id} refused · ${v.ruleId}`, { description: v.reason });
    else if (v.kind === "QUEUE") toast.warning(`${r.job.id} queued at ${v.env.toUpperCase()} (#${v.position})`, { description: v.tieBreak });
    else toast.success(`${r.job.id} → ${v.env.toUpperCase()}`, { description: v.tieBreak });
  };

  const onRaw = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      toast.error("Not valid JSON", { description: e instanceof Error ? e.message : String(e) });
      useOrchestrator.getState().appendLog("error", `raw-json: parse error · ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    onSubmit(parsed);
  };

  const onWhatIf = () => {
    const report = whatIf(form);
    const b = report.baseline.verdict;
    if (b.kind === "REFUSE") toast.info("What-if: refused", { description: `${b.ruleId} · ${report.suggestions.length} counterfactual(s) in the WHAT-IF tab` });
    else toast.info(`What-if: would route to ${b.env.toUpperCase()}`, { description: b.tieBreak });
  };

  return (
    <div className="border-b border-border/60 p-3" data-testid="submit-form">
      <div className="mb-2 flex items-center justify-between">
        <span className="hud-label flex items-center gap-2">
          <Send className="size-3 text-mjc-cyan" /> Submit job
        </span>
        <div className="flex items-center gap-1 rounded-sm border border-border/70 p-0.5">
          <ModeBtn active={mode === "form"} onClick={() => setMode("form")} icon={<ListChecks className="size-3" />} label="FORM" />
          <ModeBtn active={mode === "raw"} onClick={() => setMode("raw")} icon={<Braces className="size-3" />} label="RAW JSON" />
        </div>
      </div>

      {mode === "form" ? (
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-12 flex items-center gap-2">
            <Select
              value=""
              onValueChange={(k) => {
                const preset = SCENARIO_JOBS[k as keyof typeof SCENARIO_JOBS];
                if (preset) setForm({ ...preset });
              }}
            >
              <SelectTrigger size="sm" className="h-7 w-[190px] font-mono text-[10px] tracking-[0.14em]" aria-label="Load a preset">
                <SelectValue placeholder="LOAD PRESET…" />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map(([k, p]) => (
                  <SelectItem key={k} value={k} className="text-xs">
                    <span className="mr-2 font-mono">JOB {k}</span>
                    <ClassificationBadge level={p.classification} size="xs" />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Job title" className="h-7 flex-1 text-xs" data-testid="job-title" />
          </div>

          <Field className="col-span-4" label="Classification">
            <Select value={form.classification} onValueChange={(v) => setForm({ ...form, classification: v as Classification })}>
              <SelectTrigger size="sm" className="h-7 w-full text-xs" data-testid="job-classification">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLASSIFICATIONS.map((c) => (
                  <SelectItem key={c} value={c} className="text-xs">
                    <ClassificationBadge level={c} size="xs" />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field className="col-span-4" label="Releasability">
            <Select value={form.releasability} onValueChange={(v) => setForm({ ...form, releasability: v as Releasability })}>
              <SelectTrigger size="sm" className="h-7 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELEASABILITIES.map((r) => (
                  <SelectItem key={r} value={r} className="text-xs font-mono">
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field className="col-span-2" label="Model">
            <Select value={form.modelVersion} onValueChange={(v) => setForm({ ...form, modelVersion: v })}>
              <SelectTrigger size="sm" className="h-7 w-full text-xs font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {versionOptions.map((v) => (
                  <SelectItem key={v} value={v} className="text-xs font-mono">
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field className="col-span-2" label="Latency">
            <Select value={form.latency} onValueChange={(v) => setForm({ ...form, latency: v as Latency })}>
              <SelectTrigger size="sm" className="h-7 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LATENCIES.map((l) => (
                  <SelectItem key={l} value={l} className="text-xs">
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="col-span-12 flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <Switch checked={form.pii} onCheckedChange={(v) => setForm({ ...form, pii: v })} data-testid="job-pii" />
                <span className="hud-label">Personal data</span>
              </label>
              <label className="flex items-center gap-2">
                <Switch checked={form.egress} onCheckedChange={(v) => setForm({ ...form, egress: v })} data-testid="job-egress" />
                <span className="hud-label">Live external retrieval</span>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-7 gap-1.5 font-mono text-[10px] tracking-[0.16em]" onClick={onWhatIf} data-testid="whatif">
                <FlaskConical className="size-3" /> WHAT-IF
              </Button>
              <Button size="sm" className="h-7 gap-1.5 bg-mjc-cyan font-mono text-[10px] tracking-[0.16em] text-primary-foreground hover:bg-mjc-cyan/90" onClick={() => onSubmit(form)} data-testid="route-job">
                <Send className="size-3" /> ROUTE JOB
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          <Textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={6} className="font-mono text-[11px]" spellCheck={false} data-testid="raw-json" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Anything goes in here. Malformed or unknown fields are rejected by the schema, never by a crash.</span>
            <Button size="sm" variant="outline" className="h-7 gap-1.5 font-mono text-[10px] tracking-[0.16em]" onClick={onRaw} data-testid="submit-raw">
              <Braces className="size-3" /> SUBMIT RAW
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("grid gap-1", className)}>
      <Label className="hud-label">{label}</Label>
      {children}
    </div>
  );
}

function ModeBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex items-center gap-1 rounded-[3px] px-2 py-0.5 font-mono text-[9px] tracking-[0.16em] transition-colors", active ? "bg-mjc-cyan/15 text-mjc-cyan" : "text-muted-foreground hover:text-foreground")}
    >
      {icon}
      {label}
    </button>
  );
}
