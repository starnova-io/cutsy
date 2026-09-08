/* The island's soundscape — every sound is synthesized in WebAudio, no
   audio assets. Continuous beds (waves, wind, rain, crickets) crossfade
   with the season, the time of day and the weather; one-shot voices
   (bird phrases, a gull, thunder, drips on the tent, an owl) fire on
   randomized timers. Storm days also flash the sky before the rumble. */
import { audio } from "./audio";
import { curPhase, curSeason, curWeather, isStorm } from "./weather";
import { getState } from "./store";

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

/* ---- noise buffers (built once per context) ---- */
let pinkBuf: AudioBuffer | null = null;
let brownBuf: AudioBuffer | null = null;
let whiteBuf: AudioBuffer | null = null;

function noiseBufs(ctx: AudioContext): void {
  if (pinkBuf) return;
  const len = 4 * ctx.sampleRate;
  const mk = () => ctx.createBuffer(1, len, ctx.sampleRate);
  whiteBuf = mk(); pinkBuf = mk(); brownBuf = mk();
  const w = whiteBuf.getChannelData(0), p = pinkBuf.getChannelData(0), br = brownBuf.getChannelData(0);
  /* pink via Paul Kellet's filter; brown by leaky integration */
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const x = Math.random() * 2 - 1;
    w[i] = x;
    b0 = .997 * b0 + .0297 * x;
    b1 = .985 * b1 + .0425 * x;
    b2 = .95 * b2 + .0613 * x;
    p[i] = (b0 + b1 + b2 + x * .05) * 2.1;
    last = (last + x * .02) / 1.02;
    br[i] = last * 12;
  }
}

const noiseSrc = (ctx: AudioContext, buf: AudioBuffer): AudioBufferSourceNode => {
  const s = ctx.createBufferSource();
  s.buffer = buf; s.loop = true;
  s.start(0, Math.random() * buf.duration);
  return s;
};

const pan = (ctx: AudioContext, v: number): AudioNode | null => {
  if (typeof ctx.createStereoPanner !== "function") return null;
  const p = ctx.createStereoPanner();
  p.pan.value = v;
  return p;
};

/* ---- continuous beds ---- */
interface Bed { g: GainNode }
interface Beds {
  waves: Bed; foam: Bed; wind: Bed; whistle: Bed;
  rain: Bed; patter: Bed; crickets: Bed; fire: Bed;
  whistleFilt: BiquadFilterNode;
}

let master: GainNode | null = null;
let beds: Beds | null = null;
let running = false;
let evalIv = 0, voiceIv = 0;
const targets: Record<string, number> = {};

function bed(ctx: AudioContext, src: AudioNode, out: GainNode): Bed {
  const g = ctx.createGain();
  g.gain.value = 0;
  src.connect(g); g.connect(out);
  return { g };
}

