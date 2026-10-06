# SLYDE

Tactile wooden sliding-tile puzzle game for iOS + Android (Expo / React Native / TypeScript).

600 solver-verified levels across three difficulty tracks, an auto-play flow, and
track-defined tile modes: numbers → image+numbers → image-only.

Each track runs **200 levels**: chapter 1 = levels 1–100 on the small board
(3×3 / 4×4 / 5×5), chapter 2 = levels 101–200 on the bigger one (3×4 / 4×5 /
5×6) — **100 levels per grid**.

## Status

- **Phase 0 (done):** Expo scaffold, 7 screens, SQLite persistence, Zustand store, stub levels.
- **Phase 1a (done):** Offline level generator with A*/IDA* solver verification.
  `assets/levels.json` now contains the solver-verified Easy + Medium datasets
  (version 1, **200 levels per track**). Hard falls back to deterministic stub
  generation until Phase 1b lands.
- **Phase 1b (next):** Walking Distance + Inversion Distance heuristics → Hard dataset.

See `AGENT.md` for the full project briefing: locked gameplay decisions, roadmap,
conventions, and agent working rules.

## Getting started

```bash
npm install
npx expo start        # scan the QR with Expo Go on your phone
```

Regression: `npm run typecheck` (strict TypeScript, zero errors expected).

## Level generator (Phase 1a)

```bash
npm run generate:levels                # easy + medium → assets/levels.json
npx tsx tools/generate-levels/generate.ts --tracks=easy,medium --out=assets/levels.json

# 400 verified levels is a long run: generate in chunks and merge
npx tsx tools/generate-levels/generate.ts --tracks=medium --levels=101-200 --out=assets/levels.json --merge
```

Method (locked): mulberry32-seeded backward-move scramble from the solved state
(never random placement — half of random arrangements are unsolvable; never undo
the previous move). True optimal distance computed with A* (Manhattan + Linear
Conflict) for ≤16 cells and IDA* above, then verified against the difficulty
band with a deterministic retry loop (≤80 attempts, each seeded by
`hash(seedBase, attempt)`).

**Do not attempt `--tracks=hard` until Phase 1b** (Walking Distance + Inversion
Distance heuristics); 5×5/5×6 distances up to 130 are intractable with the
current heuristics and the generator refuses to run it.

## Architecture

```
App.tsx                        Navigation + DB hydration
assets/levels.json             generated dataset (version 1: easy + medium)
src/
  config.ts                    TRACKS / BANDS / TIME_MULT — single source of truth
  theme.ts                     wood + brass color tokens (C object)
  types.ts                     LevelRecord, BestScore, TrackProgress, Settings
  db.ts                        expo-sqlite layer (progress, bests, settings)
  store/app.ts                 Zustand: hydrate, completeLevel, failLevel, settings
  data/levels.ts               getLevel(): dataset → stub fallback
  data/stub.ts                 seeded approximate generation (interim)
  data/puzzles.ts              image-pack registry (50 slots, 0..49)
  components/ui.tsx            WoodButton, Panel, BrassSwitch, ConfirmDialog
  components/tileGesture.ts    tap/drag slide rules (pure, no RN imports)
  components/TileBoard.tsx     puzzle board (carved tray; tap + drag, image slices)
  screens/                     Splash, Home, Map, PreLevel, Puzzle, Leaderboard, Settings
  nav.ts                       root stack param list
  audio.tsx                    expo-audio SFX + music (ducking) + haptics
assets/sfx/                    procedural WAVs (npm run generate:sfx)
assets/puzzles/ 01..50.png     the 50 puzzle pictures (see its README.md)
tools/generate-levels/generate.ts   offline generator (A*/IDA* verification)
tools/generate-sfx/generate.ts      procedural SFX/music synth
tools/generate-puzzles/generate.ts  procedural placeholder art
```

## Known limitations (Phase 1a)

- **High-band tail undershoot:** late levels can land below the band maximum
  (the scramble → optimal-distance curve plateaus / the retry loop accepts as
  soon as an attempt clears the lowest band's minimum). Timers are computed from
  the level's ACTUAL verified distance, so play stays fair — the ramp is just
  flatter than the band table intends. Refinable via the generator's acceptance
  rule / sweep range / attempt budget; timer playtest tuning is Phase 5 work.
- **Hard track runs on stubs** until Phase 1b (Walking Distance + Inversion
  Distance heuristics land).
- **Audio/haptics (Phase 4) implemented** with expo-audio + expo-haptics:
  procedural SFX in `assets/sfx/` (regenerate via `npm run generate:sfx`),
  ducking music loop, three independent settings toggles (sound=off silences
  everything). `start.wav` included for the level-start chime.
- **Winding-path map + auto-play flow (Phase 3) delivered** — carved-
  groove trail with lit progress dashes, 3D socket nodes with drawn icons,
  lantern-lit parallax backdrop, ★ marker with sparkle wake,
  auto-scroll; flow engine in `src/flow.ts`.
- **Puzzle board gestures (Phase 2) delivered** with core React Native only —
  `PanResponder` + `Animated`, no gesture-handler/reanimated dependency. Tap an
  adjacent tile, or drag it toward the blank and release past 35% of a cell;
  either way the move lands immediately and the tile glides (lift 80ms, settle
  140ms, snap-back 130ms). Rules: `src/components/tileGesture.ts`.

## Working with puzzle images

The pictures the tiles are cut from live in **`assets/puzzles/`** — 50 files,
`01.png` … `50.png`. The pack size is fixed by the dataset: every level carries
an `imageIndex` in **0–49** (`imageIndexFor()` / `PUZZLE_IMAGE_COUNT` in
`src/config.ts`), so every neighbouring level shows a different picture and the
pack cycles once every 50 levels.

- Swap any file (keeping its name) with your own art — no code change:
  `src/data/puzzles.ts` already requires those 50 paths (and throws if its list
  and `PUZZLE_IMAGE_COUNT` disagree).
- Spec and guidance: `assets/puzzles/README.md` (min 512×512, 1024² shipped,
  square or portrait 4:5 — centre-cropped to the board's ratio).
- The 50 files shipped now are real art. `npm run generate:puzzles` can
  synthesise placeholders for empty slots (skips existing files; add `--force`
  to overwrite).
- Medium adds a brass number badge per tile; Hard is image-only; Easy is
  numbers-only and ignores this folder.
