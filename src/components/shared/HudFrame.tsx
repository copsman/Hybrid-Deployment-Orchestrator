import { cn } from "@/lib/utils";

/** A panel with the corner brackets and hairline border used across the control room. */
export function HudFrame({
  title,
  right,
  children,
  className,
  bodyClassName,
  tone = "default",
}: {
  title?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  tone?: "default" | "alert" | "active";
}) {
  return (
    <section
      className={cn(
        "relative flex min-h-0 flex-col rounded-md border border-border/80 bg-card/70 backdrop-blur-sm",
        tone === "alert" && "border-mjc-red/60 animate-alert",
        tone === "active" && "border-mjc-cyan/60 shadow-[0_0_24px_rgba(34,211,238,0.12)]",
        className,
      )}
    >
      <Corner className="left-0 top-0 border-l border-t" />
      <Corner className="right-0 top-0 border-r border-t" />
      <Corner className="bottom-0 left-0 border-b border-l" />
      <Corner className="bottom-0 right-0 border-b border-r" />
      {(title || right) && (
        <header className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-1.5">
          <div className="hud-label flex items-center gap-2 text-foreground/80">{title}</div>
          <div className="flex items-center gap-2">{right}</div>
        </header>
      )}
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}

function Corner({ className }: { className: string }) {
  return <span aria-hidden className={cn("pointer-events-none absolute size-2.5 border-mjc-cyan/70", className)} />;
}