function buildBeds(ctx: AudioContext): void {
  if (beds) return;
  noiseBufs(ctx);
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  /* the sea breathing: pink noise swelling on two slow, offset cycles */
  const wavesF = ctx.createBiquadFilter();
  wavesF.type = "lowpass"; wavesF.frequency.value = 520; wavesF.Q.value = .4;
  noiseSrc(ctx, pinkBuf!).connect(wavesF);
  const swell = ctx.createGain();
  swell.gain.value = .55;
  const lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.frequency.value = .07; lg.gain.value = .4;
  lfo.connect(lg); lg.connect(swell.gain); lfo.start();
  wavesF.connect(swell);
  const waves = bed(ctx, swell, master);

  /* the wash running up the sand: brighter, on its own cycle */
  const foamF = ctx.createBiquadFilter();
  foamF.type = "bandpass"; foamF.frequency.value = 1700; foamF.Q.value = .5;
  noiseSrc(ctx, whiteBuf!).connect(foamF);
  const fSwell = ctx.createGain();
  fSwell.gain.value = .4;
  const lfo2 = ctx.createOscillator(), lg2 = ctx.createGain();
  lfo2.frequency.value = .052; lg2.gain.value = .35;
  lfo2.connect(lg2); lg2.connect(fSwell.gain); lfo2.start();
  foamF.connect(fSwell);
  const foam = bed(ctx, fSwell, master);

  /* wind through the trees; gusts arrive as a slow random walk */
  const windF = ctx.createBiquadFilter();
  windF.type = "bandpass"; windF.frequency.value = 340; windF.Q.value = .45;
  noiseSrc(ctx, pinkBuf!).connect(windF);
  const gust = ctx.createGain();
  gust.gain.value = .6;
  windF.connect(gust);
  const wind = bed(ctx, gust, master);
  const gustWalk = () => {
    try { gust.gain.setTargetAtTime(rand(.25, 1), ctx.currentTime, rand(.8, 2.2)); } catch { /* noop */ }
    window.setTimeout(gustWalk, rand(1800, 4200));
  };
  gustWalk();

  /* the thin whistle a storm (or a winter night) puts in the eaves */
  const whF = ctx.createBiquadFilter();
  whF.type = "bandpass"; whF.frequency.value = 1050; whF.Q.value = 7;
  noiseSrc(ctx, whiteBuf!).connect(whF);
  const whistle = bed(ctx, whF, master);
  const whistleWalk = () => {
    try { whF.frequency.setTargetAtTime(rand(750, 1500), ctx.currentTime, rand(1.5, 3)); } catch { /* noop */ }
    window.setTimeout(whistleWalk, rand(2500, 6000));
  };
  whistleWalk();

  /* rain: a soft body plus the patter on the leaves */
  const rainF = ctx.createBiquadFilter();
  rainF.type = "lowpass"; rainF.frequency.value = 1100; rainF.Q.value = .5;
  noiseSrc(ctx, whiteBuf!).connect(rainF);
  const rainBed = bed(ctx, rainF, master);
  const patF = ctx.createBiquadFilter();
  patF.type = "highpass"; patF.frequency.value = 2800;
  noiseSrc(ctx, whiteBuf!).connect(patF);
  const patter = bed(ctx, patF, master);

  /* crickets: a 4.3 kHz trill gated into little bursts, all with LFOs —
     ConstantSource lifts the ±1 LFOs into 0..1 gates */
  let crickets: Bed;
  if (typeof ctx.createConstantSource === "function") {
    const car = ctx.createOscillator();
    car.type = "sine"; car.frequency.value = 4300; car.start();
    const trill = ctx.createGain(); trill.gain.value = 0;
    const t1 = ctx.createOscillator(), tg = ctx.createGain(), tc = ctx.createConstantSource();
    t1.frequency.value = 36; tg.gain.value = .5; tc.offset.value = .5;
    t1.connect(tg); tg.connect(trill.gain); tc.connect(trill.gain); t1.start(); tc.start();
    const burst = ctx.createGain(); burst.gain.value = 0;
    const b1 = ctx.createOscillator(), bg = ctx.createGain(), bc = ctx.createConstantSource();
    b1.type = "square"; b1.frequency.value = 1.6; bg.gain.value = .5; bc.offset.value = .5;
    b1.connect(bg); bg.connect(burst.gain); bc.connect(burst.gain); b1.start(); bc.start();
    car.connect(trill); trill.connect(burst);
    const cPan = pan(ctx, .35);
    crickets = bed(ctx, cPan ? (burst.connect(cPan), cPan) : burst, master);
  } else {
    const silent = ctx.createGain(); silent.gain.value = 0;
    crickets = bed(ctx, silent, master);
  }

  /* the fire's warm underside; its crackle pops ride on a timer below */
  const fireF = ctx.createBiquadFilter();
  fireF.type = "lowpass"; fireF.frequency.value = 190; fireF.Q.value = .4;
  noiseSrc(ctx, brownBuf!).connect(fireF);
  const fire = bed(ctx, fireF, master);
  const popLoop = () => {
    const lvl = targets.fire ?? 0;
    if (running && lvl > 0) {
      try {
        const t = ctx.currentTime + .01;
        const src = noiseSrc(ctx, whiteBuf!);
        const f = ctx.createBiquadFilter();
        f.type = "bandpass"; f.frequency.value = rand(1700, 4300); f.Q.value = 1.4;
        const g = ctx.createGain();
        const snap = Math.random() < .12;          /* the odd louder snap */
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime((snap ? .028 : rand(.006, .016)) * lvl, t + .004);
        g.gain.exponentialRampToValueAtTime(.0001, t + (snap ? .07 : rand(.02, .045)));
        src.connect(f); f.connect(g); g.connect(master!);
        window.setTimeout(() => { try { src.stop(); } catch { /* noop */ } }, 150);
      } catch { /* noop */ }
      window.setTimeout(popLoop, rand(35, 230));
    } else window.setTimeout(popLoop, 500);
  };
  popLoop();

  beds = { waves, foam, wind, whistle, rain: rainBed, patter, crickets, fire, whistleFilt: whF };
}

