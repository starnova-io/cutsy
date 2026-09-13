/* The little sounds on top of the island: taps, lifts, a pet's mrrp, and the
   three-note signature a finished session earns. All synthesized, all quiet —
   the idea is a wooden, felt-covered toy under your finger, never a mobile
   game going "ting". Every one is a no-op without audio or with `sfx` off, and
   rides the sfx bus (the island's volume slider, none of its fades), so none
   can end up louder than the island they belong to.

   levels below are into that bus, which sits at .45 by default: UI peaks stay
   around .01–.03, rewards around .04–.06. */
import { audio } from "./audio";
import { mixGain, noiseBuffer, sfxBus } from "./ambience";
import { getState } from "./store";

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

interface Out { ctx: AudioContext; out: AudioNode }

/** where a sound should go right now, or null if it shouldn't play at all */
function outlet(): Out | null {
  if (getState().sfx === false) return null;
  const ctx = audio();
  if (!ctx) return null;
  try { return { ctx, out: sfxBus(ctx) }; } catch { return null; }
}

/** run a sound, swallowing anything a half-broken audio stack throws */
function play(fn: (o: Out, t: number) => void, delay = 0): void {
  const o = outlet();
  if (!o) return;
  try { fn(o, o.ctx.currentTime + .005 + delay); } catch { /* noop */ }
}

/* every chain is torn down when its source ends, so a hundred taps leave
   nothing behind in the graph */
function reap(src: AudioScheduledSourceNode, ...nodes: AudioNode[]): void {
  src.onended = () => {
    try { src.disconnect(); for (const n of nodes) n.disconnect(); } catch { /* noop */ }
  };
}

interface ToneOpts {
  f: number; lvl: number; dec: number;
  type?: OscillatorType; att?: number;
  /** pitch to glide to over `bendT` seconds */
  to?: number; bendT?: number;
}

/** one enveloped oscillator: a quick attack, an exponential tail */
function tone({ ctx, out }: Out, t: number, o: ToneOpts): void {
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.f, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.bendT ?? o.dec * .5));
  const att = o.att ?? .004;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.lvl, t + att);
  g.gain.exponentialRampToValueAtTime(.0001, t + att + o.dec);
  osc.connect(g); g.connect(out);
  osc.start(t); osc.stop(t + att + o.dec + .03);
  reap(osc, g);
}

interface NoiseOpts {
  lvl: number; dur: number;
  kind?: "white" | "pink" | "brown";
  type?: BiquadFilterType; f: number; Q?: number;
  /** filter sweep target */
  to?: number; att?: number;
}

/** a burst of filtered noise — cloth, air, grass, the click of a contact */
function noise({ ctx, out }: Out, t: number, o: NoiseOpts): void {
  const buf = noiseBuffer(ctx, o.kind ?? "white");
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const fl = ctx.createBiquadFilter();
  fl.type = o.type ?? "bandpass"; fl.Q.value = o.Q ?? .8;
  fl.frequency.setValueAtTime(o.f, t);
  if (o.to) fl.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  const g = ctx.createGain();
  const att = o.att ?? .003;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.lvl, t + att);
  g.gain.exponentialRampToValueAtTime(.0001, t + Math.max(att + .005, o.dur));
  src.connect(fl); fl.connect(g); g.connect(out);
  src.start(t, Math.random() * (buf.duration - o.dur - .1), o.dur + .05);
  reap(src, fl, g);
}

/* ---- instruments ---- */

/** felt mallet: a round fundamental, the marimba's 4th partial gone in a blink,
    and the soft thump of the felt itself */
function mallet(o: Out, t: number, f: number, lvl: number, dec = .5): void {
  tone(o, t, { f, lvl, dec, att: .006 });
  tone(o, t, { f: f * 3.99, lvl: lvl * .12, dec: dec * .18, att: .003 });
  noise(o, t, { kind: "pink", type: "lowpass", f: f * 2.5, Q: .5, lvl: lvl * .35, dur: .04 });
}

/** glass bell: inharmonic partials that ring out unevenly, like a real one */
function bell(o: Out, t: number, f: number, lvl: number, dec = 1.2): void {
  tone(o, t, { f, lvl, dec, att: .005 });
  tone(o, t, { f: f * 2.76, lvl: lvl * .22, dec: dec * .45, att: .003 });
  tone(o, t, { f: f * 5.4, lvl: lvl * .07, dec: dec * .2, att: .002 });
}

