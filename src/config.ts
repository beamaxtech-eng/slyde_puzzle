// SLYDE — gameplay configuration.
// SINGLE SOURCE OF TRUTH for gameplay constants. The offline generator
// (tools/generate-levels/generate.ts) deliberately duplicates these values;
// if you change anything here, change BOTH.

export type TrackId = 'easy' | 'medium' | 'hard';

export interface Band {
  startLevel: number;
  endLevel: number;
  minDistance: number;
  maxDistance: number;
}

export interface TrackConfig {
  id: TrackId;
  name: string;
  bands: Band[];
  /** Chapter 1 grid (levels 1..CHAPTER_1_LEVELS). Rows >= cols (tall/portrait). */
  cols1: number;
  rows1: number;
  /** Chapter 2 grid (levels CHAPTER_1_LEVELS+1..LEVELS_PER_TRACK). */
  cols2: number;
  rows2: number;
}

export interface GridSpec {
  cols: number;
  rows: number;
}

/** Timer multiplier M per grid size (seconds per optimal move). */
export const TIME_MULT: Record<string, number> = {
  '3x3': 4,
  '3x4': 5,
  '4x4': 6.5,
  '4x5': 8,
  '5x5': 11,
  '5x6': 14,
};

/** Fixed base seconds added to every level's timer. */
export const TIME_BASE_SECONDS = 45;

/** Maps grid -> tile mode index (0 = numbers, 1 = image+number, 2 = image). */
export const GRID_TILE_MODE: Record<string, 0 | 1 | 2> = {
  '3x3': 0,
  '3x4': 0,
  '4x4': 1,
  '4x5': 1,
  '5x5': 2,
  '5x6': 2,
};

/** Levels per track (chapter 1 + chapter 2). */
export const LEVELS_PER_TRACK = 200;
/** Levels in chapter 1 — the rest (CHAPTER_1_LEVELS+1..LEVELS_PER_TRACK) are
 * chapter 2 on the bigger board. Each grid therefore owns this many levels. */
export const CHAPTER_1_LEVELS = 100;
export const TOTAL_TRACKS = 3;
/** Art slots in assets/puzzles/ (01.png..50.png). */
export const PUZZLE_IMAGE_COUNT = 50;

/**
 * Interpolates distance linearly for `level` within a level range that is
 * covered by one or more bands. Returns the target solve distance (moves).
 */
export function interpolateDistance(bands: Band[], level: number): number {
  const band = bands.find((b) => level >= b.startLevel && level <= b.endLevel);
  if (!band) {
    throw new Error(`No difficulty band found for level ${level}`);
  }
  const range = band.endLevel - band.startLevel;
  if (range === 0) {
    return band.minDistance;
  }
  const t = (level - band.startLevel) / range;
  const distance = band.minDistance + t * (band.maxDistance - band.minDistance);
  return Math.round(distance);
}

/** Time limit in seconds for a level with the given target solve distance. */
export function timeLimitFor(distance: number, cols: number, rows: number): number {
  const mult = TIME_MULT[`${cols}x${rows}`] ?? 5;
  return Math.round(distance * mult + TIME_BASE_SECONDS);
}

/** Grid for a track at a given level (1..LEVELS_PER_TRACK). */
export function gridForLevelOfTrack(id: TrackId, level: number): GridSpec {
  const track = getTrack(id);
  return level <= CHAPTER_1_LEVELS
    ? { cols: track.cols1, rows: track.rows1 }
    : { cols: track.cols2, rows: track.rows2 };
}

/** Tile mode (0 numbers, 1 image+number, 2 image) for a grid size. */
export function tileModeForGrid(cols: number, rows: number): 0 | 1 | 2 {
  return GRID_TILE_MODE[`${cols}x${rows}`] ?? 0;
}

/** Target solve distance interpolated from bands for a level. */
export function targetDistanceFor(id: TrackId, level: number): number {
  return interpolateDistance(getTrack(id).bands, level);
}