/* ---- one-shot voices ---- */

function birdPhrase(ctx: AudioContext, out: GainNode): void {
  const t0 = ctx.currentTime + .02;
  const base = rand(2300, 4100);
  const p = pan(ctx, rand(-.8, .8));
  const dest = p ? (p.connect(out), p) : out;
  let t = t0;
  const n = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine";
    const f = base * rand(.85, 1.15);
    const dur = rand(.05, .13);
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * rand(.65, 1.5), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(rand(.02, .04), t + .015);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur + .05);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + .08);
    t += dur + rand(.06, .22);
  }
}

function gullCry(ctx: AudioContext, out: GainNode): void {
  const t = ctx.currentTime + .02;
  const p = pan(ctx, rand(-.9, .9));
  const dest = p ? (p.connect(out), p) : out;
  const dur = rand(.45, .7);
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(rand(1000, 1250), t);
  o.frequency.exponentialRampToValueAtTime(rand(580, 720), t + dur);
  const vib = ctx.createOscillator(), vg = ctx.createGain();
  vib.frequency.value = 26; vg.gain.value = 38;
  vib.connect(vg); vg.connect(o.frequency);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(.022, t + .1);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); vib.start(t); o.stop(t + dur + .05); vib.stop(t + dur + .05);
}

function owlHoot(ctx: AudioContext, out: GainNode): void {
  let t = ctx.currentTime + .02;
  for (const f of [335, 305]) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = f * rand(.97, 1.03);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(.028, t + .08);
    g.gain.setValueAtTime(.028, t + .28);
    g.gain.exponentialRampToValueAtTime(.0001, t + .5);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + .55);
    t += .5;
  }
}

function drip(ctx: AudioContext, out: GainNode): void {
  const t = ctx.currentTime + .01;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = "sine";
  const f = rand(750, 1900);
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * .55, t + .1);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(rand(.012, .025), t + .008);
  g.gain.exponentialRampToValueAtTime(.0001, t + .2);
  const p = pan(ctx, rand(-.7, .7));
  o.connect(g); g.connect(p ? (p.connect(out), p) : out);
  o.start(t); o.stop(t + .25);
}

/* wind chimes by the house: pentatonic dings, busier as the wind picks up */
const CHIME_NOTES = [880, 987.77, 1174.66, 1318.51, 1479.98];
function windChimes(ctx: AudioContext, out: GainNode): void {
  const w = targets.wind ?? 0;
  const n = 1 + (Math.random() < w ? 1 : 0) + (Math.random() < .25 ? 1 : 0);
  const p = pan(ctx, rand(-.35, .35));
  const dest = p ? (p.connect(out), p) : out;
  let t = ctx.currentTime + .02;
  for (let i = 0; i < n; i++) {
    const f = CHIME_NOTES[Math.floor(Math.random() * CHIME_NOTES.length)];
    for (const [mul, lvl] of [[1, .013], [2.76, .004]] as const) {   /* tube + shimmer */
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f * mul * rand(.995, 1.005);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(lvl, t + .005);
      g.gain.exponentialRampToValueAtTime(.0001, t + rand(1.3, 2));
      o.connect(g); g.connect(dest);
      o.start(t); o.stop(t + 2.1);
    }
    t += rand(.05, .35);
  }
}

let flashEl: HTMLDivElement | null = null;
function skyFlash(): void {
  try {
    if (!flashEl) {
      flashEl = document.createElement("div");
      flashEl.id = "storm-flash";
      flashEl.style.cssText =
        "position:fixed;inset:0;background:#EAF2FF;opacity:0;pointer-events:none;z-index:90";
      document.body.appendChild(flashEl);
    }
    flashEl.animate(
      [{ opacity: 0 }, { opacity: .5 }, { opacity: .06 }, { opacity: .3 }, { opacity: 0 }],
      { duration: 650, easing: "ease-out" });
  } catch { /* noop */ }
}

