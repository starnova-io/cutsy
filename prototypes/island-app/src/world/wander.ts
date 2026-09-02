/* The companion's own little life: BFS strolls over walkable tiles,
   yarn-ball play, naps in the pet bed. Runs alongside React; writes the
   resting tile back to the store quietly. */
import { getState, mutateQuiet } from "../game/store";
import { occupied } from "../game/economy";
import { walkOK, MASKS, BRIDGE_TILES } from "./island";
import { world, petView } from "./world3d";

export interface WanderCtx {
  worldVisible(): boolean;   /* home or shop screen showing */
  blocked(): boolean;        /* session running or placing */
}

let ctx: WanderCtx = { worldVisible: () => false, blocked: () => true };
export const setWanderCtx = (c: WanderCtx): void => { ctx = c; };

let petBusy = false;
const key = (x: number, y: number) => x + "," + y;

function floodFrom(cur: { x: number; y: number }) {
  const s = getState();
  const occ = occupied(s);
  const prev = new Map<string, { x: number; y: number } | null>();
  const dist = new Map<string, number>();
  const q = [cur];
  prev.set(key(cur.x, cur.y), null);
  dist.set(key(cur.x, cur.y), 0);
  while (q.length) {
    const c = q.shift()!;
    const d = dist.get(key(c.x, c.y))!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = c.x + dx, ny = c.y + dy, kk = key(nx, ny);
      if (!walkOK(s, nx, ny) || occ.has(kk) || prev.has(kk)) continue;
      prev.set(kk, c);
      dist.set(kk, d + 1);
      q.push({ x: nx, y: ny });
    }
  }
  return { prev, dist, occ };
}

function rebuild(prev: Map<string, { x: number; y: number } | null>, target: { x: number; y: number }) {
  const path: { x: number; y: number }[] = [];
  let c: { x: number; y: number } | null = target;
  while (c) { path.unshift({ x: c.x, y: c.y }); c = prev.get(key(c.x, c.y)) ?? null; }
  return path;
}

function freeNeighbors(pos: { x: number; y: number }, occ: Set<string>) {
  const s = getState();
  const out: { x: number; y: number }[] = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = pos.x + dx, ny = pos.y + dy;
    if (walkOK(s, nx, ny) && !occ.has(key(nx, ny))) out.push({ x: nx, y: ny });
  }
  return out;
}

/* a reachable tile at the water's edge, plus which side the water is on */
function pickShore(dist: Map<string, number>) {
  const isWater = (x: number, y: number) => {
    const kk = key(x, y);
    return !MASKS.main.has(kk) && !MASKS.islet.has(kk) && !BRIDGE_TILES.includes(kk);
  };
  const shores: { x: number; y: number; nx: number; ny: number }[] = [];
  for (const [kk, d] of dist) {
    if (d < 1 || d > 8) continue;
    const [x, y] = kk.split(",").map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (isWater(x + dx, y + dy)) { shores.push({ x, y, nx: x + dx, ny: y + dy }); break; }
    }
  }
  return shores.length ? shores[Math.floor(Math.random() * shores.length)] : null;
}

/** stroll to the shore, crouch, and lap at the water (little swirls included) */
export function petDrinkTrip(): boolean {
  if (petBusy || ctx.blocked()) return false;
  const { prev, dist } = floodFrom(curTile());
  const s = pickShore(dist);
  if (!s) return false;
  const path = rebuild(prev, s);
  petBusy = true;
  petView.napping = false;
  world.walkPath(path, () => {
    mutateQuiet(st => { st.cat = { x: s.x, y: s.y }; });
    petView.face = Math.atan2(s.nx - s.x, s.ny - s.y);
    world.petDrink(s.x + (s.nx - s.x) * .8 - 5, s.y + (s.ny - s.y) * .8 - 5.6);
    setTimeout(() => {
      petBusy = false;
      if (getState().placed.find(p => p.id === "petbed")) scheduleBedReturn();
    }, 3400);
  });
  return true;
}

function curTile() {
  const s = getState();
  const bed = s.placed.find(p => p.id === "petbed");
  return bed && petView.napping ? { x: bed.x, y: bed.y }
    : { x: Math.round(petView.x), y: Math.round(petView.y) };
}

