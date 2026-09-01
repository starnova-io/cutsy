# Hearth — cozy isometric focus prototype

A tiny 2D isometric world that grows when you focus.
The loop: **FOCUS → EARN → UNLOCK → DECORATE → RETURN**.

Everything lives in one self-contained `index.html` — no build step, no
dependencies. Open it in a browser (best at phone width) or serve the folder
statically.

## What works

- **Home** — the isometric room is the screen: streak, today's minutes, next
  unlock, and Mochi the cat (tap her).
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
- **State** — persisted in `localStorage`; "Reset prototype data" lives in
  Profile.

## Architecture notes

- Game data and rendering are separated: `CATALOG` holds
  `{id, name, category, price, unlock, gridSize}`; the world renderer resolves
  assets by id from the `DRAW` table.
- All ~18 assets are drawn procedurally from one `box()` iso projection
  helper, so every object shares the same perspective and light.
- App blocking during focus is conceptual here; on device it would use the
  Screen Time / Focus APIs (iOS) or Focus mode / UsageStats (Android).
