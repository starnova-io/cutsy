// Render every store asset, laid out the way App Store Connect asks for it.
//
//   npm run render                         # screenshots + preview
//   npm run render -- --only=screenshots   # or --only=preview
//
//   out/iphone-6.9/<n>-<shot>.png   1290x2796
//   out/iphone-6.5/<n>-<shot>.png   1284x2778
//   out/ipad-13/<n>-<shot>.png      2064x2752
//   out/app-preview.mp4             886x1920, 30fps, H.264 + silent AAC, 15–30s
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkg = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shots = JSON.parse(fs.readFileSync(path.join(pkg, "src/shots.json"), "utf8"));
const only = process.argv.find(a => a.startsWith("--only="))?.slice(7);
const DEVICES = [
  { dir: "iphone-6.9", id: "Screenshot-iphone-6-9", raw: "iphone" },
  { dir: "iphone-6.5", id: "Screenshot-iphone-6-5", raw: "iphone" },
  { dir: "ipad-13", id: "Screenshot-ipad-13", raw: "ipad" },
];

const missing = [];
if (only !== "preview") for (const d of DEVICES) for (const s of shots.order)
  if (!fs.existsSync(path.join(pkg, "public/raw", d.raw, `${s}.png`))) missing.push(`public/raw/${d.raw}/${s}.png`);
if (only !== "screenshots") for (const ext of ["mp4", "json"])
  if (!fs.existsSync(path.join(pkg, "public/clips", `preview.${ext}`))) missing.push(`public/clips/preview.${ext}`);
if (missing.length) { console.error(`Missing captures (npm run capture):\n  ${[...new Set(missing)].join("\n  ")}`); process.exit(1); }

console.log("Bundling…");
const serveUrl = await bundle({ entryPoint: path.join(pkg, "src/index.ts") });
const out = path.join(pkg, "out");

if (only !== "preview") for (const d of DEVICES) {
  const dir = path.join(out, d.dir);
  fs.mkdirSync(dir, { recursive: true });
  for (const [i, shot] of shots.order.entries()) {
    const inputProps = { shot };
    const composition = await selectComposition({ serveUrl, id: d.id, inputProps });
    const output = path.join(dir, `${i + 1}-${shot}.png`);
    await renderStill({ composition, serveUrl, inputProps, output, imageFormat: "png" });
    /* App Store Connect refuses screenshots with an alpha channel */
    execFileSync(path.join(pkg, "node_modules/.bin/remotion"), ["ffmpeg", "-y", "-loglevel", "error", "-i", output, "-pix_fmt", "rgb24", `${output}.tmp.png`], { cwd: pkg });
    fs.renameSync(`${output}.tmp.png`, output);
  }
  console.log(`${d.dir}: ${shots.order.length} screenshots`);
}

if (only !== "screenshots") {
  const composition = await selectComposition({ serveUrl, id: "AppPreview", inputProps: {} });
  const output = path.join(out, "app-preview.mp4");
  await renderMedia({ composition, serveUrl, inputProps: {}, outputLocation: output, codec: "h264", crf: 16,
    pixelFormat: "yuv420p", enforceAudioTrack: true, audioCodec: "aac", concurrency: 4 });
  const seconds = composition.durationInFrames / composition.fps;
  if (seconds < 15 || seconds > 30) { console.error(`app preview is ${seconds.toFixed(1)}s — App Store Connect takes 15–30s`); process.exitCode = 1; }
  console.log(`app-preview.mp4: ${seconds.toFixed(1)}s ${composition.width}x${composition.height}`);
}