export function petStroll(): void {
  if (petBusy || !ctx.worldVisible() || ctx.blocked()) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const s = getState();
  const bed = s.placed.find(p => p.id === "petbed");
  const yarn = s.placed.find(p => p.id === "yarn");
  if (bed && petView.napping && Math.random() < .5) return;
  const cur = curTile();
  const { prev, dist, occ } = floodFrom(cur);
  let path: { x: number; y: number }[] | null = null;
  let after: ((done: () => void) => void) | null = null;
  if (yarn && Math.random() < .45) {
    const spots = freeNeighbors(yarn, occ)
      .filter(t => (dist.get(key(t.x, t.y)) ?? 0) >= 1)
      .sort((a, b) => dist.get(key(a.x, a.y))! - dist.get(key(b.x, b.y))!);
    if (spots.length) {
      path = rebuild(prev, spots[0]);
      after = done => {
        petView.mode = "happy";
        petView.modeT = 2.4;
        world.setYarnWobble(2.4);
        (window as any).__yarnPlayed = Date.now();
        setTimeout(done, 2500);
      };
    }
  }
  if (!path && Math.random() < .3 && petDrinkTrip()) return;
  if (!path) {
    const cands: { x: number; y: number }[] = [];
    for (const [kk, d] of dist) if (d >= 1 && d <= 6) {
      const [x, y] = kk.split(",").map(Number);
      cands.push({ x, y });
    }
    if (!cands.length) return;
    path = rebuild(prev, cands[Math.floor(Math.random() * cands.length)]);
  }
  petBusy = true;
  petView.napping = false;
  world.walkPath(path, () => {
    const dest = path![path!.length - 1];
    mutateQuiet(st => { st.cat = { x: dest.x, y: dest.y }; });
    const finish = () => {
      petBusy = false;
      if (bed) scheduleBedReturn();
    };
    if (after) after(finish); else finish();
  });
}

function scheduleBedReturn(): void {
  setTimeout(() => {
    const s = getState();
    const b = s.placed.find(p => p.id === "petbed");
    if (!b || petView.napping || petBusy || ctx.blocked()) return;
    const { prev, dist, occ } = floodFrom({ x: Math.round(petView.x), y: Math.round(petView.y) });
    const spots = freeNeighbors(b, occ)
      .filter(t => dist.has(key(t.x, t.y)))
      .sort((a, c) => dist.get(key(a.x, a.y))! - dist.get(key(c.x, c.y))!);
    if (!spots.length) return;
    const path = rebuild(prev, spots[0]);
    path.push({ x: b.x, y: b.y });
    petBusy = true;
    world.walkPath(path, () => { petView.napping = true; petBusy = false; });
  }, 5000 + Math.random() * 4000);
}

export function petGoTo(x: number, y: number): void {
  const s = getState();
  if (petBusy || !walkOK(s, x, y) || occupied(s).has(key(x, y))) return;
  const { prev, dist } = floodFrom(curTile());
  if (!dist.has(key(x, y))) return;
  petBusy = true;
  petView.napping = false;
  const path = rebuild(prev, { x, y });
  world.walkPath(path, () => {
    mutateQuiet(st => { st.cat = { x, y }; });
    petBusy = false;
  });
}

export const isPetBusy = (): boolean => petBusy;

export function initPetPosition(): void {
  const s = getState();
  petView.x = s.cat.x;
  petView.y = s.cat.y;
  const bed = s.placed.find(p => p.id === "petbed");
  if (bed) { petView.x = bed.x; petView.y = bed.y; petView.napping = true; }
}

setInterval(() => { if (Math.random() < .65) petStroll(); }, 6000);

/* test hooks */
(window as any).petStroll = petStroll;
(window as any).__petView = petView;
import("./world3d").then(m => {
  (window as any).__cameraPose = () => m.world.cameraPose;
  (window as any).__screenOfTile = (x: number, y: number) => m.world.screenOfTile(x, y);
  (window as any).__seasonInfo = () => m.world.seasonInfo;
  (window as any).__autumnInfo = () => m.world.seasonInfo;
  (window as any).__petDrinkTrip = petDrinkTrip;
});
