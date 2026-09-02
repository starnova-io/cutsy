/* Sayly-style state: no state library — localStorage + a tiny
   subscribe/emit store consumed through useSyncExternalStore. */
import { useSyncExternalStore } from "react";
import type { GameState } from "./types";
import { dayStamp } from "./weather";

const KEY = "hearth-island-v1";

function seedState(): GameState {
  return {
    energy: 140, totalMin: 185, todayMin: 85, weekMin: 145,
    sessions: 5, daysActive: 4, streak: 7,
    lastDay: dayStamp(), bridge: false,
    placed: [
      { id: "house",       x: 4, y: 3, rot: 0 },
      { id: "pine",        x: 3, y: 6, rot: 0, stage: 2 },
      { id: "flowerpatch", x: 6, y: 6, rot: 0, stage: 2 },
      { id: "bush",        x: 7, y: 2, rot: 0, stage: 1 },
      { id: "rock",        x: 7, y: 5, rot: 0 },
      { id: "fence",       x: 2, y: 4, rot: 0 },
    ],
    inventory: [], cat: { x: 6, y: 5 }, pet: "cat", premium: false,
  };
}

function load(): GameState {
  let s: GameState;
  try { s = JSON.parse(localStorage.getItem(KEY) || "") as GameState; } catch { s = seedState(); }
  if (!s || !Array.isArray(s.placed)) s = seedState();
  if (s.lastDay !== dayStamp()) { s.todayMin = 0; s.lastDay = dayStamp(); }
  if (!s.pet) s.pet = "cat";
  if (s.premium === undefined) s.premium = false;
  if (s.bridge === undefined) s.bridge = false;
  return s;
}

let state: GameState = load();
const listeners = new Set<() => void>();

function persist(): void {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

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
