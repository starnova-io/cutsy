# Hearth Island

**Focus → Energy → Living World.** A tiny 3D island that grows when you focus.
Finish a session → earn ✦ (1 min = 1 ✦) → plant, build and unlock — and the
island lives on its own: real day/night, drifting clouds, rain, a companion
who wanders, plays with its yarn ball and naps in its bed, plants that grow a
stage with every completed session.

The flagship moment: **build the Bridge (✦100) and a new isle rises out of
the sea** — "New area discovered!" — with more land to decorate.

## Stack

Same shape as `sayly`: **React 18 + Vite + TypeScript (strict)**, no router
(screen state in `App.tsx`), no state library (`localStorage` + a tiny
`useSyncExternalStore` store), plus **three.js** for the world. Ships as one
self-contained HTML file (`vite-plugin-singlefile`) so it can be dropped
anywhere; Capacitor-ready for the native wrap.

```
src/
  game/    types, catalog, store, economy, weather, audio, actions
  world/   island mask/coords, low-poly builders, pet, world3d (three.js), wander (BFS strolls)
  screens/ Home · Focus · Complete · Shop (in-world preview) · Place · Profile · Paywall
  ui/      2D chibi mascots (focus vignette), toast/dialog/confetti bridges
```

- `world3d.ts` is imperative three.js behind a small callback interface; React
  talks to it through `WorldView` (one shared canvas re-parented per screen).
- Every asset is built from primitive geometry (boxes/cylinders/cones/spheres)
  in `builders.ts` — no model files; shop thumbnails are rendered from the
  same builders into a tiny offscreen renderer.
- Placement, BFS pet pathfinding and the economy are pure functions over the
  game state.

## Run

```
npm install
npm run dev        # vite dev server
npm run build      # tsc + vite → dist/index.html (single file)
```

The island is a real 3D scene: drag to orbit (and tilt), pinch or scroll to
zoom, double-tap to reset the camera — quick taps still pet the companion,
pick up items, and send the companion walking.

Demo helpers: the `Demo ×60` toggle on the Focus screen makes a minute pass
per second; URL hashes `#night`, `#rain`, `#dawn` preview ambience.

## Economy rules

One currency. 1 focused minute = 1 ✦. Energy is never for sale, premium only
opens the catalog (items still cost ✦), milestone unlocks arrive as gifts.
