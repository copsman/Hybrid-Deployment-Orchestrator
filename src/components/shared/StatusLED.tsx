import { cn } from "@/lib/utils";

export type LedTone = "cyan" | "green" | "amber" | "red" | "violet" | "muted";

const COLOR: Record<LedTone, string> = {
  cyan: "bg-mjc-cyan shadow-[0_0_8px_var(--mjc-cyan)]",
  green: "bg-mjc-green shadow-[0_0_8px_var(--mjc-green)]",
  amber: "bg-mjc-amber shadow-[0_0_8px_var(--mjc-amber)]",
  red: "bg-mjc-red shadow-[0_0_8px_var(--mjc-red)]",
  violet: "bg-mjc-violet shadow-[0_0_8px_var(--mjc-violet)]",
  muted: "bg-muted-foreground/50",
};

export function StatusLED({ tone = "cyan", pulse = false, className }: { tone?: LedTone; pulse?: boolean; className?: string }) {
  return (
    <span className={cn("relative inline-flex size-2 shrink-0", className)}>
      {pulse && <span className={cn("absolute inset-0 rounded-full opacity-70 animate-pulse-ring", COLOR[tone])} />}
      <span className={cn("relative inline-flex size-2 rounded-full", COLOR[tone])} />
    </span>
  );
}
