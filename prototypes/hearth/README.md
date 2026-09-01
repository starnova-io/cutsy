# Hearth — cozy isometric focus prototype

A tiny 2D isometric world that grows when you focus.
The loop: **FOCUS → EARN → UNLOCK → DECORATE → RETURN**.

Everything lives in one self-contained `index.html` — no build step, no
dependencies. Open it in a browser (best at phone width) or serve the folder
statically.

## What works

- **Home** — the isometric room is the screen: streak, today's minutes, next
  unlock, and your companion (tap them for a happy hop).
- **Focus** — 15/25/50-minute sessions with pause and early-end (early ends
  still bank the minutes — never punish). A `DEMO ×60` toggle makes a minute
  pass per second so the loop can be felt in seconds.
- **Completion** — confetti, `+N Focus Energy`, and the milestone item as a
  gift with PLACE IT.
- **Shop** — six categories; locked items say "Focus N min to unlock" instead
  of a padlock.
- **Placement** — items snap to the isometric grid, with rotate (mirror) and
  occupancy checks.
- **Economy** — one currency, 1 focused minute = 1 Focus Energy. Unlock
  thresholds follow total minutes focused. Room can grow (Room Corner).
- **Premium (mock paywall)** — six premium items (Stone Hearth, Koi Pond,
  Parlor Palm, Cozy Armchair, Wooden Radio, Candle Trio) sit behind a
  subscription. The paywall (Shop banner or Profile) offers monthly $4.99 /
  yearly $29.99 with 7-day trial / lifetime $59.99. Core rule: money only
  opens the catalog — premium items still cost Focus Energy, Energy is never
  for sale, and premium items never appear as milestone gifts for free users.
  Subscribing is simulated (no billing); Profile can cancel the demo
  membership.
- **Companion** — choose Mochi the cat or Miso the dog (Profile or Shop →
  Pets). Once a Pet Bed is placed, the companion naps in it; a tap wakes them.
- **Reward audio** — a soft WebAudio chime on completion (no audio assets).
- **State** — persisted in `localStorage`; "Reset prototype data" lives in
  Profile.

## Install as an app (PWA)

`manifest.webmanifest` + `icon-512.png` make the page installable: serve the
folder over HTTPS, open it on a phone, and use "Add to Home Screen" — it then
runs standalone with the Hearth icon. No service worker yet, so it needs a
network connection to load.

For a true native wrap, follow the same recipe as `sayly`: a Capacitor shell
around this page, with the focus-session app-blocking implemented natively
(Screen Time / `FamilyControls` on iOS).

## Architecture notes

- Game data and rendering are separated: `CATALOG` holds
  `{id, name, category, price, unlock, gridSize}`; the world renderer resolves
  assets by id from the `DRAW` table.
- All ~18 assets are drawn procedurally from one `box()` iso projection
  helper, so every object shares the same perspective and light.
- App blocking during focus is conceptual here; on device it would use the
  Screen Time / Focus APIs (iOS) or Focus mode / UsageStats (Android).