function thunder(ctx: AudioContext, out: GainNode): void {
  skyFlash();                              /* light outruns sound */
  const away = rand(0, 1);                 /* how far off the storm sits */
  window.setTimeout(() => {
    try {
      const t = ctx.currentTime + .02;
      const src = noiseSrc(ctx, brownBuf!);
      const f = ctx.createBiquadFilter();
      f.type = "lowpass"; f.Q.value = .6;
      f.frequency.setValueAtTime(380 - away * 200, t);
      f.frequency.exponentialRampToValueAtTime(75, t + 3.2);
      const g = ctx.createGain();
      const peak = .12 - away * .07;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + rand(.1, .35));
      g.gain.linearRampToValueAtTime(peak * .35, t + 1.2);
      g.gain.linearRampToValueAtTime(peak * .6, t + rand(1.6, 2.2));
      g.gain.linearRampToValueAtTime(0, t + rand(3.2, 4.5));
      src.connect(f); f.connect(g); g.connect(out);
      window.setTimeout(() => { try { src.stop(); } catch { /* noop */ } }, 5000);
    } catch { /* noop */ }
  }, 250 + away * 1600);
}

/* ---- the conductor ---- */

interface Voice { nextAt: number; min: number; max: number; on: boolean; play: (ctx: AudioContext, out: GainNode) => void }
const voices: Record<string, Voice> = {
  bird: { nextAt: 0, min: 4, max: 10, on: false, play: birdPhrase },
  gull: { nextAt: 0, min: 18, max: 45, on: false, play: gullCry },
  owl: { nextAt: 0, min: 70, max: 150, on: false, play: owlHoot },
  drip: { nextAt: 0, min: .7, max: 2.4, on: false, play: drip },
  thunder: { nextAt: 0, min: 13, max: 32, on: false, play: thunder },
  chimes: { nextAt: 0, min: 6, max: 18, on: false, play: windChimes },
};

function evalContext(): void {
  if (!beds) return;
  const season = curSeason(), phase = curPhase();
  const rain = curWeather() === "rain" && season !== "winter";
  const snowy = curWeather() === "rain" && season === "winter";
  const storm = isStorm() && rain;
  const night = phase === "night", dayish = phase === "day" || phase === "dawn";

  let windLvl = curWeather() === "clear" ? .1 : curWeather() === "cloudy" ? .22 : .38;
  if (storm) windLvl = .85;
  if (season === "winter") windLvl = Math.min(1, windLvl * 1.7 + (snowy ? .25 : 0));

  const T: Record<string, number> = {
    waves: (night ? .42 : .5) * (storm ? 1.35 : 1),
    foam: storm ? 0 : .3,
    wind: windLvl,
    whistle: storm ? .5 : season === "winter" && (night || snowy) ? .16 : 0,
    rain: rain ? (storm ? .8 : .5) : 0,
    patter: rain ? (storm ? .45 : .3) : 0,
    crickets: night && !rain && !snowy && season !== "winter"
      ? (season === "summer" ? .5 : .32) : 0,
    /* evenings by a lit window or lantern crackle — a campfire burns all
       day; winter makes the fire dearer */
    fire: (getState().placed.some(p => p.id === "campfire")
      || ((night || phase === "dusk")
        && getState().placed.some(p => p.id === "lantern" || p.id === "house" || p.id === "cabin")))
      ? (season === "winter" ? .8 : .5) * (rain ? 1.25 : 1) : 0,
  };
  const ctx = audio();
  if (ctx) {
    const scale: Record<string, number> = {
      waves: .055, foam: .02, wind: .06, whistle: .012, rain: .05, patter: .02, crickets: .017,
      fire: .04,
    };
    for (const k of Object.keys(T)) {
      targets[k] = T[k];
      try {
        (beds as unknown as Record<string, Bed>)[k].g.gain
          .setTargetAtTime(T[k] * scale[k], ctx.currentTime, 1.8);
      } catch { /* noop */ }
    }
  }

  voices.bird.on = dayish && (season === "spring" || season === "summer") && !rain;
  const dawnBoost = phase === "dawn" ? .45 : 1;      /* dawn chorus */
  voices.bird.min = 3.5 * dawnBoost; voices.bird.max = 9 * dawnBoost;
  voices.gull.on = !night && !rain && !snowy;
  voices.owl.on = night && (season === "autumn" || season === "winter") && !rain;
  voices.drip.on = rain;
  voices.thunder.on = storm;
  /* chimes hang by a house or cabin, and only sing when there's wind */
  voices.chimes.on = windLvl >= .18
    && getState().placed.some(p => p.id === "house" || p.id === "cabin");
  const w = Math.min(1, windLvl);
  voices.chimes.min = 1.2 + (1 - w) * 9;
  voices.chimes.max = 3.5 + (1 - w) * 16;
}

