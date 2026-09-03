import { byId } from "./catalog";
import { getState, mutate } from "./store";
import { dayStamp } from "./weather";
import { chime, plink } from "./audio";
import { newlyUnlocked } from "./economy";
import { world } from "../world/world3d";
import type { CompletePayload, PlacedItem } from "./types";

/** Bank a finished (or early-ended) session; returns what the complete screen shows. */
export function completeSession(minutes: number, full: boolean, leaves = 0): CompletePayload {
  const prevTotal = getState().totalMin;
  mutate(s => {
    s.energy += minutes;
    s.totalMin += minutes;
    s.todayMin += minutes;
    s.weekMin += minutes;
    s.sessions += 1;
    s.placed.forEach(p => { if (byId(p.id).cat === "plants") p.stage = Math.min(2, (p.stage ?? 0) + 1); });
    if (s.lastStreakDay !== dayStamp()) {
      if (s.lastStreakDay) s.streak += 1;
      s.lastStreakDay = dayStamp();
      s.daysActive = Math.min(7, s.daysActive + 1);
    }
  });
  chime();
  return { minutes, full, item: newlyUnlocked(getState(), prevTotal), leaves };
}

/** Build the bridge: spends energy, reveals the isle. Returns false if unaffordable. */
export function buildBridge(): boolean {
  const s = getState();
  const a = byId("bridge");
  if (s.bridge || s.energy < a.price) return false;
  mutate(st => { st.energy -= a.price; st.bridge = true; });
  plink(); chime();
  world.revealIslet();
  return true;
}

/** Buy a normal item and drop it at the given spot. */
export function buyAndPlace(id: string, spot: PlacedItem): boolean {
  const a = byId(id);
  const s = getState();
  if (s.energy < a.price) return false;
  mutate(st => {
    st.energy -= a.price;
    st.placed.push({ ...spot });
  });
  plink();
  return true;
}

/** A milestone gift or inventory item placed via the placement screen. */
export function commitPlacement(placing: PlacedItem): void {
  mutate(s => { s.placed.push({ ...placing }); });
}

export function pickUpPlaced(idx: number): PlacedItem | null {
  const s = getState();
  if (idx < 0 || idx >= s.placed.length) return null;
  const item = { ...s.placed[idx] };
  mutate(st => { st.placed.splice(idx, 1); });
  return item;
}
