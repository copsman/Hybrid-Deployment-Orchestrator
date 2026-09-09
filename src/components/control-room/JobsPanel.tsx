"use client";

import { Eye, Globe, UserRound, Timer } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClassificationBadge } from "@/components/shared/ClassificationBadge";
import { StatusLED } from "@/components/shared/StatusLED";
import { useOrchestrator } from "@/store/orchestrator";
import type { Job, JobStatus } from "@/engine";
import { cn } from "@/lib/utils";
import { SubmitJobForm } from "./SubmitJobForm";

const STATUS_TONE: Record<JobStatus, { led: "cyan" | "green" | "amber" | "red" | "muted"; text: string }> = {
  SUBMITTED: { led: "cyan", text: "text-foreground" },
  ROUTED: { led: "cyan", text: "text-foreground" },
  QUEUED: { led: "amber", text: "text-mjc-amber" },
  RUNNING: { led: "cyan", text: "text-mjc-cyan" },
  COMPLETED: { led: "green", text: "text-mjc-green" },
  REFUSED: { led: "red", text: "text-mjc-red" },
};

export function JobsPanel() {
  const jobs = useOrchestrator((s) => s.snapshot.jobs);
  const selected = useOrchestrator((s) => s.selectedJobId);
  const selectJob = useOrchestrator((s) => s.selectJob);
  const ordered = jobs.slice().reverse();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <SubmitJobForm />
      <div className="hud-label flex items-center justify-between border-y border-border/60 px-3 py-1.5">
        <span>Jobs · {jobs.length}</span>
        <span>
          {jobs.filter((j) => j.status === "REFUSED").length} refused · {jobs.filter((j) => j.status === "COMPLETED").length} completed
        </span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <table className="w-full text-left text-xs" data-testid="jobs-table">
          <thead className="sticky top-0 bg-card/95 backdrop-blur">
            <tr className="hud-label [&>th]:px-3 [&>th]:py-1.5 [&>th]:font-normal">
              <th>ID</th>
              <th>Class</th>
              <th>Title</th>
              <th>Attrs</th>
              <th>Status</th>
              <th>Env</th>
            </tr>
          </thead>
          <tbody>
            {ordered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  No jobs yet. Press PLAY SCENARIO, or route one above.
                </td>
              </tr>
            )}
            {ordered.map((j) => (
              <JobRow key={j.id} job={j} selected={selected === j.id} onSelect={() => selectJob(j.id)} />
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}

function JobRow({ job, selected, onSelect }: { job: Job; selected: boolean; onSelect: () => void }) {
  const tone = STATUS_TONE[job.status];
  return (
    <tr
      onClick={onSelect}
      className={cn("cursor-pointer border-b border-border/40 transition-colors hover:bg-secondary/50 [&>td]:px-3 [&>td]:py-2", selected && "bg-mjc-cyan/5")}
      data-testid={`job-row-${job.id}`}
      data-status={job.status}
      data-env={job.environment ?? ""}
    >
      <td className="font-mono text-[11px] text-foreground/90">{job.id}</td>
      <td>
        <ClassificationBadge level={job.classification} size="xs" />
      </td>
      <td className="max-w-[180px] truncate text-foreground/90" title={job.title}>
        {job.title}
      </td>
      <td>
        <div className="flex items-center gap-1 text-muted-foreground">
          {job.pii && <UserRound className="size-3 text-mjc-amber" aria-label="contains personal data" />}
          {job.egress && <Globe className="size-3 text-mjc-cyan" aria-label="needs live external retrieval" />}
          {job.releasability === "MJC-EYES-ONLY" && <Eye className="size-3 text-mjc-red" aria-label="eyes only" />}
          {job.latency === "batch" && <Timer className="size-3" aria-label="batch" />}
          <span className="font-mono text-[10px]">v{job.modelVersion}</span>
        </div>
      </td>
      <td>
        <span className={cn("inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.16em]", tone.text)}>
          <StatusLED tone={tone.led} pulse={job.status === "RUNNING"} />
          {job.status}
          {job.status === "QUEUED" && job.queuePosition ? ` #${job.queuePosition}` : ""}
        </span>
      </td>
      <td className="font-mono text-[10px] tracking-[0.16em] text-foreground/80">{job.environment ? job.environment.toUpperCase() : "—"}</td>
    </tr>
  );
}
