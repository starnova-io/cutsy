# Hearth Island — App Store listing & Custom Product Pages

App **Hearth Island: Focus Timer** · Apple ID `6809866353` · Bundle `io.starnova.hearth` · Productivity

Everything here is copy-ready for App Store Connect. The market picks are
evidence-based; the reasoning is kept next to each so a later decision to drop
one is made on the argument, not on taste. Same house style as Cutsy's
STORE-LISTING.md.

---

## 1. The default listing (en-US)

**Name** (30) — `Hearth Island: Focus Timer`  ·  26 chars
**Subtitle** (30) — `Grow an island as you study`  ·  27 chars

The name leads with the brand, then spends its remaining room on the single
highest-volume category term, *focus timer*. The subtitle does not repeat a word
already in the name (Apple indexes the name for free) and instead buys three new
high-intent terms — *grow*, *island*, *study* — so the two fields together index:
hearth · island · focus · timer · grow · study.

**Keywords** (100, comma-separated, no spaces, never repeating a word already in
the name or subtitle — single tokens so Apple recombines them into phrases such
as "deep work", "focus habit", "study break" on its own):

```
pomodoro,concentration,productivity,deep,work,habit,calm,cozy,relax,plant,tree,break,mindful,adhd
```
97 chars. Covers the three demand pools a growing-focus app sits in at once:
the *productivity* pool (pomodoro, deep work, concentration, habit), the *calm /
cozy game* pool (calm, cozy, relax, plant, tree), and the *focus-help* pool
(mindful, adhd, break). No competitor brand names — Apple rejects trademarked
terms like "forest" in the keyword field.

**Promotional text** (170, editable without a new version — use it for seasonal
pushes and feature drops):

```
New: raise the Bridge and a whole new isle rises from the sea. The island lives with the seasons now — plant, build and grow it one focus session at a time.
```

**Description** (4000):

```
Start a focus session. When you finish, a tiny 3D island grows — and it keeps
living while you're away.

FOCUS → ENERGY → A LIVING WORLD

Hearth Island turns the minutes you focus into something you can see. Set a
timer, put the phone down, and do your work. Every focused minute earns one ✦ of
Focus Energy. Spend it to plant trees, build cottages, adopt a companion, and
raise whole new islands out of the sea.

Nothing here is bought with money. Focus Energy is earned only by focusing —
that is the whole point.

A WORLD THAT LIVES ON ITS OWN
• Real day and night, drifting clouds, and rain that ripples the sea
• Four seasons that follow your real calendar — spring blossom, summer
  fireflies, autumn leaves that fall and gather, winter snow on every roof
• A companion who wanders the island, plays with its yarn ball, and naps in
  its bed
• Plants that grow a stage with every session you complete

THE FOCUS THAT EARNS IT
• Simple sessions — pick a length, start, and focus
• Leave the app mid-session and it gently pauses instead of punishing you; a
  screen wake-lock keeps the phone awake while you work
• Optional Focus Shield quiets notifications for the length of a session
• Early ends still bank the minutes you focused — you are never punished for
  stopping

GROW THE ISLAND
• Plant flowers, bushes, pines, oaks and maples
• Build cottages, cabins, a greenhouse, a lighthouse and a dock
• Raise new land — Sunny Meadow, Quiet Cove, North Ridge — from open sea
• The flagship moment: build the Bridge and a brand-new isle rises, "New area
  discovered!", with more ground to make your own

FREE, AND ACTUALLY GENEROUS
The whole loop — focus, earn, plant, build, grow — is free. You can fill a
whole island without paying a cent.

HEARTH PREMIUM
Premium opens the full catalog — palms, campfires, wishing wells, cabins,
greenhouses, lighthouses, companion pieces, and new islands as they arrive.
Premium items still cost the Focus Energy you earn by focusing; money only opens
the catalog, it never buys progress.

$4.99/month, $29.99/year with a 7-day free trial, or $59.99 once for lifetime.

Everything lives on your device. No account, no sign-up, and your island is
never uploaded anywhere. Requires iOS 15 or later; the living 3D world needs a
device with WebGL2 (iPhone 8 and later).
```

**Support URL** — `https://starnova-io.github.io/hearth-island/`
**Marketing URL** — `https://starnova-io.github.io/hearth-island/`
**Privacy Policy URL** — `https://starnova-io.github.io/hearth-island/privacy.html`

