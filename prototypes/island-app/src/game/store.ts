/* Sayly-style state: no state library — localStorage + a tiny
   subscribe/emit store consumed through useSyncExternalStore. */
import { useSyncExternalStore } from "react";
import { MIX_KEYS, type GameState, type MixPrefs } from "./types";
import { dayStamp } from "./weather";
import { fits } from "./economy";

const KEY = "hearth-island-v1";

function seedState(): GameState {
  return {
    energy: 140, totalMin: 185, todayMin: 85, weekMin: 145,
    sessions: 5, daysActive: 4, streak: 7,
    lastDay: dayStamp(), bridge: false,
    placed: [
      { id: "house",       x: 4, y: 3, rot: 0 },
      { id: "oak",         x: 2, y: 3, rot: 0, stage: 2 },
      { id: "pine",        x: 3, y: 6, rot: 0, stage: 2 },
      { id: "flowerpatch", x: 6, y: 6, rot: 0, stage: 2 },
      { id: "bush",        x: 7, y: 2, rot: 0, stage: 1 },
      { id: "rock",        x: 7, y: 5, rot: 0 },
      { id: "fence",       x: 2, y: 4, rot: 0 },
    ],
    inventory: [], cat: { x: 6, y: 5 }, pet: "cat", premium: false,
    guard: { dnd: true, block: false }, lands: [], sound: true, radio: false,
    mix: DEFAULT_MIX(), sfx: true, scape: "live",
  };
}

/** .5 is where the master already sat. The layers used to start at 100 each,
    which read as "everything maxed"; these read like a mix someone set, and
    ambience.ts scales them so they sound the way 100s used to (a calmer sea).
    a function, so nobody can mutate the defaults through a shared object */
export const DEFAULT_MIX = (): MixPrefs =>
  ({ vol: .5, sea: .35, wind: .15, rain: .6, fire: .45, wild: .08, pet: .03 });

/** set when load() had to put something right, so it gets written back out */
let repaired = false;

function load(): GameState {
  let s: GameState;
  try { s = JSON.parse(localStorage.getItem(KEY) || "") as GameState; } catch { s = seedState(); }
  if (!s || !Array.isArray(s.placed)) s = seedState();
  if (s.lastDay !== dayStamp()) { s.todayMin = 0; s.lastDay = dayStamp(); }
  if (!s.pet) s.pet = "cat";
  if (s.premium === undefined) s.premium = false;
  if (s.bridge === undefined) s.bridge = false;
  if (!s.guard) s.guard = { dnd: true, block: false };
  if (!Array.isArray(s.lands)) s.lands = [];
  if (s.sound === undefined) s.sound = true;
  if (!s.mix) s.mix = DEFAULT_MIX();
  /* the app closed while something was in mid-air: give it back. Where it came
     from is the only safe answer — the drop it was heading for never happened. */
  if (s.held) {
    if (s.held.origin) s.placed.push({ ...s.held.origin });
    else if (s.held.item) s.inventory.push(s.held.item.id);
    s.held = null;
    repaired = true;
  }
  /* the layers were on/off switches before they were faders */
  for (const k of MIX_KEYS) {
    const v = (s.mix as unknown as Record<string, unknown>)[k];
    if (typeof v === "boolean") (s.mix as unknown as Record<string, number>)[k] = v ? 1 : 0;
    else if (typeof v !== "number") (s.mix as unknown as Record<string, number>)[k] = 1;
  }
  if (typeof s.mix.vol !== "number") s.mix.vol = .5;
  /* saves from before soundscapes (no `scape` yet) whose layers were never
     touched still hold the old all-100 default — that meant "as it started",
     so give them the new start. anything customized is left alone. */
  if (s.scape === undefined && MIX_KEYS.every(k => s.mix[k] === 1)) {
    const d = DEFAULT_MIX();
    for (const k of MIX_KEYS) s.mix[k] = d[k];
  }
  if (s.sfx === undefined) s.sfx = true;
  if (!s.scape) s.scape = "live";
  if (s.radio === undefined) s.radio = false;
  /* older saves had no deciduous tree, so autumn/spring had nothing to shed —
     gift an oak (leaves and petals come from the island's own trees now) */
  if (!s.placed.some(p => p.id === "oak" || p.id === "bush")
    && !s.inventory.includes("oak") && !s.inventory.includes("bush")) {
    const oak = { id: "oak", x: 2, y: 3, rot: 0, stage: 2 };
    if (fits(s, oak)) s.placed.push(oak); else s.inventory.push("oak");
  }
  return s;
}

let state: GameState = load();
const listeners = new Set<() => void>();

function persist(): void {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
}
/* a rescued piece only exists in memory until something writes — and the next
   thing to write might be a long way off */
if (repaired) persist();

export function getState(): GameState { return state; }

/** Mutate + persist + notify React. */
export function mutate(fn: (s: GameState) => void): void {
  fn(state);
  state = { ...state };
  persist();
  listeners.forEach(l => l());
}

/** Persist without notifying React — for high-frequency world writes
    (the companion's resting tile) that nothing on screen reads live. */
export function mutateQuiet(fn: (s: GameState) => void): void {
  fn(state);
  persist();
}

export function resetState(): void {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
  state = seedState();
  persist();
  listeners.forEach(l => l());
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useGame(): GameState {
  return useSyncExternalStore(subscribe, getState);
}
