/* The island's soundscape — every sound is synthesized in WebAudio, no
   audio assets. Continuous beds (waves, wind, rain, crickets) crossfade
   with the season, the time of day and the weather; one-shot voices
   (bird phrases, a gull, thunder, drips on the tent, an owl) fire on
   randomized timers. Storm days also flash the sky before the rumble. */
import { audio } from "./audio";
import { curPhase, curSeason, curWeather, isStorm } from "./weather";
import { getState } from "./store";
import { MIX_KEYS, type MixKey } from "./types";

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

/* ---- noise buffers (built once per context) ---- */
let pinkBuf: AudioBuffer | null = null;
let brownBuf: AudioBuffer | null = null;
let whiteBuf: AudioBuffer | null = null;

function noiseBufs(ctx: AudioContext): void {
  if (pinkBuf) return;
  const len = 4 * ctx.sampleRate;
  /* Generated with an overhang, so the tail can be folded back over the head.
     The pink and brown filters start from silence, so without that the last
     sample of the buffer sits nowhere near the first — and every one of these
     buffers is looped. That step was a click once per four-second pass on
     every bed at once, low and thumping through the fire's 190Hz lowpass:
     a stuck record, which is exactly what it sounded like. */
  const xf = Math.min(4096, len >> 4);
  const w = new Float32Array(len + xf), p = new Float32Array(len + xf), br = new Float32Array(len + xf);
  /* pink via Paul Kellet's filter; brown by leaky integration */
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < len + xf; i++) {
    const x = Math.random() * 2 - 1;
    w[i] = x;
    b0 = .997 * b0 + .0297 * x;
    b1 = .985 * b1 + .0425 * x;
    b2 = .95 * b2 + .0613 * x;
    p[i] = (b0 + b1 + b2 + x * .05) * 2.1;
    last = (last + x * .02) / 1.02;
    br[i] = last * 12;
  }
  const seamless = (a: Float32Array): Float32Array => {
    for (let i = 0; i < xf; i++) {
      const k = i / xf;
      a[i] = a[i] * k + a[len + i] * (1 - k);
    }
    const out = a.subarray(0, len);
    /* the leaky integrator leaves DC behind, and a step in DC is a thud */
    let m = 0;
    for (let i = 0; i < len; i++) m += out[i];
    m /= len;
    for (let i = 0; i < len; i++) out[i] -= m;
    return out;
  };
  const mk = (a: Float32Array): AudioBuffer => {
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    b.getChannelData(0).set(seamless(a));
    return b;
  };
  whiteBuf = mk(w); pinkBuf = mk(p); brownBuf = mk(br);
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
let groupG: Record<string, GainNode> | null = null;
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
  /* One gain per fader, between everything it owns and the master, so a layer
     can be turned down rather than only switched off — and so the one-shot
     voices ride the same fader as the bed they belong to. */
  const gg: Record<string, GainNode> = {};
  for (const k of MIX_KEYS) {
    const g = ctx.createGain();
    g.gain.value = 1;
    g.connect(master);
    gg[k] = g;
  }
  groupG = gg;

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
  const waves = bed(ctx, swell, gg["sea"]);

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
  const foam = bed(ctx, fSwell, gg["sea"]);

  /* wind through the trees; gusts arrive as a slow random walk */
  const windF = ctx.createBiquadFilter();
  windF.type = "bandpass"; windF.frequency.value = 340; windF.Q.value = .45;
  noiseSrc(ctx, pinkBuf!).connect(windF);
  const gust = ctx.createGain();
  gust.gain.value = .6;
  windF.connect(gust);
  const wind = bed(ctx, gust, gg["wind"]);
  const gustWalk = () => {
    try { gust.gain.setTargetAtTime(rand(.25, 1), ctx.currentTime, rand(.8, 2.2)); } catch { /* noop */ }
    window.setTimeout(gustWalk, rand(1800, 4200));
  };
  gustWalk();

  /* the thin whistle a storm (or a winter night) puts in the eaves */
  const whF = ctx.createBiquadFilter();
  whF.type = "bandpass"; whF.frequency.value = 1050; whF.Q.value = 7;
  noiseSrc(ctx, whiteBuf!).connect(whF);
  const whistle = bed(ctx, whF, gg["wind"]);
  const whistleWalk = () => {
    try { whF.frequency.setTargetAtTime(rand(750, 1500), ctx.currentTime, rand(1.5, 3)); } catch { /* noop */ }
    window.setTimeout(whistleWalk, rand(2500, 6000));
  };
  whistleWalk();

  /* rain: a soft body plus the patter on the leaves */
  const rainF = ctx.createBiquadFilter();
  rainF.type = "lowpass"; rainF.frequency.value = 1100; rainF.Q.value = .5;
  noiseSrc(ctx, whiteBuf!).connect(rainF);
  const rainBed = bed(ctx, rainF, gg["rain"]);
  const patF = ctx.createBiquadFilter();
  patF.type = "highpass"; patF.frequency.value = 2800;
  noiseSrc(ctx, whiteBuf!).connect(patF);
  const patter = bed(ctx, patF, gg["rain"]);

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
    crickets = bed(ctx, cPan ? (burst.connect(cPan), cPan) : burst, gg["wild"]);
  } else {
    const silent = ctx.createGain(); silent.gain.value = 0;
    crickets = bed(ctx, silent, gg["wild"]);
  }

  /* the fire's warm underside; its crackle pops ride on a timer below */
  const fireF = ctx.createBiquadFilter();
  fireF.type = "lowpass"; fireF.frequency.value = 190; fireF.Q.value = .4;
  noiseSrc(ctx, brownBuf!).connect(fireF);
  const fire = bed(ctx, fireF, gg["fire"]);
  /* The crackle pops that used to ride on top are gone. Scattered ticks
     firing from the moment the app opens read as something rustling nearby
     — leaves falling, or worse — rather than as a hearth. What's left is the
     fire's warm underside, which sits below anything you'd notice. */

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
  /* A narrower field: drops that jump right across your head every second
     are unsettling rather than atmospheric. */
  const p = pan(ctx, rand(-.32, .32));
  const dest = p ? (p.connect(out), p) : out;
  /* the impact tick — without a broadband transient a drop is just a beep */
  if (whiteBuf) {
    const n = noiseSrc(ctx, whiteBuf);
    const nf = ctx.createBiquadFilter();
    nf.type = "bandpass"; nf.frequency.value = rand(1900, 3400); nf.Q.value = 1.1;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(rand(.008, .015), t);
    ng.gain.exponentialRampToValueAtTime(.0001, t + .035);
    n.connect(nf); nf.connect(ng); ng.connect(dest);
    n.stop(t + .06);
  }
  /* the bubble left behind by the drop. Its pitch RISES as the bubble
     shrinks — the old downward sweep is why this read as a sonar ping in a
     horror game rather than water. Lower and shorter, too. */
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = "sine";
  const f = rand(520, 1080);
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * rand(1.18, 1.45), t + .085);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(rand(.009, .018), t + .005);
  g.gain.exponentialRampToValueAtTime(.0001, t + .13);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + .16);
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

