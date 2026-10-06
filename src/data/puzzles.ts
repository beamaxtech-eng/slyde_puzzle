// SLYDE — puzzle image pack registry (Phase 5).
// Metro needs STATIC require() paths, so every image in assets/puzzles/ is
// listed here by hand. Levels carry an `imageIndex` (0..PUZZLE_IMAGE_COUNT-1)
// assigned by imageIndexFor() in src/config.ts; this module maps that index to
// a bundled asset. Replace the files in assets/puzzles/ (same names) — no code
// change.
//
// See assets/puzzles/README.md for the art spec and pack-size guidance.

import type { LevelRecord } from '../types';
import { PUZZLE_IMAGE_COUNT } from '../config';

// One entry per file, in index order. `undefined` = slot has no art yet; the
// board then falls back to the palette swatches instead of a photo.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SOURCES: (number | undefined)[] = [
  require('../../assets/puzzles/01.png'),
  require('../../assets/puzzles/02.png'),
  require('../../assets/puzzles/03.png'),
  require('../../assets/puzzles/04.png'),
  require('../../assets/puzzles/05.png'),
  require('../../assets/puzzles/06.png'),
  require('../../assets/puzzles/07.png'),
  require('../../assets/puzzles/08.png'),
  require('../../assets/puzzles/09.png'),
  require('../../assets/puzzles/10.png'),
  require('../../assets/puzzles/11.png'),
  require('../../assets/puzzles/12.png'),
  require('../../assets/puzzles/13.png'),
  require('../../assets/puzzles/14.png'),
  require('../../assets/puzzles/15.png'),
  require('../../assets/puzzles/16.png'),
  require('../../assets/puzzles/17.png'),
  require('../../assets/puzzles/18.png'),
  require('../../assets/puzzles/19.png'),
  require('../../assets/puzzles/20.png'),
  require('../../assets/puzzles/21.png'),
  require('../../assets/puzzles/22.png'),
  require('../../assets/puzzles/23.png'),
  require('../../assets/puzzles/24.png'),
  require('../../assets/puzzles/25.png'),
  require('../../assets/puzzles/26.png'),
  require('../../assets/puzzles/27.png'),
  require('../../assets/puzzles/28.png'),
  require('../../assets/puzzles/29.png'),
  require('../../assets/puzzles/30.png'),
  require('../../assets/puzzles/31.png'),
  require('../../assets/puzzles/32.png'),
  require('../../assets/puzzles/33.png'),
  require('../../assets/puzzles/34.png'),
  require('../../assets/puzzles/35.png'),
  require('../../assets/puzzles/36.png'),
  require('../../assets/puzzles/37.png'),
  require('../../assets/puzzles/38.png'),
  require('../../assets/puzzles/39.png'),
  require('../../assets/puzzles/40.png'),
  require('../../assets/puzzles/41.png'),
  require('../../assets/puzzles/42.png'),
  require('../../assets/puzzles/43.png'),
  require('../../assets/puzzles/44.png'),
  require('../../assets/puzzles/45.png'),
  require('../../assets/puzzles/46.png'),
  require('../../assets/puzzles/47.png'),
  require('../../assets/puzzles/48.png'),
  require('../../assets/puzzles/49.png'),
  require('../../assets/puzzles/50.png'),
];

/** True when at least one real picture is bundled. */
export function hasPuzzleArt(): boolean {
  return SOURCES.some((s) => s !== undefined);
}

/** Sanity guard: the registry and the level dataset must agree on the pack. */
if (SOURCES.length !== PUZZLE_IMAGE_COUNT) {
  throw new Error(
    `puzzle pack mismatch: ${SOURCES.length} files listed, config expects ${PUZZLE_IMAGE_COUNT}`
  );
}

/**
 * Bundled image for a pack index (0-based). Returns undefined when the slot is
 * empty, in which case callers should render the colour-swatch fallback.
 */
export function puzzleImageFor(imageIndex: number): number | undefined {
  if (!Number.isFinite(imageIndex)) return undefined;
  const i = ((Math.trunc(imageIndex) % PUZZLE_IMAGE_COUNT) + PUZZLE_IMAGE_COUNT) % PUZZLE_IMAGE_COUNT;
  return SOURCES[i];
}

/** Convenience: the picture a level should be cut from (undefined = none). */
export function puzzleImageForLevel(level: Pick<LevelRecord, 'imageIndex'>): number | undefined {
  return puzzleImageFor(level.imageIndex);
}
