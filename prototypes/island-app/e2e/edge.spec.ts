import { expect, test } from "@playwright/test";
import { enterArrange, open, save, tapTile } from "./helpers";

test("a piece being held survives a reload", async ({ page }) => {
  await open(page);
  await enterArrange(page);
  await tapTile(page, 7, 5);
  await expect(page.locator("#hold-bar")).toBeVisible();
  await page.reload();
  await page.waitForSelector("#world-wrap canvas", { state: "attached" });
  await page.waitForTimeout(400);
  const s = await save(page);
  const rock = [...s.placed, ...(s.inventory ?? []).map((id: string) => ({ id }))]
    .some((p: any) => p.id === "rock");
  expect(rock, "the rock must not vanish when the app restarts mid-move").toBe(true);
});

test("a piece being held survives a trip to another screen", async ({ page }) => {
  await open(page);
  await enterArrange(page);
  await tapTile(page, 7, 5);
  await page.click('[data-nav="shop"]');
  await page.click('[data-nav="home"]');
  await page.waitForTimeout(300);
  await expect(page.locator("#hold-bar")).toBeVisible();
  await tapTile(page, 6, 2);
  expect((await save(page)).placed).toHaveLength(3);
});
