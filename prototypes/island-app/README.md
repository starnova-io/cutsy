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

The real calendar drives four seasons on the island:

- **Spring** (Mar–May) — fresh bright grass, blossom dots on oak and bush,
  pink petals drifting across the island.
- **Summer** (Jun–Aug) — the deep-green baseline; on clear and cloudy
  nights fireflies wander over the grass.
- **Autumn** (Sep–Nov) — deciduous leaves slowly turn from green to gold
  and rust, then detach and tumble down on the wind — more of them on a
  breezy cloudy day, only a few in the rain — and the grass dries to a
  warmer olive. Pines and palms stay evergreen.
- **Winter** (Dec–Feb) — snow blankets the grass, caps every roof, fence
  and tree, the water turns icy; "rain" days fall as silent snow, and on
  clear nights a bigger moon, denser stars and the odd shooting star.

Weather still modulates each season's particles (calm / breezy / rain).
Falling particles are one `InstancedMesh` (hundreds of leaves in a single
draw call); landed ones rest where they fell and build up a carpet before
slowly recycling. In leafy seasons, tapping an oak or bush (or a snowy
tree in winter) shakes it and sheds a burst of leaves — move those trees
via arrange mode. The sea is a small shader: gentle interference waves
plus expanding ripple rings when you tap the water or a leaf lands on it.

Demo helpers: the `Demo ×60` toggle on the Focus screen makes a minute pass
per second; URL hashes `#night`, `#rain`, `#dawn` preview ambience, and
`#spring` / `#summer` / `#autumn` / `#winter` force the season (combine
like `#winter-night`).

## Economy rules

One currency. 1 focused minute = 1 ✦. Energy is never for sale, premium only
opens the catalog (items still cost ✦), milestone unlocks arrive as gifts.
