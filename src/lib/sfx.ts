/** Tiny synthesised sound effects. No assets, off by default, never throws. */
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, duration: number, type: OscillatorType = "sine", gain = 0.05, slideTo?: number) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + duration);
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + duration);
}

export const sfx = {
  route: () => {
    tone(660, 0.12, "sine", 0.05, 990);
    setTimeout(() => tone(990, 0.16, "sine", 0.04), 90);
  },
  refuse: () => {
    tone(220, 0.25, "square", 0.04, 110);
    setTimeout(() => tone(180, 0.3, "square", 0.035, 90), 120);
  },
  chunk: () => tone(1400, 0.04, "triangle", 0.02),
  bounce: () => tone(300, 0.18, "sawtooth", 0.03, 150),
  verified: () => {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, "sine", 0.04), i * 90));
  },
  tick: () => tone(880, 0.03, "square", 0.015),
};
