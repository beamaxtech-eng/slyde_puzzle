// SLYDE — interim stub level generation.
// Used ONLY while assets/levels.json is version 0. Produces plausible,
// seeded, solvable levels (backward-move scramble). When the real dataset is
// committed (version >= 1), src/data/levels.ts stops calling this entirely.

import type { LevelRecord } from '../types';
import type { TrackId } from '../config';
import {
  CHAPTER_1_LEVELS,
  gridForLevelOfTrack,
  imageIndexFor,
  seedBaseFor,
  targetDistanceFor,
  timeLimitFor,
} from '../config';

/** Deterministic 32-bit PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Solved permutation [1,2,...,size-1,0] with blank last. */
function solvedTiles(size: number): number[] {
  const tiles = new Array<number>(size);
  for (let i = 0; i < size - 1; i++) {
    tiles[i] = i + 1;
  }
  tiles[size - 1] = 0;
  return tiles;
}

function blankIndex(tiles: number[]): number {
  return tiles.indexOf(0);
}

function delta(dir: number, rowLen: number): number {
  switch (dir) {
    case 0:
      return -1; // blank moves left
    case 1:
      return 1; // blank moves right
    case 2:
      return -rowLen; // blank moves up
    case 3:
      return rowLen; // blank moves down
    default:
      return 0;
  }
}

function opposite(dir: number): number {
  switch (dir) {
    case 0:
      return 1;
    case 1:
      return 0;
    case 2:
      return 3;
    case 3:
      return 2;
    default:
      return -1;
  }
}

/**
 * Scrambles by moving the blank from the solved state for `moves` backward
 * moves. Never undoes the immediately previous move (prevents wasted
 * displacement), guaranteeing determinism + solvability.
 */
export function scrambleBackwardRaw(
  cols: number,
  rows: number,
  moves: number,
  rng: () => number
): number[] {
  const board = solvedTiles(cols * rows);
  const rowLen = cols;
  const size = board.length;
  let blank = blankIndex(board);
  let prevDir = -1;
  for (let m = 0; m < moves; m++) {
    const candidates: number[] = [];
    if (blank % rowLen !== 0) candidates.push(0); // blank left
    if (blank % rowLen !== rowLen - 1) candidates.push(1); // blank right
    if (blank >= rowLen) candidates.push(2); // blank up
    if (blank < size - rowLen) candidates.push(3); // blank down
    const filtered = candidates.filter((c) => c !== opposite(prevDir));
    const pick = filtered.length > 0 ? filtered : candidates;
    const dir = pick[Math.floor(rng() * pick.length)];
    const swap = blank + delta(dir, rowLen);
    const tmp = board[blank];
    board[blank] = board[swap];
    board[swap] = tmp;
    blank = swap;
    prevDir = dir;
  }
  return board;
}

/**
 * Generates a deterministic stub level for `track`/`level`.
 * Distance uses the targeted band value, but the scramble is approximate
 * (it doesn't verify the true optimal distance like the real generator).
 */
export function generateStubLevel(track: TrackId, level: number): LevelRecord {
  const grid = gridForLevelOfTrack(track, level);
  const cols = grid.cols;
  const rows = grid.rows;
  const seed = seedBaseFor(track, level);
  const target = targetDistanceFor(track, level);
  const rng = mulberry32(seed);
  const tiles = scrambleBackwardRaw(cols, rows, target, rng);

  return {
    id: `${track}-${level}`,
    track,
    level,
    cols,
    rows,
    seed,
    initialTiles: tiles,
    targetSolveDistance: target,
    timeLimitSeconds: timeLimitFor(target, cols, rows),
    imageIndex: imageIndexFor(level),
    chapter: level <= CHAPTER_1_LEVELS ? 1 : 2,
  };
}
