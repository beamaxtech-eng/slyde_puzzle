# Puzzle image pack (`assets/puzzles/`)

This folder holds the **pictures the sliding tiles are cut from**. Medium and
Hard levels slice one of these images into the board grid; Easy levels are
numbers only and ignore this folder.

## How many images? → **50**

50 is not arbitrary — it is baked into the dataset:

```ts
// src/config.ts
export const PUZZLE_IMAGE_COUNT = 50;

export function imageIndexFor(level: number): number {
  return (level - 1) % PUZZLE_IMAGE_COUNT;   // 0..49  →  exactly 50 pictures
}
```

Every level record in `assets/levels.json` stores its own `imageIndex`, in the
range **0–49**. With 50 images:

- every neighbouring pair of levels shows a **different** picture;
- the pack repeats only every 50 levels (level 1 and level 51 share image 01);
- each 100-level chapter is two full passes through the pack.

Fewer works (the app falls back to colour swatches for missing slots), but
repeats get noticeable. More than 50 requires a dataset regeneration — see
"Changing the pack size" below.

### Recommendation

| Pack size | Verdict |
|---|---|
| 15 | minimum acceptable (the original pack — repeats every 15 levels) |
| **50** | **current — one full pass per 50 levels, two per chapter** |
| 100 | only after regenerating the dataset with a 0–99 modulus |

## File spec

| Property | Value |
|---|---|
| Count | **50** files, `01.png` … `50.png` (`PUZZLE_IMAGE_COUNT`) |
| Formats | `.png` or `.jpg` (must all be the same extension) |
| Minimum size | 512 × 512 |
| Shipped format | 1024 × 1024 PNG (~300–500 KB each ≈ 21 MB pack) |
| Aspect | square or portrait; the app **centre-crops to the board's ratio** (`cols : rows`, e.g. 5:6), so keep the subject centred |
| Content | high-contrast, busy pictures read best — a sliding puzzle needs edges to lock onto |

> ⚠️ Pack size and bundle size: all 50 images are bundled into the app (Metro
> requires static `require()` paths). Keep an eye on the pack's total weight
> before a release build.

## How a level uses its image

1. The picture is scaled to cover the board and centre-cropped to `cols : rows`.
2. That crop is sliced into `cols × rows` cells.
3. Tile *n* renders cell *n* (its home cell), clipped by the tile frame — so the
   board reassembles into the whole picture as you solve.
4. Medium adds a small brass number badge on each tile; Hard shows the image
   alone (pure pattern recognition).

## Adding / replacing art

1. Drop your files in this folder using the existing names (`01`…`50`).
2. Nothing else to do — `src/data/puzzles.ts` already requires these 50 paths,
   and it fails fast if its list and `PUZZLE_IMAGE_COUNT` disagree.
3. Run `npm run typecheck` (and `npm start`) to see them in the game.

If you add images under different names, update the `SOURCES` list in
`src/data/puzzles.ts` to match.

## Changing the pack size

1. Update `SOURCES` in `src/data/puzzles.ts` (one line per image).
2. Update `PUZZLE_IMAGE_COUNT` in `src/config.ts` (and the duplicate
   `PUZZLE_IMAGE_COUNT` in `tools/generate-levels/generate.ts`).
3. Regenerate the dataset so every level gets a valid `imageIndex`:
   `npm run generate:levels`.

## Placeholders

`tools/generate-puzzles/generate.ts` (`npm run generate:puzzles`) can synthesise
deterministic 1024² placeholders, one per slot. The shipped pack is **real art**,
so the script now **skips files that already exist** — pass `--force`
(`npm run generate:puzzles -- --force`) to overwrite deliberately. Use it to fill
empty slots if the pack grows.

