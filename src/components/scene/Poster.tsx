export function Poster({ label = "INITIALISING SCENE" }: { label?: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-grid">
      <div className="text-center">
        <div className="font-mono text-[12px] tracking-[0.35em] text-mjc-cyan text-glow">MERIDIAN // VANTAGE</div>
        <div className="hud-label mt-2">
          {label}
          <span className="animate-blink">_</span>
        </div>
      </div>
    </div>
  );
}
