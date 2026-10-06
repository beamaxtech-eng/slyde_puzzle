# SLYDE â€” AI Agent Project Briefing
### Master context document for AI development agents

> **Purpose of this file:** Give an AI coding agent everything needed to continue
> developing this project autonomously: full context, locked decisions, current
> state, conventions, and the task roadmap. Read this file completely before
> writing any code.

---

## 1. Project Identity

| Field | Value |
|---|---|
| **Name** | Slyde (working name, not final) |
| **Type** | Mobile sliding-tile puzzle game |
| **Platforms** | iOS + Android via React Native (Expo managed workflow) |
| **MVP scope** | Fully local: no accounts, no backend, no monetization |
| **Repo** | Standalone (not part of any monorepo) |
| **Current phase** | Phase 0 + 1a delivered Â· Phase 1b next (see Â§8) |

**One-line pitch:** A tactile wooden sliding-puzzle game with 600 solver-verified
levels across three difficulty tracks, an auto-play "slideshow" flow, and
track-defined tile modes (numbers â†’ image+numbers â†’ image-only).

---

## 2. Design Pillars (never violate these)

1. **Tactile** â€” everything feels physical: wooden tiles, brass buttons, loud
   audio, strong haptics. Fake-3D via lighting, never perspective tilt on the
   interactive board (it breaks drag math).
2. **Effortless flow** â€” the game advances itself (auto-play). The player only
   ever solves puzzles. Every manual action cancels pending auto-flow timers.
3. **Fair, deterministic difficulty** â€” levels are pre-generated offline with
   seeded scrambles and solver-verified distances. Level N on track X is
   identical for every player, forever. Nothing difficulty-related is computed
   at runtime.
4. **Track identity** â€” difficulty tracks differ in *what you see*: Easy =
   numbers only, Medium = image + number badges, Hard = image only. Tile mode
   is NOT a player setting.

---

## 3. Gameplay Specification (LOCKED)

### 3.1 Structure — 600 levels
| Track | Chapter 1: levels 1–100 | Chapter 2: levels 101–200 | Tile mode |
|---|---|---|---|
| Easy | 3Ã—3 | 3Ã—4 | Numbers only |
| Medium | 4Ã—4 | 4Ã—5 | Image + number badge (top-left corner, brass pill) |
| Hard | 5Ã—5 | 5Ã—6 | Image only |

- Grids are **tall/portrait** (cols Ã— rows, rows â‰¥ cols).
- 200 levels per track; **each grid ("matrix") owns 100 levels**.
- Level 101 = "Chapter 2" milestone: bigger board, difficulty continues ramping up.
- Locked progression: level N+1 unlocks after completing level N.

### 3.2 Interaction
- **Drag:** tile adjacent to blank, drag â‰¥35% of a cell toward the blank,
  release â†’ snaps in. Tile lifts (âˆ’4px, scale 1.05, deeper shadow) while
  dragging. Movement constrained to the single axis toward the blank.
- **Tap:** finger travel < 8px on an adjacent tile â†’ slide it.
- **Single-tile slides ONLY.** No multi-tile row/column pushes (post-MVP).
- **Restart** (same seeded scramble, fresh timer, marked non-first-attempt).
  No undo. No hints (would need on-device solver â€” forbidden).

### 3.3 Timer (the ONLY fail condition)
- Every level, from level 1, has a countdown. Time-out = fail.
- Formula (pre-computed per level): `time = targetDistance Ã— M + 45s`
  where M = 4 (3Ã—3), 5 (3Ã—4), 6.5 (4Ã—4), 8 (4Ã—5), 11 (5Ã—5), 14 (5Ã—6).
- Warnings: tick each second at â‰¤10s; urgent double-beep + haptic + red
  screen-edge pulse each second at â‰¤5s; timer text flashes red at â‰¤15s.

### 3.4 Scoring & streak
- Per level: best time and best moves stored independently (each can improve
  separately).
