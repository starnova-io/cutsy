/* Gentle WebAudio cues — no audio assets. The context is created on a
   user gesture (start of a session, a purchase) and reused. */

let AC: AudioContext | null = null;

export function audio(): AudioContext | null {
  try {
    AC = AC ?? new (window.AudioContext || (window as any).webkitAudioContext)();
    if (AC.state === "suspended") void AC.resume();
  } catch {
    /* audio unavailable — fine */
  }
  return AC;
}

export function chime(): void {
  const ctx = audio();
  if (!ctx) return;
  try {
    const t = ctx.currentTime + 0.04;
    ([[523.25, 0], [659.25, .13], [783.99, .26], [1046.5, .44]] as const).forEach(([f, dt]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0, t + dt);
      g.gain.linearRampToValueAtTime(.06, t + dt + .025);
      g.gain.exponentialRampToValueAtTime(.0001, t + dt + 1.1);
      o.connect(g); g.connect(ctx.destination);
      o.start(t + dt); o.stop(t + dt + 1.2);
    });
  } catch { /* noop */ }
}

export function plink(): void {
  const ctx = audio();
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(700, t);
    o.frequency.exponentialRampToValueAtTime(1120, t + .09);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(.05, t + .015);
    g.gain.exponentialRampToValueAtTime(.0001, t + .35);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + .4);
  } catch { /* noop */ }
}

/* soft rain loop for rainy-day sessions: filtered noise */
let rainNode: { src: AudioBufferSourceNode; g: GainNode } | null = null;

export function startRain(): void {
  const ctx = audio();
  if (!ctx || rainNode) return;
  try {
    const len = 2 * ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const filt = ctx.createBiquadFilter(); filt.type = "lowpass"; filt.frequency.value = 850; filt.Q.value = .6;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(filt); filt.connect(g); g.connect(ctx.destination);
    src.start();
    g.gain.linearRampToValueAtTime(.035, ctx.currentTime + 2);
    rainNode = { src, g };
  } catch { /* noop */ }
}

export function stopRain(): void {
  if (!rainNode || !AC) return;
  const n = rainNode; rainNode = null;
  try {
    n.g.gain.linearRampToValueAtTime(0, AC.currentTime + .8);
    setTimeout(() => { try { n.src.stop(); } catch { /* noop */ } }, 900);
  } catch { /* noop */ }
}