/** the ✦: a high glint with a breath of air around it */
function sparkle(o: Out, t: number, f: number, lvl: number): void {
  bell(o, t, f, lvl, .9);
  tone(o, t + .045, { f: f * 1.5 * rand(.998, 1.002), lvl: lvl * .45, dec: .5, att: .004 });
  noise(o, t, { type: "highpass", f: 6500, lvl: lvl * .18, dur: .18, att: .02 });
}

/** a wood knock: short pitched body that drops as it dies, plus the contact */
function knock(o: Out, t: number, f: number, lvl: number): void {
  tone(o, t, { f, to: f * .6, bendT: .08, lvl, dec: .1, att: .003 });
  noise(o, t, { type: "bandpass", f: f * 8, Q: 1.2, lvl: lvl * .4, dur: .03, att: .002 });
}

/** leaves: a scatter of short, narrow, differently pitched grains — texture,
    not a swell of hiss */
function rustle(o: Out, t: number, grains: number, span: number, lvl: number, lo = 2200, hi = 4800): void {
  for (let i = 0; i < grains; i++) {
    const at = t + Math.pow(Math.random(), 1.4) * span;
    noise(o, at, { type: "bandpass", f: rand(lo, hi), Q: rand(1.6, 3), lvl: lvl * rand(.5, 1), dur: rand(.018, .045), att: .004 });
  }
  /* the branch moving underneath, felt more than heard */
  noise(o, t, { kind: "pink", type: "lowpass", f: 700, Q: .4, lvl: lvl * .5, dur: span * .8, att: span * .25 });
}

/* ---- the signature: dum — ding — ✦ ---- */
/* D4 on a mallet, A5 on glass, E6 glinting: stacked fifths, open and warm */
const SIG = { low: 293.66, mid: 880, high: 1318.51 };

function sigAt(o: Out, t: number, notes: 1 | 2 | 3, k = 1, gap = .22): void {
  mallet(o, t, SIG.low, .04 * k, .7);
  tone(o, t, { f: SIG.low / 2, lvl: .01 * k, dec: .6, att: .01 });   /* a little floor under it */
  if (notes >= 2) bell(o, t + gap, SIG.mid, .026 * k, 1.3);
  if (notes >= 3) sparkle(o, t + gap * 2.1, SIG.high, .016 * k);
}

/* ================= UI layer ================= */

/** a button: a soft wooden tok, felt-covered, barely there */
export function tapUI(): void {
  play((o, t) => {
    const f = rand(470, 520);
    tone(o, t, { f, to: f * .62, bendT: .04, lvl: .02, dec: .055, att: .002 });
    noise(o, t, { type: "bandpass", f: 1400, Q: .9, lvl: .006, dur: .02, att: .001 });
  });
}

/** switching tabs: a small rising pop, like a bubble in a jar */
export function tabPop(): void {
  play((o, t) => {
    tone(o, t, { f: rand(560, 620), to: 980, bendT: .035, lvl: .012, dec: .05, att: .003 });
  });
}

/** a switch going on: the tik of the toggle, then the faintest bell */
export function toggleOn(): void {
  play((o, t) => {
    noise(o, t, { type: "bandpass", f: 3000, Q: 1.4, lvl: .012, dur: .012, att: .001 });
    tone(o, t, { f: 900, to: 700, bendT: .02, lvl: .008, dec: .03, att: .001 });
    bell(o, t + .035, 1760, .006, .35);
  });
}

/** a switch going off: lower, duller, no bell */
export function toggleOff(): void {
  play((o, t) => {
    tone(o, t, { f: 320, to: 200, bendT: .05, lvl: .018, dec: .07, att: .002 });
    noise(o, t, { type: "bandpass", f: 900, Q: .9, lvl: .006, dur: .02, att: .001 });
  });
}

/** a sheet sliding up: soft air rising over ~150ms */
export function modalOpen(): void {
  play((o, t) => {
    noise(o, t, { kind: "pink", type: "bandpass", f: 450, to: 1600, Q: .9, lvl: .016, dur: .16, att: .09 });
  });
}

/** the same sheet going back down */
export function modalClose(): void {
  play((o, t) => {
    noise(o, t, { kind: "pink", type: "bandpass", f: 1500, to: 450, Q: .9, lvl: .013, dur: .15, att: .06 });
  });
}

/** can't do that: two soft, low duk-duks — a shake of the head, not a buzzer */
export function invalid(): void {
  play((o, t) => {
    knock(o, t, 190, .016);
    knock(o, t + .11, 165, .013);
  });
}