- **Streak** = consecutive levels solved on FIRST attempt (no restart, no
  fail) within a track. Continues across Chapter 2. Resets to 0 on timer
  fail. Per-track.

### 3.5 Difficulty curve â€” Version B (LOCKED, per-track bands)
Bands are [startLvl, endLvl, minDistance, maxDistance]:

Within a band, target distance interpolates linearly by level. These values
live in ONE place: `src/config.ts` (app) and duplicated in
`tools/generate-levels/generate.ts` (generator). If ever changed, change BOTH.

---

## 4. Game Flow (auto-play â€” the defining UX)

**Rules:**
- Any manual input (buttons, back nav, node taps) cancels ALL pending
  auto-flow timers. Automation never fights the player.
- After level 200 → land on map (no level 201).
- Retry-on-fail restarts the SAME seeded scramble.
- Level map climbs UPWARD: level 1 at bottom, 200 at top. Chapter 2 gate
  plaque sits between nodes 100 and 101.

---

## 5. Architecture (current, as delivered in Phase 0)

### 5.1 Stack
| Layer | Choice |
|---|---|
| Framework | Expo (managed) + TypeScript |
| Navigation | @react-navigation/native-stack |
| State | Zustand (`src/store/app.ts`) |
| Storage | expo-sqlite (`src/db.ts`) â€” progress, bests, settings |
| Level data | `assets/levels.json` (static import; version 0 = stub fallback) |
| Board gestures (Phase 2) | DELIVERED with core RN only — `PanResponder` + `Animated`; rules in `src/components/tileGesture.ts` |
| Phase 4 will add | expo-av, expo-haptics |

### 5.2 File structure

### 5.3 Key mechanics the agent MUST preserve
- **Level determinism:** `mulberry32(seed)` + backward-move scramble from
  solved state (never random placement â€” half of random arrangements are
  unsolvable; backward moves guarantee solvability and determinism). Never
  undo the previous move during scrambling (prevents wasted displacement).
- **Dataset loading:** `src/data/levels.ts` prefers verified records from
  `levels.json`; falls back to `generateStubLevel()` while version is 0.
  When the real dataset is committed, stub mode disappears automatically.
- **SQLite schema:** `track_progress(track, unlocked, streak)`,
  `level_best(track, level, best_time, best_moves)`, `settings(key, value)`.
- **completeLevel()** in the store handles: min-merge of bests, streak
  increment (first attempts only), unlock advance, and persistence â€” all
  atomically. Screens must call it exactly once per win.

### 5.4 Level generator (Phase 1a, delivered)
`tools/generate-levels/generate.ts`:
- Run: `npx tsx tools/generate-levels/generate.ts --tracks=easy,medium --out=assets/levels.json`
- Verify-and-retry loop: scramble at estimated strength â†’ compute TRUE optimal
  distance (A* with Manhattan+LinearConflict for â‰¤16 cells; IDA* above) â†’
  accept if inside band, else adapt strength and retry (â‰¤80 attempts, all
  seeded by hash(seedBase, attempt) so results are machine-independent).
- Emits `levels.json` + console verification report (per-segment min/avg/max).
- **KNOWN LIMITATION:** Hard (5Ã—5/5Ã—6, distances up to 130) is too slow with
  current heuristics. Phase 1b adds Walking Distance + Inversion Distance
  heuristics for IDA*. Do NOT attempt `--tracks=hard` until 1b lands.

---

## 6. Visual & Audio Design System

### 6.1 Visual language â€” "wooden puzzle toy on a craftsman's table"
Reference implementation: the HTML prototype (v5.4) â€” ask the owner for
`slyde.html` if needed; it is the canonical visual reference.

