import { expect, test } from "@playwright/test";
import { enterArrange, open, save, tapTile, tileXY } from "./helpers";

test("the island loads and the nav reaches every screen", async ({ page }) => {
  await open(page);
  await expect(page.locator("#energy-pill")).toHaveText("500");
  for (const [tab, screen] of [["shop", "#screen-shop"], ["profile", "#screen-profile"],
    ["focus", "#screen-focus"], ["home", "#screen-home"]] as const) {
    await page.click(`[data-nav="${tab}"]`);
    await expect(page.locator(screen)).toBeVisible();
  }
});

test("arrange: tap a piece, tap open ground, and it moves — no Done", async ({ page }) => {
  await open(page);
  await enterArrange(page);
  await tapTile(page, 7, 5);                        /* the rock */
  await expect(page.locator("#hold-bar")).toBeVisible();
  /* while it is held the island is one piece lighter */
  expect((await save(page)).placed).toHaveLength(2);
  await tapTile(page, 6, 2);                        /* free ground */
  await expect(page.locator("#hold-bar")).toBeHidden();
  const placed = (await save(page)).placed;
  expect(placed).toHaveLength(3);
  expect(placed.some((p: any) => p.id === "rock" && p.x === 6 && p.y === 2)).toBe(true);
});

test("arrange: an occupied tile keeps the piece in hand", async ({ page }) => {
  await open(page);
  await enterArrange(page);
  await tapTile(page, 7, 5);
  await tapTile(page, 4, 3);                        /* the house sits here */
  await expect(page.locator("#hold-bar")).toBeVisible();
  expect((await save(page)).placed).toHaveLength(2);
});

test("arrange: Put back returns the piece where it came from", async ({ page }) => {
  await open(page);
  await enterArrange(page);
  await tapTile(page, 7, 5);
  await page.click("#hold-bar .ghost");
  const placed = (await save(page)).placed;
  expect(placed).toHaveLength(3);
  expect(placed.some((p: any) => p.id === "rock" && p.x === 7 && p.y === 5)).toBe(true);
});

test("leaving arrange mode while holding never loses the piece", async ({ page }) => {
  await open(page);
  await enterArrange(page);
  await tapTile(page, 7, 5);
  await page.click("#btn-arrange");                 /* out of arrange, still holding */
  expect((await save(page)).placed).toHaveLength(3);
});

test("shop: buying puts the piece straight on the island", async ({ page }) => {
  await open(page, "#shop");
  const before = (await save(page)).energy;
  await page.click('[data-sel="rock"]');        /* the Shop picks first, then buys */
  await page.click('[data-buy="rock"]');
  await page.waitForTimeout(300);
  const s = await save(page);
  expect(s.placed).toHaveLength(4);             /* buyAndPlace lands it on the ghost */
  expect(s.energy).toBeLessThan(before);
});

test("a piece from the inventory is placed by tapping, not by a Done button", async ({ page }) => {
  await open(page, "#shop", { inventory: ["rock"] });
  await page.click('[data-sel="rock"]');
  await page.click('[data-place="rock"]');
  await expect(page.locator("#screen-home")).toBeVisible();
  await expect(page.locator("#hold-bar")).toBeVisible();
  await tapTile(page, 6, 2);
  await expect(page.locator("#hold-bar")).toBeHidden();
  const s = await save(page);
  expect(s.inventory).toHaveLength(0);
  expect(s.placed.some((p: any) => p.id === "rock" && p.x === 6 && p.y === 2)).toBe(true);
});

test("focus: a session can be started, paused and ended", async ({ page }) => {
  await open(page, "#focus");
  await page.click('[data-min="15"]');
  await page.click("#btn-start");
  await expect(page.locator("#btn-pause")).toBeVisible();
  await page.click("#btn-pause");
  await expect(page.locator("#btn-pause")).toHaveText("Resume");
  await page.click("#btn-pause");
  await page.click("#btn-end");
  await page.click("#dlg-ok");                  /* leaving asks first */
  await expect(page.locator("#screen-home")).toBeVisible();
});

test("the sound mixer writes every fader and survives a reload", async ({ page }) => {
  await open(page, "#profile", { sound: true });   /* the card is inert with sound off */
  await page.locator("#mix-vol").fill("30");
  await page.locator(".mix-row", { hasText: "Companion" }).locator("input").fill("0");
  await page.waitForTimeout(200);
  let s = await save(page);
  expect(s.mix.vol).toBeCloseTo(.3, 2);
  expect(s.mix.pet).toBe(0);
  await page.reload();
  await page.waitForSelector("#screen-profile");
  await expect(page.locator(".mix-row", { hasText: "Companion" }).locator(".mix-num")).toHaveText("off");
  await page.click("#mix-reset");
  s = await save(page);
  expect(s.mix.pet).toBe(1);
  expect(s.mix.vol).toBeCloseTo(.5, 2);
});

test("tapping a tree shakes it instead of picking it up", async ({ page }) => {
  await open(page);
  await tapTile(page, 2, 3);                        /* the oak */
  await expect(page.locator("#hold-bar")).toBeHidden();
  expect((await save(page)).placed).toHaveLength(3);
});

test("a held piece can be rotated, and the rotation is what lands", async ({ page }) => {
  await open(page, "#shop", { inventory: ["dock"], premium: true });  /* 2x1: rotation shows */
  await page.click('[data-sel="dock"]');
  await page.click('[data-place="dock"]');
  await page.click("#hold-bar .btn:not(.ghost)");        /* Rotate */
  await page.waitForTimeout(150);
  await tapTile(page, 5, 6);
  const placed = (await save(page)).placed.find((p: any) => p.id === "dock");
  expect(placed?.rot).toBe(1);
});

test("dragging a held piece and letting go drops it there", async ({ page }) => {
  await open(page);
  await enterArrange(page);
  await tapTile(page, 7, 5);                             /* lift the rock */
  await expect(page.locator("#hold-bar")).toBeVisible();
  const from = await tileXY(page, 7, 5), to = await tileXY(page, 6, 2);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 8 });
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  await expect(page.locator("#hold-bar")).toBeHidden();
  const placed = (await save(page)).placed;
  expect(placed).toHaveLength(3);
  expect(placed.some((p: any) => p.id === "rock" && p.x === 6 && p.y === 2)).toBe(true);
});

test("a finished session pays out and its gift can be placed", async ({ page }) => {
  test.setTimeout(90_000);
  await open(page, "#focus", { demo: true });
  await page.click("#demo-toggle");                      /* a minute a second */
  await page.click('[data-min="15"]');
  await page.click("#btn-start");
  await page.waitForSelector("#screen-complete", { timeout: 60_000 });
  const after = await save(page);
  expect(after.energy).toBeGreaterThan(500);
  expect(after.sessions).toBe(6);
});
