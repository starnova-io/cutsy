import type { GameState } from "../game/types";

/* logical grid 11 × 13; the main island fills the top, the bridgeable
   isle sits across the water at the bottom */
export const GW = 11, GH = 13;

export const MASKS = (() => {
  const main = new Set<string>(), islet = new Set<string>();
  for (let x = 0; x < GW; x++) for (let y = 0; y <= 8; y++) {
    const dx = (x - 5) / 4.7, dy = (y - 4) / 3.9;
    const w = Math.sin(x * 12.9898 + y * 78.233) * 0.05;
    if (dx * dx + dy * dy <= 1 + w) main.add(x + "," + y);
  }
  main.add("5,8");
  /* fill single-tile holes so the coastline reads clean */
  for (let x = 1; x < GW - 1; x++) for (let y = 1; y < 8; y++) {
    const k = x + "," + y;
    if (main.has(k)) continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => main.has((x + dx) + "," + (y + dy))).length;
    if (n >= 3) main.add(k);
  }
  for (let x = 3; x <= 7; x++) for (let y = 10; y < GH; y++) {
    const dx = (x - 5) / 1.95, dy = (y - 11) / 1.4;
    if (dx * dx + dy * dy <= 1.05) islet.add(x + "," + y);
  }
  return { main, islet };
})();

export const BRIDGE_TILES = ["5,9"];

export const placeOK = (s: GameState, x: number, y: number): boolean =>
  MASKS.main.has(x + "," + y) || (s.bridge && MASKS.islet.has(x + "," + y));

export const walkOK = (s: GameState, x: number, y: number): boolean =>
  placeOK(s, x, y) || (s.bridge && BRIDGE_TILES.includes(x + "," + y));

export const isBeach = (x: number, y: number): boolean => {
  const k = x + "," + y;
  const m = MASKS.main.has(k) ? MASKS.main : MASKS.islet.has(k) ? MASKS.islet : null;
  if (!m) return false;
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !m.has((x + dx) + "," + (y + dy)));
};

/* grid → world coordinates (island roughly centered on origin) */
export const WCX = (x: number, w = 1): number => x + (w - 1) / 2 - 5;
export const WCZ = (y: number, d = 1): number => y + (d - 1) / 2 - 5.6;
