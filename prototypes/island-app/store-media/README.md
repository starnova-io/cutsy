# Hearth Island — store media

App Store screenshots and the app preview, composed with Remotion from real
captures of the app. Nothing is mocked: `capture` drives the built app
(`../dist/index.html`) on a seeded island; Remotion adds captions and a frame.

```
cd prototypes/island-app && npm run build   # the app the captures are taken from
cd store-media && npm install
npm run capture      # public/raw/{iphone,ipad}/*.png + public/clips/preview.{mp4,json}
npm run dev          # Remotion Studio — tweak captions/layout live
npm run render       # out/ — ready for App Store Connect
```

| Output | Size | App Store Connect slot |
|---|---|---|
| `out/iphone-6.9/1…6-*.png` | 1290×2796 | iPhone 6.9" |
| `out/iphone-6.5/1…6-*.png` | 1284×2778 | iPhone 6.5" (optional) |
| `out/ipad-13/1…6-*.png` | 2064×2752 | iPad 13" (required: the app runs on iPad) |
| `out/app-preview.mp4` | 886×1920, 30fps, ~27s | App Preview (iPhone 6.9") |

- Captions live in `src/shots.json`; upload order is `order` there (the first
  three show on the install sheet).
- Guideline 2.3.7: no prices or "free" — checked on screen at capture time and
  in the captions at render time; either failing stops the run.
- The preview's focus session runs on the dev time warp (`?demo=300`) so fifteen
  minutes fit; the frame shows "15 minutes later" while it does.

## What's New in 1.1 (copy for App Store Connect)

```
Your island feels alive now.

• A new look: a tiny island, a sprout and a spark
• Start a session and the room settles in — the lamp comes on, Mochi curls up
• Finish one and the sparks fly home: your island glows, Mochi celebrates
• New pieces arrive with their own little reveal on the island
• Soft, tactile sounds and five focus soundscapes — Rainy Cottage, Night Island and more
• Flick to spin your island, tap flowers, trees and the house to see what they do
• iPad: the island now fills the screen
• Fixes: the island framing, the Start button on smaller phones
```
