// Renders assets/icon.png and assets/splash(-dark).png from the shapes in
// src/ui/brand.ts, so the app icon, the launch image and the in-app splash
// can never drift apart. Then: `npm run assets` to fan them out per platform.
//   node scripts/render-brand.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const src = readFileSync(new URL("../src/ui/brand.ts", import.meta.url), "utf8");
const K = {};
for (const m of src.matchAll(/export const (\w+) =\s*"([^"]+)"/g)) K[m[1]] = m[2];
for (const m of src.matchAll(/(\w+): "(#[0-9A-Fa-f]{6})"/g)) K[m[1]] = m[2];

/* the icon: deep plum, a cream-and-pink isle, one sprout, a gold ✦. No
   words, no gradient, nothing that turns to mush at 40px. */
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${K.plum}"/>
  <g transform="translate(50 58) scale(.8) translate(-50 -58)">
    <ellipse cx="50" cy="97" rx="20" ry="2.4" fill="#000" opacity=".18"/>
    <path d="${K.ISLE_BASE}" fill="${K.pink}"/>
    <path d="${K.ISLE_SHADE}" fill="${K.pinkShade}"/>
    <path d="${K.ISLE_TOP}" fill="${K.sand}"/>
    <ellipse cx="50" cy="56.5" rx="9" ry="3" fill="${K.grass}"/>
    <g transform="translate(50 56) scale(1.15) translate(-50 -50.5)">
      <path d="${K.SPROUT_STEM}" stroke="${K.grassDeep}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="${K.SPROUT_LEFT}" fill="${K.grass}"/>
      <path d="${K.SPROUT_RIGHT}" fill="${K.grass}"/>
    </g>
    <path d="${K.SPARK}" fill="${K.gold}" transform="translate(50 16) scale(.95)"/>
  </g>
</svg>`;

/* the launch image is the splash's first frame: cream, a ✦ dead centre,
   sized to match the in-app ✦ once the image is aspect-filled on a phone */
const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <rect width="2732" height="2732" fill="${K.cream}"/>
  <circle cx="1366" cy="1366" r="60" fill="rgba(227,168,62,.22)"/>
  <path d="${K.SPARK}" fill="${K.gold}" transform="translate(1366 1366) scale(4.6)"/>
</svg>`;

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
async function shot(svg, size, out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  await page.screenshot({ path: out, omitBackground: false });
}
await shot(icon, 1024, "assets/icon.png");
await shot(splash, 2732, "assets/splash.png");
await shot(splash, 2732, "assets/splash-dark.png");   /* the app has no dark theme */
writeFileSync("assets/icon.svg", icon);
await browser.close();
console.log("✓ assets/icon.png, splash.png, splash-dark.png");