function tickVoices(): void {
  const ctx = audio();
  if (!ctx || !master || !running) return;
  const now = performance.now() / 1000;
  for (const k of Object.keys(voices)) {
    const v = voices[k];
    if (!v.on) { v.nextAt = Math.max(v.nextAt, now + rand(v.min, v.max) * .5); continue; }
    if (now >= v.nextAt) {
      try { v.play(ctx, master); } catch { /* noop */ }
      v.nextAt = now + rand(v.min, v.max);
    }
  }
}

export function ambientStart(): void {
  const ctx = audio();
  if (!ctx) return;
  try {
    buildBeds(ctx);
    running = true;
    evalContext();
    master!.gain.setTargetAtTime(.9, ctx.currentTime, 1.2);
    if (!evalIv) evalIv = window.setInterval(evalContext, 5000);
    if (!voiceIv) voiceIv = window.setInterval(tickVoices, 500);
    const now = performance.now() / 1000;
    for (const v of Object.values(voices)) v.nextAt = now + rand(1.5, v.max * .6);
  } catch { /* noop */ }
}

export function ambientStop(): void {
  running = false;
  const ctx = audio();
  if (ctx && master) {
    try { master.gain.setTargetAtTime(0, ctx.currentTime, .4); } catch { /* noop */ }
  }
}

export const ambientRunning = (): boolean => running;

/* ---- little UI sounds (they respect the speaker toggle) ---- */

const uiCtx = (): AudioContext | null => (getState().sound ? audio() : null);

/** one knock of something set down: a pitched thump plus a contact click */
function knock(ctx: AudioContext, t: number, f: number, lvl: number): void {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * .55, t + .1);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(lvl, t + .006);
  g.gain.exponentialRampToValueAtTime(.0001, t + .16);
  o.connect(g); g.connect(ctx.destination);
  o.start(t); o.stop(t + .2);
  const src = noiseSrc(ctx, whiteBuf!);
  const fl = ctx.createBiquadFilter();
  fl.type = "bandpass"; fl.frequency.value = f * 9; fl.Q.value = 1;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0, t);
  ng.gain.linearRampToValueAtTime(lvl * .5, t + .004);
  ng.gain.exponentialRampToValueAtTime(.0001, t + .05);
  src.connect(fl); fl.connect(ng); ng.connect(ctx.destination);
  window.setTimeout(() => { try { src.stop(); } catch { /* noop */ } }, 200);
}

const STONEY = new Set(["rock", "well", "lantern", "birdbath", "sandcastle"]);

/** setting an item down sounds like what it's made of */
export function placeSound(item: { id: string; cat: string }): void {
  const ctx = uiCtx();
  if (!ctx) return;
  try {
    noiseBufs(ctx);
    const t = ctx.currentTime + .01;
    if (item.cat === "plants") {
      /* soil pat + leaf rustle */
      knock(ctx, t, 95, .03);
      const src = noiseSrc(ctx, whiteBuf!);
      const f = ctx.createBiquadFilter();
      f.type = "bandpass"; f.frequency.value = 4800; f.Q.value = .8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(.025, t + .03);
      g.gain.exponentialRampToValueAtTime(.0001, t + .3);
      src.connect(f); f.connect(g); g.connect(ctx.destination);
      window.setTimeout(() => { try { src.stop(); } catch { /* noop */ } }, 400);
    } else if (item.cat === "buildings") {
      knock(ctx, t, 200, .05);           /* two mallet taps — built, not dropped */
      knock(ctx, t + .14, 165, .045);
    } else if (STONEY.has(item.id)) {
      knock(ctx, t, 110, .06);
    } else {
      knock(ctx, t, 215, .05);           /* wood */
    }
  } catch { /* noop */ }
}