**Category** — Primary: **Productivity**. Secondary: **Lifestyle**.
The app is a focus tool with a game layer, so it belongs in Productivity next to
the other grow-while-you-focus apps; Lifestyle is the natural second home for the
cozy/relaxing audience and adds a discovery surface.

**Age rating** — 4+. No objectionable content, no user-to-user content, no ads.

---

## 2. Custom Product Pages — which angle → which keyword, and why

Mechanics worth knowing before building: there are **70 CPP slots**; each CPP
holds up to **3 localizations and still counts as one slot**; since July 2025
CPPs also surface in organic search, with each keyword combination mapping to
exactly one page. So the keyword→page mapping is decided first, and every page
leads its screenshots and (optionally) promotional text with the promise that
matches the search that brought the visitor.

A focus app has three genuinely different buyers. We build one page per buyer,
not one per country, and localize each page into the markets where that buyer is
densest.

### The pages

| # | Page (angle) | Ranks for | Localizations | Hero (first 1–3 screenshots) |
|---|---|---|---|---|
| 1 | **Study / student** | study, exam, homework, study timer | en-US, en-GB, en-CA | A study session running; the island a little bigger after; "grow it while you revise" |
| 2 | **Deep work / pomodoro** | pomodoro, deep work, productivity, concentration | en-US, en-AU | A 50-min work session; Focus Shield on; the earned build |
| 3 | **Cozy / calm game** | cozy, calm, relax, wholesome | en-US, en-GB | The living island — seasons, companion, rain on the sea — with focus as the quiet hook |
| 4 | **Japan — 集中 / 勉強** | 集中, 勉強, ポモドーロ, 作業 | ja | Study-desk framing; the seasonal island; kawaii companion |
| 5 | **Korea — 집중 / 공부** *(wave 1.5)* | 집중, 공부, 뽀모도로, 스터디 | ko | 공부 study-session framing; the growing island as a reward |

### Per-angle notes

**1. Study / student — the biggest single intent.** "study timer" and gamified
study are among the highest-volume, highest-converting focus searches, and the
audience is exactly ours: someone who needs a reason to keep the phone down.
Lead the screenshots with a session in progress and the island one stage bigger
afterwards. English-speaking student markets (US/UK/CA) share creative cleanly.

**2. Deep work / pomodoro — the professional.** Motivation is *getting the hard
thing done*. Lead with a long session, the Focus Shield quieting notifications,
and the concrete thing the session built. Drier, calmer voice than the study
page. AU pairs with the US here: high iOS share, cheaper installs, same idiom.

**3. Cozy / calm game — the wholesome browser.** A large audience finds focus
apps by looking for something calm and alive, not by looking for productivity.
Lead entirely with the world — the seasons, the companion, rain rippling the
sea — and let focus be the gentle catch. UK over-indexes on this register.

**4. Japan — do this as a native ja page, not a translation.** Japan has a deep
study-tool and cozy-game culture and high iOS share; 集中 (focus) and 勉強
(study) are large evergreen searches. A machine-translated page in Japan reads
worse than no ja page at all — ship this once the copy is written by a native
speaker. ⚠️ "ポモドーロ" (pomodoro) is fine; avoid any trademarked competitor
name in the name/subtitle/keyword fields.

**5. Korea — wave 1.5.** Korea's study-focus culture (공부 시간표, 스터디 grids)
is a natural fit and 집중/공부 are high-volume, but ship it a beat behind Japan
with native ko copy for the same reason.

### Sequencing

Launch pages 1–3 (English) at the same time as the default listing, since they
share creative and cost nothing but slots. Add Japan (page 4) in wave 1.5 with
native copy, then Korea (page 5). Keep the default listing pointed at the widest
promise (focus + grow an island) and let each CPP win its narrower search.

---

## Sources & assumptions

- Apple — Custom Product Pages: 35 pages of screenshots, up to 3 localizations
  each, surfaced in organic search since July 2025 (App Store Connect Help).
- StatCounter — mobile OS share by country (iOS share highest in JP/CA/AU/UK/US
  among our target markets).
- Category & keyword demand pools inferred from the productivity / study-timer /
  cozy-game segments; confirm exact volumes with an ASO tool (AppTweak /
  MobileAction) before spending on Apple Search Ads.
