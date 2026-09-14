// Capture Hearth Island itself for the store: stills per device class, and
// the app-preview footage. Nothing is mocked up — the real build (../dist,
// the single-file web app the iOS shell loads) is driven with Playwright on a
// seeded island, and Remotion only adds captions and a frame around it.
//
//   npm run capture                  # stills + footage
//   npm run capture -- --only=stills # or --only=preview
//
// Writes public/raw/<device>/<shot>.png and public/clips/preview.{mp4,json}.
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = path.resolve(here, "..");
const app = path.resolve(pkg, "..");
const html = path.join(app, "dist/index.html");
const remotion = path.join(pkg, "node_modules/.bin/remotion");
const only = process.argv.find(a => a.startsWith("--only="))?.slice(7);
if (!fs.existsSync(html)) { console.error("dist/index.html missing — run npm run build in island-app"); process.exit(1); }

const server = createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html" });
  fs.createReadStream(html).pipe(res);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
/* the app stamps days as y-m-d without padding (game/weather dayStamp) */
const now = new Date();
const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
/* late morning, so every screen is lit the way the island looks at its best */
const MORNING = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0, 0);

/* one well-loved island: the bridge built, two patches of land raised, a
   companion, a few weeks of focus behind it. Only catalogue pieces anyone
   can earn — nothing from the premium set. */
const ISLAND = {
  energy: 285, totalMin: 385, todayMin: 50, weekMin: 245, sessions: 23, daysActive: 7, streak: 9,
  lastDay: today, lastStreakDay: "2000-01-01", bridge: true, lands: ["land-east", "land-shoal"],
  placed: [
    { id: "house", x: 4, y: 3, rot: 0 },
    { id: "oak", x: 2, y: 3, rot: 0, stage: 2 },
    { id: "pine", x: 7, y: 1, rot: 0, stage: 2 },
    { id: "pine", x: 3, y: 1, rot: 0, stage: 1 },
    { id: "maple", x: 8, y: 5, rot: 0, stage: 2 },
    { id: "flowerpatch", x: 6, y: 5, rot: 0, stage: 2 },
    { id: "tulips", x: 2, y: 5, rot: 0, stage: 2 },
    { id: "sunflower", x: 7, y: 3, rot: 0, stage: 2 },
    { id: "bench", x: 3, y: 6, rot: 0 },
    { id: "lantern", x: 6, y: 2, rot: 0 },
    { id: "mailbox", x: 5, y: 6, rot: 0 },
    { id: "fence", x: 9, y: 4, rot: 0 },
    { id: "yarn", x: 4, y: 7, rot: 0 },
    { id: "torii", x: 5, y: 11, rot: 0 },
    { id: "bush", x: 4, y: 11, rot: 0, stage: 2 },
  ],
  inventory: [], cat: { x: 5, y: 5 }, pet: "cat", premium: false,
  guard: { dnd: true, block: true }, sound: false, radio: false, sfx: false, scape: "rainy",
  mix: { vol: .5, sea: .35, wind: .15, rain: .6, fire: .45, wild: .08, pet: .03 },
};

/* the phone fills the capture edge to edge; the dev time-warp button stays out of frame */
const CSS = `#phone{width:100vw!important;height:100dvh!important;border-radius:0!important;box-shadow:none!important}
  #demo-toggle{display:none!important}`;
const CSS_IPAD = `#demo-toggle{display:none!important}`;

async function openApp(ctx, { hash = "", query = "", save = ISLAND, css = CSS } = {}) {
  await ctx.addInitScript(([s, c]) => {
    localStorage.setItem("hearth-island-v1", s);
    localStorage.setItem("hearth-hint-orbit", "1");
    document.addEventListener("DOMContentLoaded", () => {
      const st = document.createElement("style"); st.textContent = c; document.head.appendChild(st);
    });
  }, [JSON.stringify(save), css]);
  await ctx.clock.install({ time: MORNING });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(base + query + hash);
  await page.waitForSelector(".screen.active");
  await page.evaluate(() => document.fonts.ready);
  page.errors = errors;
  return page;
}

/* Guideline 2.3.7: no prices and no "free" anywhere visible in store media */
async function guard(page, where) {
  const hits = await page.evaluate(() => {
    const bad = /(^|[^a-z])(free|discount|sale|trial)([^a-z]|$)|[$€£¥]\s?\d|\/\s?(month|year|mo|yr)\b/i;
    return [...document.querySelectorAll("body *")].filter(el => !el.children.length && bad.test(el.textContent || "")
      && el.getBoundingClientRect().height > 0).map(el => el.textContent.trim().slice(0, 60));
  });
  if (hits.length) throw new Error(`${where}: price wording on screen — ${hits.join(" | ")}`);
}

const browser = await chromium.launch({ channel: "chrome" });