export const TRACKS: TrackConfig[] = [
  {
    id: 'easy',
    name: 'Easy',
    bands: [
      // Chapter 1 — 3×3, levels 1..100 (4 arcs, ramping).
      { startLevel: 1, endLevel: 20, minDistance: 4, maxDistance: 8 },
      { startLevel: 21, endLevel: 50, minDistance: 9, maxDistance: 14 },
      { startLevel: 51, endLevel: 80, minDistance: 15, maxDistance: 20 },
      { startLevel: 81, endLevel: 100, minDistance: 21, maxDistance: 26 },
      // Chapter 2 — 3×4, levels 101..200 (difficulty continues ramping up).
      { startLevel: 101, endLevel: 120, minDistance: 27, maxDistance: 31 },
      { startLevel: 121, endLevel: 150, minDistance: 32, maxDistance: 37 },
      { startLevel: 151, endLevel: 180, minDistance: 38, maxDistance: 45 },
      { startLevel: 181, endLevel: 200, minDistance: 46, maxDistance: 55 },
    ],
    cols1: 3,
    rows1: 3,
    cols2: 3,
    rows2: 4,
  },

  {
    id: 'medium',
    name: 'Medium',
    bands: [
      // Chapter 1 — 4×4, levels 1..100.
      { startLevel: 1, endLevel: 20, minDistance: 8, maxDistance: 15 },
      { startLevel: 21, endLevel: 50, minDistance: 16, maxDistance: 30 },
      { startLevel: 51, endLevel: 80, minDistance: 31, maxDistance: 45 },
      { startLevel: 81, endLevel: 100, minDistance: 46, maxDistance: 60 },
      // Chapter 2 — 4×5, levels 101..200 (difficulty continues ramping up).
      { startLevel: 101, endLevel: 120, minDistance: 61, maxDistance: 65 },
      { startLevel: 121, endLevel: 150, minDistance: 66, maxDistance: 71 },
      { startLevel: 151, endLevel: 180, minDistance: 72, maxDistance: 79 },
      { startLevel: 181, endLevel: 200, minDistance: 80, maxDistance: 89 },
    ],
    cols1: 4,
    rows1: 4,
    cols2: 4,
    rows2: 5,
  },
  {
    id: 'hard',
    name: 'Hard',
    bands: [
      // Chapter 1 — 5×5, levels 1..100.
      { startLevel: 1, endLevel: 20, minDistance: 12, maxDistance: 25 },
      { startLevel: 21, endLevel: 50, minDistance: 26, maxDistance: 50 },
      { startLevel: 51, endLevel: 80, minDistance: 51, maxDistance: 80 },
      { startLevel: 81, endLevel: 100, minDistance: 81, maxDistance: 110 },
      // Chapter 2 — 5×6, levels 101..200 (difficulty continues ramping up).
      { startLevel: 101, endLevel: 120, minDistance: 111, maxDistance: 115 },
      { startLevel: 121, endLevel: 150, minDistance: 116, maxDistance: 121 },
      { startLevel: 151, endLevel: 180, minDistance: 122, maxDistance: 129 },
      { startLevel: 181, endLevel: 200, minDistance: 130, maxDistance: 140 },
    ],
    cols1: 5,
    rows1: 5,
    cols2: 5,
    rows2: 6,
  },
];

export function getTrack(id: TrackId): TrackConfig {
  const track = TRACKS.find((t) => t.id === id);
  if (!track) {
    throw new Error(`Unknown track: ${id}`);
  }
  return track;
}

/** Image indexes cycle 0..PUZZLE_IMAGE_COUNT-1 through the pack, fixed per level. */
export function imageIndexFor(level: number): number {
  return (level - 1) % PUZZLE_IMAGE_COUNT;
}

/** Seeded level base used by BOTH generator and stub (never changes). */
export function seedBaseFor(id: TrackId, level: number): number {
  const order = ['easy', 'medium', 'hard'];
  const trackIndex = order.indexOf(id);
  if (trackIndex === -1) {
    throw new Error(`Unknown track: ${id}`);
  }
  return 1_000_000 + trackIndex * 1_000 + level;
}