interface Voice {
  nextAt: number; min: number; max: number; on: boolean; grp: MixKey;
  play: (ctx: AudioContext, out: GainNode) => void;
}
const voices: Record<string, Voice> = {
  bird: { nextAt: 0, min: 4, max: 10, on: false, grp: "wild", play: birdPhrase },
  gull: { nextAt: 0, min: 18, max: 45, on: false, grp: "wild", play: gullCry },
  owl: { nextAt: 0, min: 70, max: 150, on: false, grp: "wild", play: owlHoot },
  drip: { nextAt: 0, min: 1.4, max: 4.4, on: false, grp: "rain", play: drip },
  thunder: { nextAt: 0, min: 13, max: 32, on: false, grp: "rain", play: thunder },
  chimes: { nextAt: 0, min: 6, max: 18, on: false, grp: "wind", play: windChimes },
};

/* .9 was the old fixed ceiling; the slider rides underneath it, and its .5
   default lands exactly where the master already sat. */
const masterLevel = (): number => .9 * (getState().mix?.vol ?? .5);

/** the mix changed in Profile — apply it without waiting for the next tick */
export function applyMix(): void {
  const ctx = audio();
  const m = getState().mix;
  if (ctx && master && running) master.gain.setTargetAtTime(masterLevel(), ctx.currentTime, .12);
  if (ctx && groupG && m) {
    for (const k of MIX_KEYS) {
      try { groupG[k].gain.setTargetAtTime(m[k] ?? 1, ctx.currentTime, .12); } catch { /* noop */ }
    }
  }
  evalContext();
}

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
      /* rain was the loudest thing in the mix after the sea, and its patter
         layer is a 2.8kHz hiss — together they read as a downpour on a tin
         roof rather than weather somewhere outside */
      waves: .055, foam: .02, wind: .06, whistle: .012, rain: .022, patter: .007, crickets: .017,
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
  /* a fader pulled all the way down stops the one-shots outright, rather
     than scheduling sounds nobody will hear */
  const m = getState().mix;
  if (m) for (const v of Object.values(voices)) v.on = v.on && (m[v.grp] ?? 1) > 0;
}