/** choosing something in a list: a tiny kalimba pluck */
export function selectPluck(): void {
  play((o, t) => {
    const f = 784 * rand(.99, 1.01);
    tone(o, t, { f: f * 1.01, to: f, bendT: .02, lvl: .013, dec: .22, att: .002 });
    tone(o, t, { f: f * 5.4, lvl: .002, dec: .04, att: .001 });
  });
}

/* ================= island layer ================= */

/** picking a piece up: a soft fup of air and cloth */
export function lift(): void {
  play((o, t) => {
    noise(o, t, { kind: "pink", type: "lowpass", f: 380, to: 1300, Q: .6, lvl: .02, dur: .11, att: .025 });
    tone(o, t, { f: 170, to: 250, bendT: .07, lvl: .005, dec: .08, att: .02 });
  });
}

/** setting a piece down: a pof on grass, and whatever it's made of on top */
export function drop(cat: string): void {
  play((o, t) => {
    /* the pof everything shares: air pushed out from under it */
    noise(o, t, { kind: "pink", type: "lowpass", f: 520, to: 180, Q: .5, lvl: .024, dur: .12, att: .008 });
    tone(o, t, { f: 115, to: 68, bendT: .08, lvl: .02, dec: .1, att: .004 });
    if (cat === "plants") rustle(o, t + .01, 4, .09, .006, 2600, 5200);
    else if (cat === "buildings") { knock(o, t + .02, 210, .022); knock(o, t + .15, 175, .018); }
    else if (cat === "land") tone(o, t, { f: 62, lvl: .02, dec: .3, att: .02 });
    else if (cat === "pets") bell(o, t + .05, 1568, .005, .4);
    else knock(o, t + .01, 230, .016);
  });
}

/** tapping something on the island sounds like touching it */
export function tapObject(kind: "tree" | "flower" | "house" | "stone" | "water" | "other"): void {
  play((o, t) => {
    switch (kind) {
      case "tree": rustle(o, t, 9, .22, .009); break;
      case "flower": rustle(o, t, 4, .1, .006, 3200, 5800); break;
      case "house": knock(o, t, 230, .022); knock(o, t + .12, 215, .017); break;
      case "stone": knock(o, t, 120, .026); break;
      case "water": {
        /* a plop's pitch rises as the bubble closes */
        tone(o, t, { f: 380, to: 950, bendT: .06, lvl: .018, dec: .08, att: .003 });
        noise(o, t, { type: "bandpass", f: 1800, Q: 1, lvl: .004, dur: .03, att: .001 });
        break;
      }
      default: tone(o, t, { f: 480, to: 300, bendT: .04, lvl: .016, dec: .05, att: .002 });
    }
  });
}

/* ---- the companion's voice ---- */

interface VoiceOpts {
  /** [time offset, pitch] points for the throat */
  pitch: [number, number][];
  /** [time offset, centre] points for the mouth */
  mouth: [number, number][];
  dur: number; lvl: number;
  /** purring flutter, Hz */
  trill?: number;
}

/** a tiny throat: a buzzy source shaped by a moving mouth, softened at the top */
function voice({ ctx, out }: Out, t: number, v: VoiceOpts): void {
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(v.pitch[0][1], t);
  for (const [dt, f] of v.pitch.slice(1)) osc.frequency.exponentialRampToValueAtTime(f, t + dt);
  const mouth = ctx.createBiquadFilter();
  mouth.type = "bandpass"; mouth.Q.value = 3.5;
  mouth.frequency.setValueAtTime(v.mouth[0][1], t);
  for (const [dt, f] of v.mouth.slice(1)) mouth.frequency.exponentialRampToValueAtTime(f, t + dt);
  const soft = ctx.createBiquadFilter();
  soft.type = "lowpass"; soft.frequency.value = 2600;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v.lvl, t + .03);
  g.gain.setValueAtTime(v.lvl, t + v.dur * .6);
  g.gain.exponentialRampToValueAtTime(.0001, t + v.dur);
  osc.connect(mouth); mouth.connect(soft);
  const extra: AudioNode[] = [mouth, soft, g];
  if (v.trill) {
    const flutter = ctx.createGain();
    flutter.gain.value = .6;
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = v.trill; depth.gain.value = .4;
    lfo.connect(depth); depth.connect(flutter.gain);
    lfo.start(t); lfo.stop(t + v.dur + .05);
    reap(lfo, depth);
    soft.connect(flutter); flutter.connect(g);
    extra.push(flutter);
  } else soft.connect(g);
  g.connect(out);
  osc.start(t); osc.stop(t + v.dur + .05);
  reap(osc, ...extra);
}