/** the faintest tap when hopping between screens */
export function uiTick(): void {
  const ctx = uiCtx();
  if (!ctx) return;
  try {
    noiseBufs(ctx);
    const t = ctx.currentTime + .005;
    const src = noiseSrc(ctx, whiteBuf!);
    const f = ctx.createBiquadFilter();
    f.type = "highpass"; f.frequency.value = 2600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(.014, t + .003);
    g.gain.exponentialRampToValueAtTime(.0001, t + .035);
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    window.setTimeout(() => { try { src.stop(); } catch { /* noop */ } }, 100);
  } catch { /* noop */ }
}

/** opening the shop: a soft page-swish with a bright little blip on top */
export function shopWhoosh(): void {
  const ctx = uiCtx();
  if (!ctx) return;
  try {
    noiseBufs(ctx);
    const t = ctx.currentTime + .01;
    const src = noiseSrc(ctx, whiteBuf!);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass"; f.Q.value = 1.2;
    f.frequency.setValueAtTime(700, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + .16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(.022, t + .05);
    g.gain.exponentialRampToValueAtTime(.0001, t + .22);
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    window.setTimeout(() => { try { src.stop(); } catch { /* noop */ } }, 300);
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = "sine"; o.frequency.value = 1320;
    og.gain.setValueAtTime(0, t + .1);
    og.gain.linearRampToValueAtTime(.02, t + .12);
    og.gain.exponentialRampToValueAtTime(.0001, t + .4);
    o.connect(og); og.connect(ctx.destination);
    o.start(t + .1); o.stop(t + .45);
  } catch { /* noop */ }
}

/* the pet's paws: a soft pat on grass, grit on sand, a crunch in snow */
export type Ground = "grass" | "sand" | "snow";
let stepCount = 0;
export function footstep(ground: Ground): void {
  stepCount++;
  const ctx = audio();
  if (!ctx || !running) return;
  try {
    noiseBufs(ctx);
    const t = ctx.currentTime + .005;
    const bursts = ground === "snow" ? 3 : ground === "sand" ? 2 : 1;
    for (let i = 0; i < bursts; i++) {
      const src = noiseSrc(ctx, whiteBuf!);
      const f = ctx.createBiquadFilter();
      if (ground === "grass") { f.type = "lowpass"; f.frequency.value = 750; }
      else { f.type = "bandpass"; f.frequency.value = ground === "sand" ? rand(1300, 1900) : rand(2200, 3200); f.Q.value = 1.1; }
      const g = ctx.createGain();
      const at = t + i * .022;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(ground === "grass" ? .011 : rand(.007, .013), at + .006);
      g.gain.exponentialRampToValueAtTime(.0001, at + (ground === "grass" ? .06 : .045));
      src.connect(f); f.connect(g); g.connect(ctx.destination);
      window.setTimeout(() => { try { src.stop(); } catch { /* noop */ } }, 200);
    }
  } catch { /* noop */ }
}

/* a handful of leaves shaken from a tapped tree */
export function rustle(): void {
  const ctx = audio();
  if (!ctx) return;
  try {
    noiseBufs(ctx);
    const t = ctx.currentTime + .01;
    const src = noiseSrc(ctx, whiteBuf!);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = 5200; f.Q.value = .7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(.05, t + .04);
    g.gain.exponentialRampToValueAtTime(.0001, t + rand(.35, .5));
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    window.setTimeout(() => { try { src.stop(); } catch { /* noop */ } }, 700);
  } catch { /* noop */ }
}

/* test hook */
(window as unknown as Record<string, unknown>).__ambience = () => ({
  running,
  ctxState: audio()?.state ?? "none",
  targets: { ...targets },
  voices: Object.fromEntries(Object.entries(voices).map(([k, v]) => [k, v.on])),
  steps: stepCount,
});