/* ---------- stills ---------- */
const DEVICES = {
  iphone: { viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, css: CSS },
  ipad: { viewport: { width: 1032, height: 1376 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, css: CSS_IPAD },
};

const STILLS = {
  island: { hash: "#daysummer", wait: 2600 },
  focus: {
    hash: "#focus", wait: 400,
    run: async p => { await p.click("#btn-start"); await sleep(11500); },
  },
  reward: {
    hash: "#focus", query: "?demo=400",
    save: { ...ISLAND, totalMin: 190, energy: 170 },
    run: async p => {
      await p.evaluate(() => document.querySelector("#demo-toggle").click());
      await p.click('[data-min="15"]');
      await p.click("#btn-start");
      await p.waitForSelector("#screen-complete", { timeout: 30000 });
      await sleep(3200);
    },
  },
  decorate: {
    hash: "#shop", wait: 500,
    run: async p => { await p.click('[data-cat="plants"]'); await sleep(300); await p.click('[data-sel="mushrooms"]'); await sleep(2200); },
  },
  seasons: { hash: "#winternight", wait: 3200 },
  journey: { hash: "#profile", wait: 1800 },
};

if (only !== "preview") {
  for (const [dev, spec] of Object.entries(DEVICES)) {
    const dir = path.join(pkg, "public/raw", dev);
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, s] of Object.entries(STILLS)) {
      const ctx = await browser.newContext({ ...spec, css: undefined, locale: "en-US" });
      const page = await openApp(ctx, { hash: s.hash, query: s.query ?? "", save: s.save ?? ISLAND, css: spec.css });
      if (s.wait) await sleep(s.wait);
      if (s.run) await s.run(page);
      await guard(page, `${dev}/${name}`);
      await page.screenshot({ path: path.join(dir, `${name}.png`) });
      if (page.errors.length) console.warn(`  ${dev}/${name}: ${[...new Set(page.errors)].join(" | ")}`);
      await ctx.close();
      console.log(`${dev}/${name}`);
    }
  }
}

/* ---------- app preview footage ---------- */
if (only !== "stills") {
  /* Animations on: the app skips its launch and camera moves under a test
     driver, so hide that this is one. */
  await browser.close();
  const rec = await chromium.launch({ channel: "chrome", args: ["--disable-blink-features=AutomationControlled"] });
  const ctx = await rec.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: false, locale: "en-US" });
  const save = { ...ISLAND, totalMin: 190, energy: 170 };
  const page = await openApp(ctx, { query: "?demo=300", save });
  const frameDir = fs.mkdtempSync(path.join(os.tmpdir(), "hearth-rec-"));
  const frames = [];
  const cdp = await ctx.newCDPSession(page);
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    const file = path.join(frameDir, `f${String(frames.length).padStart(5, "0")}.jpg`);
    fs.writeFileSync(file, Buffer.from(data, "base64"));
    frames.push({ file, t: metadata.timestamp });
    void cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1170, maxHeight: 2532, everyNthFrame: 1 });
  const marks = {};
  const mark = n => { marks[n] = Date.now() / 1000; };
  const tile = (x, y) => page.evaluate(([a, b]) => window.__screenOfTile(a, b), [x, y]);

  mark("open");
  await sleep(3600);                                   /* the launch: ✦ → island → dive */
  /* a slow turn of the island, and a tap on the maple */
  await page.mouse.move(300, 420); await page.mouse.down();
  await page.mouse.move(235, 428, { steps: 22 }); await page.mouse.up();
  await sleep(1400);
  const maple = await tile(8, 5); await page.mouse.click(maple.x, maple.y);
  await sleep(1300);

  mark("focus");
  await page.click('[data-nav="focus"]');
  await sleep(900);
  /* the time warp is a dev switch; its toast has no place in the footage */
  await page.addStyleTag({ content: "#toast{visibility:hidden!important}" });
  await page.evaluate(() => document.querySelector("#demo-toggle").click());
  /* let it expire unseen, then toasts show again (the placement one belongs) */
  await page.evaluate(() => setTimeout(() => document.querySelectorAll("style").forEach(st => {
    if (st.textContent.includes("#toast{visibility")) st.remove();
  }), 2600));
  await page.click('[data-min="15"]');
  await sleep(500);
  await page.click("#btn-start");
  await page.waitForSelector("#screen-complete", { timeout: 30000 });
  mark("reward");
  await sleep(3600);

  mark("place");
  await page.click("#btn-reward-primary");
  await sleep(2600);
  const spot = await tile(6, 7); await page.mouse.click(spot.x, spot.y);
  await sleep(1700);

  mark("decorate");
  await page.click('[data-nav="shop"]');
  await sleep(700);
  await page.click('[data-cat="plants"]'); await sleep(350);
  await page.click('[data-sel="mushrooms"]'); await sleep(900);
  await page.click('[data-buy="mushrooms"]');
  await sleep(2200);
  mark("end");

  await guard(page, "preview");
  await cdp.send("Page.stopScreencast");
  await sleep(200);
  if (page.errors.length) console.warn(`  preview: ${[...new Set(page.errors)].join(" | ")}`);
  await ctx.close();
  await rec.close();

  /* frames arrive only when something changes, each stamped; lay them on a
     constant 30fps timeline by those stamps so motion keeps its real timing */
  const t0 = frames[0].t, endT = Math.max(marks.end, frames.at(-1).t + .1);
  const lines = ["ffconcat version 1.0"];
  frames.forEach((f, i) => lines.push(`file '${f.file}'`, `duration ${Math.max(.001, (i + 1 < frames.length ? frames[i + 1].t : endT) - f.t).toFixed(4)}`));
  lines.push(`file '${frames.at(-1).file}'`);
  const list = path.join(frameDir, "frames.ffconcat");
  fs.writeFileSync(list, lines.join("\n") + "\n");
  const outDir = path.join(pkg, "public/clips");
  fs.mkdirSync(outDir, { recursive: true });
  execFileSync(remotion, ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list,
    "-vf", "scale=1170:2532:flags=lanczos,format=yuv420p", "-r", "30", "-fps_mode", "cfr",
    "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-movflags", "+faststart", path.join(outDir, "preview.mp4")],
    { stdio: "inherit", cwd: pkg });
  const beats = Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, +Math.max(0, v - t0).toFixed(3)]));
  fs.writeFileSync(path.join(outDir, "preview.json"), JSON.stringify({ duration: +(endT - t0).toFixed(3), beats }, null, 2) + "\n");
  fs.rmSync(frameDir, { recursive: true, force: true });
  console.log(`preview: ${frames.length} frames, ${(endT - t0).toFixed(1)}s`);
} else {
  await browser.close();
}
server.close();
