Here's a complete **AI Agent Briefing Document** — designed to be dropped into the repo root (e.g., as `AGENT.md` or `CLAUDE.md`) so any AI coding agent (Claude Code, Cursor, Copilot Workspace, etc.) can pick up the project and continue development with full context. Save it as `AGENT.md` in your repo:

```markdown
# SLYDE — AI Agent Project Briefing
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
| **Current phase** | Phase 0 + 1a delivered · Phase 1b next (see §8) |

**One-line pitch:** A tactile wooden sliding-puzzle game with 600 solver-verified
levels across three difficulty tracks, an auto-play "slideshow" flow, and
track-defined tile modes (numbers → image+numbers → image-only).

---

## 2. Design Pillars (never violate these)

1. **Tactile** — everything feels physical: wooden tiles, brass buttons, loud
   audio, strong haptics. Fake-3D via lighting, never perspective tilt on the
   interactive board (it breaks drag math).
2. **Effortless flow** — the game advances itself (auto-play). The player only
   ever solves puzzles. Every manual action cancels pending auto-flow timers.
3. **Fair, deterministic difficulty** — levels are pre-generated offline with
   seeded scrambles and solver-verified distances. Level N on track X is
   identical for every player, forever. Nothing difficulty-related is computed
   at runtime.
4. **Track identity** — difficulty tracks differ in *what you see*: Easy =
   numbers only, Medium = image + number badges, Hard = image only. Tile mode
   is NOT a player setting.

---

## 3. Gameplay Specification (LOCKED)

### 3.1 Structure — 600 levels
| Track | Chapter 1: levels 1–100 | Chapter 2: levels 101–200 | Tile mode |
|---|---|---|---|
| Easy | 3×3 | 3×4 | Numbers only |
| Medium | 4×4 | 4×5 | Image + number badge (top-left corner, brass pill) |
| Hard | 5×5 | 5×6 | Image only |

- 200 levels per track; **each grid ("matrix") owns 100 levels**.
- Grids are **tall/portrait** (cols × rows, rows ≥ cols).
- Level 101 = "Chapter 2" milestone: bigger board, difficulty continues ramping up.
- Locked progression: level N+1 unlocks after completing level N.

### 3.2 Interaction
- **Drag:** tile adjacent to blank, drag ≥35% of a cell toward the blank,
  release → snaps in. Tile lifts (−4px, scale 1.05, deeper shadow) while
  dragging. Movement constrained to the single axis toward the blank.
- **Tap:** finger travel < 8px on an adjacent tile → slide it.
- **Single-tile slides ONLY.** No multi-tile row/column pushes (post-MVP).
- **Restart** (same seeded scramble, fresh timer, marked non-first-attempt).
  No undo. No hints (would need on-device solver — forbidden).

### 3.3 Timer (the ONLY fail condition)
- Every level, from level 1, has a countdown. Time-out = fail.
- Formula (pre-computed per level): `time = targetDistance × M + 45s`
  where M = 4 (3×3), 5 (3×4), 6.5 (4×4), 8 (4×5), 11 (5×5), 14 (5×6).
- Warnings: tick each second at ≤10s; urgent double-beep + haptic + red
  screen-edge pulse each second at ≤5s; timer text flashes red at ≤15s.

### 3.4 Scoring & streak
- Per level: best time and best moves stored independently (each can improve
  separately).
- **Streak** = consecutive levels solved on FIRST attempt (no restart, no
  fail) within a track. Continues across Chapter 2. Resets to 0 on timer
  fail. Per-track.

### 3.5 Difficulty curve — Version B (LOCKED, per-track bands)
Bands are [startLvl, endLvl, minDistance, maxDistance]:

```
easy:   [1,20,4,8] [21,50,9,14] [51,80,15,20] [81,100,21,26] [101,120,8,12] [121,150,13,18] [151,180,19,26] [181,200,27,36]
medium: [1,20,8,15] [21,50,16,30] [51,80,31,45] [81,100,46,60] [101,120,12,22] [121,150,23,38] [151,180,39,55] [181,200,56,72]
hard:   [1,20,12,25] [21,50,26,50] [51,80,51,80] [81,100,81,110] [101,120,18,35] [121,150,36,60] [151,180,61,95] [181,200,96,130]
```
Within a band, target distance interpolates linearly by level. These values
live in ONE place: `src/config.ts` (app) and duplicated in
`tools/generate-levels/generate.ts` (generator). If ever changed, change BOTH.

---

## 4. Game Flow (auto-play — the defining UX)

```
Session start:  Home → tap track card → Level map → ★ marker animates UP the
                path to current level → map fades → level auto-starts.