/** the companion's sounds follow its own fader too; off means it keeps quiet */
function petOut(): Out | null {
  const o = outlet();
  if (!o) return null;
  const k = mixGain("pet", getState().mix?.pet ?? .03);
  if (k <= 0) return null;
  const g = o.ctx.createGain();
  g.gain.value = Math.min(1.5, k);
  g.connect(o.out);
  /* the gain is tiny and silent once the voice ends; let it go after */
  window.setTimeout(() => { try { g.disconnect(); } catch { /* noop */ } }, 2500);
  return { ctx: o.ctx, out: g };
}

function petPlay(fn: (o: Out, t: number) => void): boolean {
  const o = petOut();
  if (!o) return false;
  try { fn(o, o.ctx.currentTime + .01); return true; } catch { return false; }
}

/** a purr: a low rumble of breath, fluttering ~24 times a second */
function purr(o: Out, t: number, dur: number, lvl: number): void {
  const { ctx, out } = o;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, "brown");
  const fl = ctx.createBiquadFilter();
  fl.type = "lowpass"; fl.frequency.value = 320; fl.Q.value = .7;
  const flutter = ctx.createGain(); flutter.gain.value = .5;
  const lfo = ctx.createOscillator(), depth = ctx.createGain();
  lfo.frequency.value = rand(22, 26); depth.gain.value = .5;
  lfo.connect(depth); depth.connect(flutter.gain);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(lvl, t + dur * .25);
  g.gain.linearRampToValueAtTime(lvl * .7, t + dur * .7);
  g.gain.linearRampToValueAtTime(0, t + dur);
  src.connect(fl); fl.connect(flutter); flutter.connect(g); g.connect(out);
  src.start(t, Math.random() * 2, dur + .05);
  lfo.start(t); lfo.stop(t + dur + .05);
  reap(src, fl, flutter, g);
  reap(lfo, depth);
}

/** tapping the pet: sometimes a meow or yip, sometimes a purr, often nothing.
    the roll is returned even when sound is off, so a speech bubble can still show */
export function petTap(kind: "cat" | "dog"): "meow" | "purr" | null {
  const r = Math.random();
  if (r < .3) {
    petPlay((o, t) => {
      if (kind === "cat") {
        const f = rand(560, 640);
        /* mee-ow: the mouth opens as the pitch lifts, closes as it falls */
        voice(o, t, { pitch: [[0, f], [.1, f * 1.3], [.34, f * .85]], mouth: [[0, 900], [.14, 1800], [.34, 1000]], dur: .36, lvl: .03 });
      } else {
        const f = rand(680, 760);
        voice(o, t, { pitch: [[0, f], [.04, f * 1.15], [.13, f * .75]], mouth: [[0, 1300], [.13, 900]], dur: .14, lvl: .026 });
      }
    });
    return "meow";
  }
  if (r < .6) {
    petPlay((o, t) => {
      if (kind === "cat") purr(o, t, rand(.9, 1.2), .03);
      else {
        /* a dog's contented chirp: a little nasal whine that lifts */
        voice(o, t, { pitch: [[0, 820], [.2, 1050]], mouth: [[0, 1100], [.2, 1500]], dur: .24, lvl: .012 });
      }
    });
    return "purr";
  }
  return null;
}

/** a tiny questioning mmrp? — the pet noticing the session paused */
export function petMrrp(kind: "cat" | "dog"): void {
  petPlay((o, t) => {
    if (kind === "cat") {
      voice(o, t, { pitch: [[0, 330], [.2, 500]], mouth: [[0, 650], [.2, 1500]], dur: .22, lvl: .026, trill: 30 });
    } else {
      voice(o, t, { pitch: [[0, 270], [.15, 400]], mouth: [[0, 700], [.15, 1100]], dur: .17, lvl: .022 });
    }
  });
}

/** a sleepy, content mrrr~ — waking up, stretching */
export function petMrrr(kind: "cat" | "dog"): void {
  petPlay((o, t) => {
    if (kind === "cat") {
      voice(o, t, { pitch: [[0, 310], [.25, 330], [.6, 240]], mouth: [[0, 900], [.6, 600]], dur: .62, lvl: .022, trill: 28 });
    } else {
      /* a dog's version is a long sigh with a little whine riding it */
      noise(o, t, { kind: "pink", type: "lowpass", f: 900, to: 300, Q: .5, lvl: .014, dur: .6, att: .12 });
      voice(o, t + .05, { pitch: [[0, 440], [.4, 320]], mouth: [[0, 1000], [.4, 700]], dur: .42, lvl: .008 });
    }
  });
}

/* ================= reward / event layer ================= */

