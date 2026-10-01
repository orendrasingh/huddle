let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean) {
  muted = m;
}
export function isMuted() {
  return muted;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.12) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime + start);
  g.gain.setValueAtTime(0, ctx.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur + 0.05);
}

const SOUNDS = {
  tap: () => tone(660, 0, 0.08, "triangle"),
  join: () => { tone(523, 0, 0.1, "triangle"); tone(784, 0.08, 0.14, "triangle"); },
  correct: () => { tone(523, 0, 0.12, "triangle"); tone(659, 0.1, 0.12, "triangle"); tone(1047, 0.2, 0.25, "triangle"); },
  wrong: () => { tone(220, 0, 0.18, "sawtooth", 0.06); tone(180, 0.15, 0.25, "sawtooth", 0.06); },
  tick: () => tone(1200, 0, 0.03, "square", 0.04),
  start: () => { [392, 523, 659, 784].forEach((f, i) => tone(f, i * 0.07, 0.15, "triangle")); },
  fanfare: () => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.2, "triangle")); },
};

export function play(name: keyof typeof SOUNDS) {
  if (muted || typeof window === "undefined") return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    SOUNDS[name]();
  } catch {
    /* audio unavailable */
  }
}

export function buzz(ms: number | number[] = 20) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
}
