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
via arrange mode. The sea is alive twice over: a surface shader
(interference waves + expanding ripple rings on taps and leaf landings)
backed by a real GPU fluid simulation — velocity and pressure fields on
ping-pong half-float render targets (advection, divergence, a Jacobi
pressure solve, gradient subtraction) with a dye field advected along the
flow. Sweeping a finger or pointer across open water stirs milky swirls
that drift and dissipate; taps and landing leaves splat into the same
fluid. On rainy days the drops pepper the sea with little stirs and the
odd foam ring, and every so often the companion strolls to the water's
edge, crouches, and laps at the sea — each lap sends out a small swirl.
Requires WebGL2; the surface shader alone is the fallback.

## Land expansions

The island itself is now a progression track: the Land tab in the shop
sells patches of new ground — Sunny Meadow (east, 80), Quiet Cove
(west, 120), North Ridge (160) — that rise from the sea with ripples,
splashes and confetti when you tap Raise, then grow their own beach,
coastline bumps, grass and scatter. South Shoal is a free milestone
gift at 260 total focused minutes, delivered on the session-complete
screen like other milestone rewards. New land is immediately walkable
and placeable; the camera frames the larger island automatically.

## CC0 model trial (Kenney)

The main house is now a real modelled cottage from Kenney's City Kit
Suburban (CC0 — license text ships next to the asset in `src/assets/`),
loaded via GLTFLoader from a data-URI so the single-file build stays
self-contained. The shared Kenney palette texture is hue-remapped at
build time into the Fig & Marigold family (teal roof gradients to leafy
green, lavender trims to warm wood, window blues to pale glass), so the
asset reads as ours. `src/world/glb.ts` swaps loaded models in for
their catalog ids; anything not loaded keeps its procedural builder.
Kenney's Nature Kit trees were evaluated and skipped — the procedural
leaf-cloud trees are richer.

## Focus shield

Leaving the app mid-session gently auto-pauses it — the island just
waits, a toast welcomes you back, and the complete screen reports either
"Deep focus" or how many times you stepped away. A screen wake lock keeps
the phone awake through the session. Two toggles on the Focus screen —
"Silence notifications" and "Shield distracting apps" — persist in the
save and drive the native FocusGuard plugin on phone builds (Do Not
Disturb + a cozy overlay covering blocked apps on Android; sources and
setup in `native/android/`, iOS Screen Time notes included). On the web
they no-op via `src/native/guard.ts`.

Demo helpers: the `Demo ×60` toggle on the Focus screen makes a minute pass
per second; URL hashes `#night`, `#rain`, `#dawn` preview ambience, and
`#spring` / `#summer` / `#autumn` / `#winter` force the season (combine
like `#winter-night`).

## Economy rules

One currency. 1 focused minute = 1 ✦. Energy is never for sale, premium only
opens the catalog (items still cost ✦), milestone unlocks arrive as gifts.