After a win:    Win overlay (~2.2s, auto-fades; shows full image reveal for
                image modes) → Level map → ★ marker animates from completed
                node UP to next node (~0.9s) → map fades → next level starts.

After a fail:   Fail overlay: "Tap anywhere to auto-retry…"
                - interaction within 5s → auto-retry same puzzle (fresh timer)
                - no interaction for 5s → fade to Level map (player is idle)
```
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
| Storage | expo-sqlite (`src/db.ts`) — progress, bests, settings |
| Level data | `assets/levels.json` (static import; version 0 = stub fallback) |
| Phase 2 will add | react-native-gesture-handler, react-native-reanimated |
| Phase 4 will add | expo-av, expo-haptics |

### 5.2 File structure
```
slyde/
├─ App.tsx                        # Navigation + DB hydration
├─ assets/levels.json             # generated dataset (version 0 = placeholder)
├─ src/
│  ├─ config.ts                   # TRACKS, BANDS, TIME_MULT — SINGLE SOURCE OF TRUTH
│  ├─ theme.ts                    # wood/brass color tokens (C object)
│  ├─ types.ts                    # LevelRecord, BestScore, TrackProgress, Settings
│  ├─ db.ts                       # SQLite layer (loadState, saveBest, etc.)
│  ├─ store/app.ts                # Zustand: progress, settings, completeLevel
│  ├─ data/levels.ts              # getLevel(): dataset → stub fallback
│  ├─ data/stub.ts                # seeded approximate generation (interim)
│  ├─ components/ui.tsx           # WoodButton, Panel, TopBar
│  └─ screens/                    # Splash, Home, Map, PreLevel, Puzzle,
│                                 # Leaderboard, Settings
└─ tools/generate-levels/generate.ts   # offline generator (A*/IDA* verification)
```

### 5.3 Key mechanics the agent MUST preserve
- **Level determinism:** `mulberry32(seed)` + backward-move scramble from
  solved state (never random placement — half of random arrangements are
  unsolvable; backward moves guarantee solvability and determinism). Never
  undo the previous move during scrambling (prevents wasted displacement).
- **Dataset loading:** `src/data/levels.ts` prefers verified records from
  `levels.json`; falls back to `generateStubLevel()` while version is 0.
  When the real dataset is committed, stub mode disappears automatically.
- **SQLite schema:** `track_progress(track, unlocked, streak)`,
  `level_best(track, level, best_time, best_moves)`, `settings(key, value)`.
- **completeLevel()** in the store handles: min-merge of bests, streak
  increment (first attempts only), unlock advance, and persistence — all
  atomically. Screens must call it exactly once per win.

### 5.4 Level generator (Phase 1a, delivered)
`tools/generate-levels/generate.ts`:
- Run: `npx tsx tools/generate-levels/generate.ts --tracks=easy,medium --out=assets/levels.json`
- Verify-and-retry loop: scramble at estimated strength → compute TRUE optimal
  distance (A* with Manhattan+LinearConflict for ≤16 cells; IDA* above) →
  accept if inside band, else adapt strength and retry (≤80 attempts, all
  seeded by hash(seedBase, attempt) so results are machine-independent).
- Emits `levels.json` + console verification report (per-segment min/avg/max).
- **KNOWN LIMITATION:** Hard (5×5/5×6, distances up to 130) is too slow with
  current heuristics. Phase 1b adds Walking Distance + Inversion Distance
  heuristics for IDA*. Do NOT attempt `--tracks=hard` until 1b lands.

---

## 6. Visual & Audio Design System

### 6.1 Visual language — "wooden puzzle toy on a craftsman's table"
Reference implementation: the HTML prototype (v5.4) — ask the owner for
`slyde.html` if needed; it is the canonical visual reference.

| Surface | Treatment |
|---|---|
| Background | Dark wood (#432a14–#5c3a1e) with grain + vignette |
| Tiles | Light wood face (#e8c489), light bevel top-left, dark bevel bottom-right, gloss sheen overlay |
| Board | Carved tray: thick border (#6b4423), deep inner shadow |
| Buttons | Brass gradient (#f9e2a8→#a86f24), depress 2–3px on press |
| Badges | Small brass pills (image+number mode) |
| Map nodes | Domed discs: green done / gold current (pulsing) / dark locked 🔒 (always visible) |
| ★ marker | Polished brass, animates along path |
| Text | Serif (Georgia); letterpress shadows |
| Color tokens | All in `src/theme.ts` (`C` object) — extend, don't hardcode |

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
| Timer ≤10s (10→6) | tick per second; background music DUCKS to ~1/3 |
| Timer ≤5s (5→1) | urgent double-beep + haptic |
| Fail | loud falling tone |
| Win | 3-note rising chime |
| New personal best | 4-note fanfare (+0.6s after win chime) |
| Music | gentle plucked loop, own gain node, quiet bed under loud SFX; pauses on app background |
Settings: three independent toggles — music / sound / haptics. Sound=off also
stops music.

---

## 7. Data Contracts

### levels.json (generated, version ≥1)
```json
{ "version": 1, "generatedAt": "ISO", "solver": "…",
  "levels": [ { "id": "easy-23", "track": "easy", "level": 23,
    "cols": 3, "rows": 3, "seed": 110183, "initialTiles": [3,1,2,5,0,6,4,7,8],
    "targetSolveDistance": 12, "timeLimitSeconds": 93,
    "imageIndex": 10, "chapter": 1 } ] }
