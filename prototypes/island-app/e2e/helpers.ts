import type { Page } from "@playwright/test";

export const KEY = "hearth-island-v1";

/** a known island, so a test never depends on whatever was played before */
export const SAVE = {
  energy: 500, totalMin: 800, todayMin: 20, weekMin: 120,
  sessions: 5, daysActive: 4, streak: 7, bridge: false,
  placed: [
    { id: "house", x: 4, y: 3, rot: 0 },
    { id: "oak", x: 2, y: 3, rot: 0, stage: 2 },
    { id: "rock", x: 7, y: 5, rot: 0 },
  ],
  inventory: [], cat: { x: 6, y: 5 }, pet: "cat", premium: false,
  guard: { dnd: true, block: false }, lands: [], sound: false, radio: false,
  mix: { vol: .5, sea: 1, wind: 1, rain: 1, fire: 1, wild: 1, pet: 1 },
};

const SCREEN: Record<string, string> = {
  "": "#screen-home", "#home": "#screen-home", "#shop": "#screen-shop",
  "#focus": "#screen-focus", "#profile": "#screen-profile",
};

/** open the app with a fresh, known save (sound off — no audio in CI) */
/** `extra.demo` unlocks the x60 time warp; everything else seeds the save */
export async function open(page: Page, hash = "", extra: Record<string, unknown> = {}): Promise<void> {
  /* seed only when the slot is empty: init scripts run on every navigation,
     so overwriting here would quietly undo whatever a reload is meant to test */
  await page.addInitScript(
    ([k, v]) => { if (!window.localStorage.getItem(k as string)) window.localStorage.setItem(k as string, v as string); },
    [KEY, JSON.stringify({ ...SAVE, ...extra, demo: undefined, lastDay: new Date().toISOString().slice(0, 10) })] as const,
  );
  /* the demo time-warp only renders when the URL asks for it */
  await page.goto((extra.demo ? "/?demo" : "/") + hash);
  await page.waitForSelector(SCREEN[hash] ?? "#screen-home");
  /* only Home hosts the world canvas */
  if ((SCREEN[hash] ?? "#screen-home") === "#screen-home") {
    await page.waitForSelector("#world-wrap canvas", { state: "attached" });
  }
  await page.waitForTimeout(400);            /* one sync + a frame */
}

/** The arrange button hides until you touch the island, so wake it first. */
export async function enterArrange(page: Page): Promise<void> {
  const box = (await page.locator("#world-wrap").boundingBox())!;
  await page.mouse.click(box.x + 8, box.y + 8);          /* open water, top-left */
  await page.click("#btn-arrange");
  await page.waitForTimeout(250);       /* the world reads arrange off a ref React fills on render */
}

export async function save(page: Page): Promise<Record<string, any>> {
  return JSON.parse(await page.evaluate(k => window.localStorage.getItem(k as string) ?? "{}", KEY));
}

/** where a grid tile lands on screen, through the world's own projection */
export async function tileXY(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ([tx, ty]) => (window as any).__screenOfTile(tx, ty) as { x: number; y: number },
    [x, y] as const,
  );
}

/** click the middle of a grid tile through the world's own projection */
export async function tapTile(page: Page, x: number, y: number): Promise<void> {
  const p = await page.evaluate(
    ([tx, ty]) => (window as any).__screenOfTile(tx, ty) as { x: number; y: number },
    [x, y] as const,
  );
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(250);
}