/** the island's sonic signature: 1 = resume, 2 = focus start, 3 = a finished session */
export function signature(notes: 1 | 2 | 3): void {
  play((o, t) => sigAt(o, t, notes));
}

/** the signature, small and far away, for the splash */
export function splashSignature(): void {
  play((o, t) => sigAt(o, t, 3, .4, .16));
}

/** the start ritual: a low breath in, the lamp clicking on, dum — ding */
export function focusStart(): void {
  play((o, t) => {
    noise(o, t, { kind: "pink", type: "lowpass", f: 220, to: 900, Q: .5, lvl: .026, dur: .4, att: .22 });
    /* a small pull-chain switch: two contacts a hair apart */
    noise(o, t + .35, { type: "bandpass", f: 3200, Q: 1.6, lvl: .012, dur: .01, att: .001 });
    noise(o, t + .362, { type: "bandpass", f: 2300, Q: 1.4, lvl: .007, dur: .014, att: .001 });
    tone(o, t + .35, { f: 1100, to: 800, bendT: .02, lvl: .004, dec: .03, att: .001 });
    sigAt(o, t + .55, 2);
  });
}

/* E6 F#6 A6 B6: the sparks fly up the same scale the signature lives in */
const TINKS = [1318.51, 1479.98, 1760, 1975.53];

/** a spark flying to the counter; i nudges the pitch so a few don't stutter */
export function sparkTink(i: number): void {
  play((o, t) => {
    const n = Math.abs(Math.floor(i)) % TINKS.length;
    bell(o, t, TINKS[n] * rand(.997, 1.003), .01, .35);
  });
}

/** glass shimmer: a few high bells tumbling upward */
function shimmer(o: Out, t: number, lvl: number): void {
  [1318.51, 1760, 1975.53, 2637.02].forEach((f, i) => bell(o, t + i * .07 + rand(0, .015), f, lvl * (1 - i * .15), .9));
}

/** something new unlocked; a breath of silence first, then what it's made of */
export function unlock(cat: string, id?: string): void {
  play((o, t) => {
    switch (cat) {
      case "land": {
        /* the ground rising: a low whoom, then glass */
        noise(o, t, { kind: "brown", type: "lowpass", f: 120, to: 420, Q: .6, lvl: .045, dur: 1.1, att: .45 });
        tone(o, t, { f: 73.42, lvl: .025, dec: 1, att: .35 });
        shimmer(o, t + .6, .014);
        break;
      }
      case "buildings":
        knock(o, t, 240, .022); knock(o, t + .13, 215, .02); knock(o, t + .3, 250, .018);
        bell(o, t + .5, SIG.mid, .022, 1.2);
        sparkle(o, t + .7, SIG.high, .012);
        break;
      case "plants":
        rustle(o, t, 10, .3, .008, 2400, 5200);
        bell(o, t + .32, SIG.mid, .02, 1.1);
        sparkle(o, t + .5, SIG.high, .011);
        break;
      case "pets":
        bell(o, t, 1568, .016, .7);
        bell(o, t + .12, 2093, .01, .6);
        /* a pet bed is for sleeping — it gets the bells and no chirp */
        if (id !== "petbed") voice(o, t + .3, { pitch: [[0, 700], [.08, 950]], mouth: [[0, 1400], [.08, 2000]], dur: .1, lvl: .012 });
        break;
      default:
        shimmer(o, t, .016);
    }
  }, .22);
}

/** a streak kept: a soft fwoop and a glint; milestones get a short sting */
export function streak(milestone: boolean): void {
  play((o, t) => {
    noise(o, t, { kind: "pink", type: "bandpass", f: 300, to: 1500, Q: .9, lvl: .022, dur: .3, att: .16 });
    if (!milestone) { sparkle(o, t + .24, SIG.high, .012); return; }
    /* dum — ding — ✦, then the chord they were spelling, let ring */
    sigAt(o, t + .2, 3, .9, .18);
    for (const f of [587.33, 739.99, 880]) bell(o, t + .78, f, .011, 1.1);
  });
}

/** a new level: the signature stretched out — low, mid, then two glints */
export function levelUp(): void {
  play((o, t) => {
    mallet(o, t, SIG.low / 2, .02, .8);
    mallet(o, t, SIG.low, .032, .8);
    mallet(o, t + .2, 440, .03, .6);
    bell(o, t + .42, SIG.mid, .024, 1.3);
    bell(o, t + .62, 1174.66, .018, 1.2);
    sparkle(o, t + .84, SIG.high * 2, .01);
    sparkle(o, t + .9, 1760, .009);
  });
}