```
`initialTiles`: array of length cols×rows, values 1..(n−1), `0` = blank.

### Image packs
**50 images** in `assets/puzzles/` (`01.png`..`50.png`), indices **0-49** (one
full cycle of `imageIndexFor()`; `PUZZLE_IMAGE_COUNT` in `src/config.ts`), so
no two neighbouring levels share a picture. Art is scaled to cover the board,
centre-cropped to the grid ratio,
and sliced one cell per tile (each tile draws its HOME cell, so solving
reassembles the picture). Replace files in place -- no code change;
`src/data/puzzles.ts` is the registry. The shipped pack is real art;
`npm run generate:puzzles` fills only empty slots unless `--force`.
Spec: `assets/puzzles/README.md`.

---

## 8. Roadmap & Current Status

| Phase | Scope | Status |
|---|---|---|
| **0** | Expo scaffold, 7 screens, SQLite, Zustand, stub levels | ✅ **DONE** |
| **1a** | Generator with A*/IDA* verification (Easy+Medium) | ✅ **DONE** |
| **1b** | Walking Distance + Inversion Distance heuristics → Hard dataset | ⬜ **NEXT** |
| **2** | Real puzzle board: gesture-handler drag+tap, Reanimated animations, tile lift, timer warning FX, full win/fail overlays | ⬜ |
| **3** | Winding-path level map (upward, marker, chapter gate, auto-scroll), auto-play flow engine, idle-aware fail gate, pre-level/leaderboard/settings polish | ⬜ |
| **4** | expo-av audio system (SFX + music + ducking), expo-haptics, wood component library finalization | ⬜ |
| **5** | Puzzle image pack + slicing (50 images in assets/puzzles/) DONE -- remaining: peek/win-reveal polish, icon/branding, timer playtest tuning, store release prep | partial |
| Post-MVP | Accounts, cloud leaderboard, photo uploads, monetization | Deferred by design |

**Critical path:** 1b → 2 → 3 → 5 (Phase 4 can parallel 3/5).

---

## 9. Agent Working Rules

1. **Never change locked decisions** (§3, §4) without explicit owner approval.
   The Decision Log (§10) explains the rationale — if you believe a decision
   is wrong, raise it, don't silently change it.
2. **Single source of truth:** gameplay constants live in `src/config.ts`
   only (and duplicated in the generator — keep them in sync deliberately).
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
| D2 | Tall grids (3×4 etc.) | Portrait phones, big tiles |
| D3 | Difficulty resets at level 101 | New board = new learning curve; continuing would spike |
| D4 | Tile mode fixed per track | Teaches image-solving progressively; removes player decision |
| D5 | Timer on EVERY level, formula-based | Uniform challenge; no per-level hand tuning |
| D6 | Per-grid multipliers 4–14 s/move + 45s | Flat rate unwinnable on 5×6; humans need 1.5–2.5× optimal moves |
| D7 | Auto-play flow everywhere | Zero-friction; player only solves |
| D8 | Idle-aware fail retry (5s gate) | Prevents silent infinite retries for idle players |
| D9 | Restart only (no undo/hints) | Honest scores; no on-device solvers |
| D10 | Retry = same seeded scramble | Fairness, identical puzzles for all |
| D11 | Map climbs upward, level 1 bottom | Progress = climbing; owner-specified |
| D12 | Home merged with track select | Owner-specified reference design |
| D13 | Loud sounds + warning audio + visual pulse | Fail must never surprise silently |
| D14 | Wood+3D visuals, NO perspective tilt | Lighting-based 3D preserves drag precision |
| D15 | JSON → SQLite delivery; TS generator in-repo | Diffable, regenerable, CI-verifiable |
| D16 | IDA* + Walking Distance needed for 5×5/5×6 | Plain A* intractable (25!/2 ≈ 10²⁴ states) |
| D17 | Streak = consecutive first-attempt solves, per track | Clean honest metric |
| D18 | **Version B per-track difficulty curves** | Owner chose distinct track identities: Easy casual → Hard boss-level (~130-move finale, ~31min limit) |
| D19 | Image index fixed per level | Consistent with seeded philosophy; collectible feel |

---

## 11. Known Issues / Gotchas

- **Prototype history (lessons):** v5.1 introduced 3 regressions (tiles
  stacked at origin — set `G.cell` before layout; missing number text;
  background-size broke image slicing). Root cause: perf refactor changed
  rendering invariants. When refactoring the board in Phase 2, re-test ALL
  three tile modes after ANY change.
- **Leaderboard/Settings screens** currently use `require('@react-navigation/native')`
  inline — a Phase 0 shortcut. Clean up to standard hook imports in Phase 3.
- **MapScreen** is a simple grid placeholder; the winding-path implementation
  (with ★ marker + auto-scroll) is Phase 3.
- **Expo Go** cannot test some native modules; if Phase 4 audio needs
  formats Expo Go doesn't support, a dev client build will be required —
  flag to owner first.
- **Alert.prompt** doesn't exist on Android — the settings reset-track flow
  must use the button-list fallback (already implemented).

---

## 12. Owner Interaction Protocol

- The owner tests on a **physical Android phone via Expo Go**.
- Owner gives feedback in short, informal messages, sometimes with
  screenshots. Interpret generously; when a screenshot shows something
  unexpected (e.g., a "Share" button that isn't in the code), first suspect
  **browser/device UI captured in the screenshot**, not the app.
- When the owner reports a bug: diagnose with the reasoning shown, fix, and
  deliver either a targeted patch (small edits, clearly marked) or a full
  file re-send (their preference after copy-paste corruption incidents —
  they have had trouble with partial copies; **prefer complete files over
  diff instructions when in doubt**).
- Deliverables the owner must run themselves: the level generator (compute),
  Expo builds, store submissions, asset sourcing.

---

*End of briefing. Current dataset version: 0 (stub). Next task: Phase 1b —
Walking Distance + Inversion Distance heuristics for the generator's IDA*
solver, enabling the Hard track dataset.*
```

---

## Why I structured it this way (and how to use it)

| Section | What it's for |
|---|---|
| **§1–2 Identity & pillars** | The agent immediately knows what the product *is* and what it must never break — the 4 pillars act as guardrails for every future decision |
| **§3–4 Gameplay & flow specs** | Complete behavioral contract — an agent can implement or verify any screen against these without asking you anything |
| **§5–7 Architecture, design system, data contracts** | The technical map: where things live, what's sacred (determinism!), exact schemas, the full audio/visual spec |
| **§8 Roadmap with status** | So any agent knows exactly where the project stands and what's next — no re-planning from scratch |
| **§9 Working rules** | The 10 rules are the most important section — they encode process lessons from our actual collaboration (one phase at a time, complete files over diffs, re-test all tile modes after board changes) |
| **§10 Decision log** | Prevents the classic AI-agent failure mode: "helpfully" changing a locked design because it doesn't know *why* it was chosen |
| **§11 Known issues** | Hard-won lessons from the prototype bugs — so the next agent doesn't repeat them |
| **§12 Owner protocol** | Tells the agent how to work *with you* specifically — including the screenshot-interpretation and full-file-delivery preferences we learned during the prototype sessions |