function tickVoices(): void {
  const ctx = audio();
  if (!ctx || !master || !running) return;
  const now = performance.now() / 1000;
  for (const k of Object.keys(voices)) {
    const v = voices[k];
    if (!v.on) { v.nextAt = Math.max(v.nextAt, now + rand(v.min, v.max) * .5); continue; }
    if (now >= v.nextAt) {
      try { v.play(ctx, groupG?.[v.grp] ?? master); } catch { /* noop */ }
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
    master!.gain.setTargetAtTime(masterLevel(), ctx.currentTime, 1.2);
    const m0 = getState().mix;
    if (groupG && m0) for (const k of MIX_KEYS) groupG[k].gain.value = m0[k] ?? 1;
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
/* These go through the master like everything else. Wired straight to
   ctx.destination they skipped every volume change made to the mix and ended
   up louder than the island they belong to. `sound` being on is what starts
   the ambience, so the master is always up by the time any of these fire;
   before that it doesn't exist yet and they fall back to the speakers. */

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
  o.connect(g); g.connect(master ?? ctx.destination);
  o.start(t); o.stop(t + .2);
  const src = noiseSrc(ctx, whiteBuf!);
  const fl = ctx.createBiquadFilter();
  fl.type = "bandpass"; fl.frequency.value = f * 9; fl.Q.value = 1;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0, t);
  ng.gain.linearRampToValueAtTime(lvl * .5, t + .004);
  ng.gain.exponentialRampToValueAtTime(.0001, t + .05);
  src.connect(fl); fl.connect(ng); ng.connect(master ?? ctx.destination);
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
      /* just the pat of soil — the leaf rustle that rode on top of it was a
         300ms hiss at 4.8kHz, which is static, not foliage */
      knock(ctx, t, 95, .03);
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
    src.connect(f); f.connect(g); g.connect(master ?? ctx.destination);
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
    src.connect(f); f.connect(g); g.connect(master ?? ctx.destination);
    window.setTimeout(() => { try { src.stop(); } catch { /* noop */ } }, 300);
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = "sine"; o.frequency.value = 1320;
    og.gain.setValueAtTime(0, t + .1);
    og.gain.linearRampToValueAtTime(.02, t + .12);
    og.gain.exponentialRampToValueAtTime(.0001, t + .4);
    o.connect(og); og.connect(master ?? ctx.destination);
    o.start(t + .1); o.stop(t + .45);
  } catch { /* noop */ }
}

/* the pet's paws: a soft pat on grass, grit on sand, a crunch in snow */
export type Ground = "grass" | "sand" | "snow";
let stepCount = 0;
export function footstep(ground: Ground): void {
  stepCount++;
  const ctx = audio();
  if (!ctx || !running || (getState().mix?.pet ?? 1) <= 0) return;
  /* Four paws at roughly four steps a second, every one identical, is a
     typewriter. Drop one in five, and make no two of the rest alike. */
  if (Math.random() < .35) return;
  try {
    noiseBufs(ctx);
    const t = ctx.currentTime + .005;
    const bursts = ground === "snow" ? 3 : ground === "sand" ? 2 : 1;
    for (let i = 0; i < bursts; i++) {
      const src = noiseSrc(ctx, whiteBuf!);
      const f = ctx.createBiquadFilter();
      if (ground === "grass") {
        /* A paw in grass brushes, it doesn't knock. Lowpassing at 750Hz threw
           away every blade of texture and left nothing but the thud. */
        f.type = "bandpass"; f.frequency.value = rand(1100, 2200); f.Q.value = .55;
      } else {
        f.type = "bandpass";
        f.frequency.value = ground === "sand" ? rand(1300, 1900) : rand(2200, 3200);
        f.Q.value = 1.1;
      }
      const g = ctx.createGain();
      const at = t + i * rand(.018, .028);
      /* A companion trotting about is background, not a lead instrument —
         you should notice it only when you stop hearing it. */
      const lvl = (ground === "grass" ? .0011 : rand(.0009, .0016)) * rand(.7, 1.3);
      const dec = ground === "grass" ? rand(.07, .11) : rand(.04, .065);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(lvl, at + rand(.012, .02));   /* soft attack */
      g.gain.exponentialRampToValueAtTime(.0001, at + dec);
      /* through the master, not straight at the speakers: wired to
         ctx.destination these steps skipped every volume change made to the
         rest of the mix, so they sat twice as loud as anything around them */
      src.connect(f); f.connect(g); g.connect(groupG?.pet ?? master ?? ctx.destination);
      window.setTimeout(() => { try { src.stop(); } catch { /* noop */ } }, 250);
    }
  } catch { /* noop */ }
}

/* Shaking a tree used to play a leaf rustle. Every attempt at it — one long
   noise swell, then a scatter of grains — came out as hiss or radio static
   rather than leaves, so the leaves now fall silently. */

/* test hook */
(window as unknown as Record<string, unknown>).__ambience = () => ({
  running,
  ctxState: audio()?.state ?? "none",
  targets: { ...targets },
  voices: Object.fromEntries(Object.entries(voices).map(([k, v]) => [k, v.on])),
  steps: stepCount,
});