| Surface | Treatment |
|---|---|
| Background | Dark wood (#432a14â€“#5c3a1e) with grain + vignette |
| Tiles | Light wood face (#e8c489), light bevel top-left, dark bevel bottom-right, gloss sheen overlay |
| Board | Carved tray: thick border (#6b4423), deep inner shadow |
| Cards / panels / chips | Wood ramp sampled from `assets/bg1.jpg` (#7c491e to #1d0c04) under a pane of liquid glass - rim drawn in SVG, depth as a dark band on the face padding (UI-SPEC 1.5) |
| Buttons | Brass gradient (#f9e2a8â†’#a86f24), depress 2â€“3px on press |
| Badges | Small brass pills (image+number mode) |
| Map nodes | 3D: carved socket + raised disc — green done + brass check badge / gold current + paw print (breathing halo, bob, shine) / recessed locked + drawn padlock, always visible |
| â˜… marker | Polished brass, animates along path |
| Text | Serif (Georgia); letterpress shadows |
| Color tokens | All in `src/theme.ts` (`C` object) â€” extend, don't hardcode |

Motion: tile snap ~130ms eased; screen fades ~550ms; marker glide ~900ms;
overlay fades 500ms.

### 6.2 Audio map (Phase 4 will implement with expo-av)
| Event | Sound |
|---|---|
| Tile slide | woody thock |
| Any button/toggle/tab/card/node tap | soft click (global listener pattern) |
| Screen change | rising whoosh |
| Locked node | low buzz |
| Level start | 2-note rising chime |
| Timer â‰¤10s (10â†’6) | tick per second; background music DUCKS to ~1/3 |
| Timer â‰¤5s (5â†’1) | urgent double-beep + haptic |
| Fail | loud falling tone |
| Win | 3-note rising chime |
| New personal best | 4-note fanfare (+0.6s after win chime) |
| Music | gentle plucked loop, own gain node, quiet bed under loud SFX; pauses on app background |
Settings: three independent toggles â€” music / sound / haptics. Sound=off also
stops music.

---

## 7. Data Contracts

### levels.json (generated, version â‰¥1)
`initialTiles`: array of length colsÃ—rows, values 1..(nâˆ’1), `0` = blank.

### Image packs
**50 images** in `assets/puzzles/` (`01.png`..`50.png`), indices **0-49**
(`PUZZLE_IMAGE_COUNT` in `src/config.ts`, mirrored by the generator). Image
assignment is FIXED per level (`imageIndex` from `imageIndexFor()` in
`src/config.ts`), cycling through the pack. 50 = one full cycle, so no two
neighbouring levels share a picture. Art is scaled to cover the board,
centre-cropped to the grid ratio, and sliced one cell per tile (each tile
draws its HOME cell, so solving reassembles the picture). Replace files in
place -- no code change; `src/data/puzzles.ts` is the registry (add/remove
rows there if the pack size changes, and update the modulus + regenerate the
dataset). The shipped pack is real art; `npm run generate:puzzles` fills only empty
slots unless you pass `--force`. See `assets/puzzles/README.md` for the spec.

---

## 8. Roadmap & Current Status

| Phase | Scope | Status |
|---|---|---|
| **0** | Expo scaffold, 7 screens, SQLite, Zustand, stub levels | âœ… **DONE** |
| **1a** | Generator with A*/IDA* verification (Easy+Medium) | âœ… **DONE** |
| **1b** | Walking Distance + Inversion Distance heuristics â†’ Hard dataset | â¬œ **NEXT** |
| **2** | Real puzzle board: gesture-handler drag+tap, Reanimated animations, tile lift, timer warning FX, full win/fail overlays | â¬œ |
| **3** | Winding-path level map (upward, marker, chapter gate, auto-scroll), auto-play flow engine, idle-aware fail gate, pre-level/leaderboard/settings polish | â¬œ |
| **4** | expo-av audio system (SFX + music + ducking), expo-haptics, wood component library finalization | â¬œ |
| **5** | Puzzle image pack + slicing (50 images in assets/puzzles/) DONE -- remaining: peek/win-reveal polish, icon/branding, timer playtest tuning, store release prep | partial |
| Post-MVP | Accounts, cloud leaderboard, photo uploads, monetization | Deferred by design |

**Critical path:** 1b â†’ 2 â†’ 3 â†’ 5 (Phase 4 can parallel 3/5).

---

## 9. Agent Working Rules

1. **Never change locked decisions** (Â§3, Â§4) without explicit owner approval.
   The Decision Log (Â§10) explains the rationale â€” if you believe a decision
   is wrong, raise it, don't silently change it.
2. **Single source of truth:** gameplay constants live in `src/config.ts`
   only (and duplicated in the generator â€” keep them in sync deliberately).
3. **Determinism is sacred:** any change to seed derivation, scramble logic,
   or RNG invalidates the dataset. If generation logic changes, the dataset
   MUST be regenerated and re-verified, and the owner must re-run the
   generator (it's their machine, their compute).
4. **Performance:** tile positioning must use GPU-composited transforms
   (Reanimated `translateX/Y`), never style props that trigger layout.
   Never run per-frame filters. Cache textures. (Prototype v5.1 learned this
   the hard way.)
5. **One phase at a time.** Deliver a phase, let the owner test on device,
   fix feedback, then proceed. Do not bundle Phase 2 and 3 together.
6. **Testable increments:** every deliverable must run via `npx expo start`
   on the owner's physical phone through Expo Go. If something needs a dev
   client or native build, flag it explicitly BEFORE implementing.
7. **Ask when ambiguous** on: visual feel, audio taste, difficulty feel,
   anything requiring assets (images/music) the agent cannot produce.
8. **Code style:** TypeScript strict, no default exports for utilities,
   functional components only, StyleSheet.create for styles, colors from
   `theme.ts`.
9. **The HTML prototype is the interaction/visual reference, not the
   implementation.** Port behavior, not code.
10. **No backend, no analytics, no network calls** in MVP code. Architecture
    must not BLOCK adding them later, but nothing may depend on them now.

---

## 10. Decision Log (why things are the way they are)

| # | Decision | Rationale |
|---|---|---|
| D1 | 600 levels (200/track — 100 per grid), grid switches at 101 | Chapter arc per track |
| D2 | Tall grids (3Ã—4 etc.) | Portrait phones, big tiles |
| D3 | Difficulty resets at level 101 | New board = new learning curve; continuing would spike |
| D4 | Tile mode fixed per track | Teaches image-solving progressively; removes player decision |
| D5 | Timer on EVERY level, formula-based | Uniform challenge; no per-level hand tuning |
| D6 | Per-grid multipliers 4â€“14 s/move + 45s | Flat rate unwinnable on 5Ã—6; humans need 1.5â€“2.5Ã— optimal moves |
| D7 | Auto-play flow everywhere | Zero-friction; player only solves |
| D8 | Idle-aware fail retry (5s gate) | Prevents silent infinite retries for idle players |
| D9 | Restart only (no undo/hints) | Honest scores; no on-device solvers |
| D10 | Retry = same seeded scramble | Fairness, identical puzzles for all |
| D11 | Map climbs upward, level 1 bottom | Progress = climbing; owner-specified |
| D12 | Home merged with track select | Owner-specified reference design |
| D13 | Loud sounds + warning audio + visual pulse | Fail must never surprise silently |
| D14 | Wood+3D visuals, NO perspective tilt | Lighting-based 3D preserves drag precision |
| D15 | JSON â†’ SQLite delivery; TS generator in-repo | Diffable, regenerable, CI-verifiable |
| D16 | IDA* + Walking Distance needed for 5Ã—5/5Ã—6 | Plain A* intractable (25!/2 â‰ˆ 10Â²â´ states) |
| D17 | Streak = consecutive first-attempt solves, per track | Clean honest metric |
| D18 | **Version B per-track difficulty curves** | Owner chose distinct track identities: Easy casual â†’ Hard boss-level (~130-move finale, ~31min limit) |
| D19 | Image index fixed per level | Consistent with seeded philosophy; collectible feel |
| D20 | 200 levels per track, 100 per grid (owner request) | Doubles the content; the chapter split moved 50 → 100 and each board keeps its own 100-level arc |
| D21 | 50-image pack (owner-supplied art) | Two full passes per 100-level chapter, no neighbouring repeats |

---

## 11. Known Issues / Gotchas

- **Prototype history (lessons):** v5.1 introduced 3 regressions (tiles
  stacked at origin â€” set `G.cell` before layout; missing number text;
  background-size broke image slicing). Root cause: perf refactor changed
  rendering invariants. When refactoring the board in Phase 2, re-test ALL
  three tile modes after ANY change.
- **Leaderboard/Settings screens** currently use `require('@react-navigation/native')`
  inline â€” a Phase 0 shortcut. Clean up to standard hook imports in Phase 3.
- **MapScreen** is the finished winding-path map: carved-groove trail with
  lit progress dashes, 3D socket nodes with drawn icons (`MapNode.tsx`),
  lantern-lit parallax backdrop (`MapBackdrop.tsx`), ★ marker +
  sparkle wake, auto-scroll, and the Phase 3 flow sequence.
- **Expo Go** cannot test some native modules; if Phase 4 audio needs
  formats Expo Go doesn't support, a dev client build will be required â€”
  flag to owner first.
- **Alert.prompt** doesn't exist on Android — destructive resets use the themed
  in-app `ConfirmDialog` instead of any native alert (already implemented).
- **Glass surfaces must never use `borderWidth` for their rim.** React Native
  paints a view's border *beneath* its children, so any child background
  swallows it — the rim goes invisible. `SurfacePaint` (ui.tsx) draws the rim
  inside the SVG instead, and renders depth as a dark band on the face's own
  padding. Similarly, keep `elevation` on a wrapper that has a
  `backgroundColor`, or Android casts no shadow at all.
- **Never pass an `rgba()` token straight to an SVG paint attribute.** This
  blanked the whole UI once: `react-native-svg` resolves an `rgba()` string in
  `stopColor` / `fill` / `stroke` to its RGB and **drops the alpha**, so
  `C.glassClear` (`rgba(255,255,255,0)`) became *opaque white* — and three
  full-surface gradient rects painted every card, panel and button white. Always
  go through `svgPaint()` (theme.ts), which returns `{ color, alpha }` for
  `stopColor` + `stopOpacity` / `fill` + `fillOpacity`. A `backgroundColor` on a
  plain `View` is unaffected and can keep using `rgba()` directly.
- **Never size a card or a preview from a hardcoded pixel budget.** The puzzle
  HUD's goal miniature assumed a fixed 72px box and the peek/win/fail cards were
  pinned to `width: 320`, but a HUD chip's real width comes from the row's flex,
  and `surfaceFace` clips overflow. On a narrow phone (or with Android's
  Display-size zoom) the miniature was therefore wider than its own chip and
  silently lost an outer column. Derive geometry from `useWindowDimensions()`
  instead (PuzzleScreen's `chipInnerW` / `cardW`; the Map's ladder is the same
  idea), and keep any constant the style sheet and the math share in one place at
  module scope so the two can't drift.

---

## 12. Owner Interaction Protocol

- The owner tests on a **physical Android phone via Expo Go**.
- Owner gives feedback in short, informal messages, sometimes with
  screenshots. Interpret generously; when a screenshot shows something
  unexpected (e.g., a "Share" button that isn't in the code), first suspect
  **browser/device UI captured in the screenshot**, not the app.
- When the owner reports a bug: diagnose with the reasoning shown, fix, and
  deliver either a targeted patch (small edits, clearly marked) or a full
  file re-send (their preference after copy-paste corruption incidents â€”
  they have had trouble with partial copies; **prefer complete files over
  diff instructions when in doubt**).
- Deliverables the owner must run themselves: the level generator (compute),
  Expo builds, store submissions, asset sourcing.

---

*End of briefing. Current dataset version: 1 (easy+medium committed, 200 levels/track; hard = stub fallback via generateStubLevel until Phase 1b). Next task: Phase 1b â€”
Walking Distance + Inversion Distance heuristics for the generator's IDA*
solver, enabling the Hard track dataset.*
