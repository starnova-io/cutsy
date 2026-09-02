import { CATALOG, byId } from "./catalog";
import type { CatalogItem, GameState, PlacedItem } from "./types";
import { GW, GH, placeOK } from "../world/island";

export const inTier = (s: GameState, a: CatalogItem): boolean => s.premium || !a.premium;

export function nextUnlockInfo(s: GameState): { item: CatalogItem; left: number; pct: number } | null {
  const locked = CATALOG.filter(a => inTier(s, a) && a.unlock > s.totalMin).sort((a, b) => a.unlock - b.unlock);
  if (!locked.length) return null;
  const nxt = locked[0];
  const prev = Math.max(0, ...CATALOG.filter(a => inTier(s, a)).map(a => a.unlock).filter(u => u <= s.totalMin));
  return {
    item: nxt,
    left: nxt.unlock - s.totalMin,
    pct: Math.min(100, Math.round((s.totalMin - prev) / (nxt.unlock - prev) * 100)),
  };
}

export function newlyUnlocked(s: GameState, prevTotal: number): CatalogItem | null {
  const news = CATALOG.filter(a => inTier(s, a) && a.unlock > prevTotal && a.unlock <= s.totalMin)
                      .sort((a, b) => a.unlock - b.unlock);
  return news[0] ?? null;
}

export function itemFootprint(p: { id: string; rot: number }): { w: number; d: number } {
  const a = byId(p.id);
  return (p.rot % 2) ? { w: a.d, d: a.w } : { w: a.w, d: a.d };
}

export function occupied(s: GameState): Set<string> {
  const cells = new Set<string>();
  for (const p of s.placed) {
    const f = itemFootprint(p);
    for (let dx = 0; dx < f.w; dx++) for (let dy = 0; dy < f.d; dy++)
      cells.add((p.x + dx) + "," + (p.y + dy));
  }
  return cells;
}

export function fits(s: GameState, p: PlacedItem): boolean {
  const f = itemFootprint(p);
  const occ = occupied(s);
  for (let dx = 0; dx < f.w; dx++) for (let dy = 0; dy < f.d; dy++) {
    if (!placeOK(s, p.x + dx, p.y + dy)) return false;
    if (occ.has((p.x + dx) + "," + (p.y + dy))) return false;
  }
  return true;
}

export function firstFreeSpot(s: GameState, id: string): PlacedItem {
  const spots: { x: number; y: number; d: number }[] = [];
  for (let x = 0; x < GW; x++) for (let y = 0; y < GH; y++)
    if (placeOK(s, x, y)) spots.push({ x, y, d: Math.abs(x - 5) + Math.abs(y - 4) });
  spots.sort((a, b) => a.d - b.d);
  for (const sp of spots) {
    const p = { id, x: sp.x, y: sp.y, rot: 0 };
    if (fits(s, p)) return p;
  }
  return { id, x: 5, y: 4, rot: 0 };
}
