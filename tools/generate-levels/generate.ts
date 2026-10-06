// SLYDE — offline level generator (Phase 1a).
// Run:  npx tsx tools/generate-levels/generate.ts --tracks=easy,medium --out=assets/levels.json
//       npx tsx tools/generate-levels/generate.ts --tracks=easy --levels=101-200 --merge
//
// Emits solver-verified levels.json + a console verification report.
// 200 levels per track: chapter 1 = levels 1..100 (small grid), chapter 2 =
// levels 101..200 (bigger grid) — 100 levels per grid ("matrix").
// Methodology (LOCKED, see AGENT.md §5.3/§5.4):
//   - mulberry32(seed) RNG; backward-move scramble from solved state (never
//     random placement; never undo previous move).
//   - Verify-and-retry loop: scramble at estimated strength → compute TRUE
//     optimal distance (A* with Manhattan+LinearConflict for ≤16 cells; IDA*
//     above) → accept if inside band, else adapt strength and retry
//     (≤80 attempts, each seeded by hash(seedBase, attempt)).
//   - `--levels=A-B` generates only that level range and `--merge` keeps the
//     levels already present in --out, so a 200-level track can be produced in
//     chunks across several runs.
//
// KNOWN LIMITATION: Hard (5×5/5×6, distances to 130) is too slow with current
// heuristics. Phase 1b adds Walking Distance + Inversion Distance. The `hard`
// track refuses to run until then — do NOT bypass. Hard levels keep falling
// back to generateStubLevel() at runtime, exactly as before.

import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// CONFIG — DELIBERATELY DUPLICATED from src/config.ts (single source of truth
// rule §9.2). If you change these, change BOTH files.
// ---------------------------------------------------------------------------

type TrackId = 'easy' | 'medium' | 'hard';

type Band = {
  startLevel: number;
  endLevel: number;
  minDistance: number;
  maxDistance: number;
};

type TrackConfig = {
  id: TrackId;
  bands: Band[];
  cols1: number;
  rows1: number;
  cols2: number;
  rows2: number;
};
const TRACKS_DATA: TrackConfig[] = [
  { id: 'easy',
    bands: [
      // Chapter 1 — 3×3, levels 1..100.
      { startLevel: 1, endLevel: 20, minDistance: 4, maxDistance: 8 },
      { startLevel: 21, endLevel: 50, minDistance: 9, maxDistance: 14 },
      { startLevel: 51, endLevel: 80, minDistance: 15, maxDistance: 20 },
      { startLevel: 81, endLevel: 100, minDistance: 21, maxDistance: 26 },
      // Chapter 2 — 3×4, levels 101..200 (difficulty RESETS, then ramps).
      { startLevel: 101, endLevel: 120, minDistance: 8, maxDistance: 12 },
      { startLevel: 121, endLevel: 150, minDistance: 13, maxDistance: 18 },
      { startLevel: 151, endLevel: 180, minDistance: 19, maxDistance: 26 },
      { startLevel: 181, endLevel: 200, minDistance: 27, maxDistance: 36 },
    ], cols1: 3, rows1: 3, cols2: 3, rows2: 4 },
  { id: 'medium',
    bands: [
      // Chapter 1 — 4×4, levels 1..100.
      { startLevel: 1, endLevel: 20, minDistance: 8, maxDistance: 15 },
      { startLevel: 21, endLevel: 50, minDistance: 16, maxDistance: 30 },
      { startLevel: 51, endLevel: 80, minDistance: 31, maxDistance: 45 },
      { startLevel: 81, endLevel: 100, minDistance: 46, maxDistance: 60 },
      // Chapter 2 — 4×5, levels 101..200 (difficulty RESETS, then ramps).
      { startLevel: 101, endLevel: 120, minDistance: 12, maxDistance: 22 },
      { startLevel: 121, endLevel: 150, minDistance: 23, maxDistance: 38 },
      { startLevel: 151, endLevel: 180, minDistance: 39, maxDistance: 55 },
      { startLevel: 181, endLevel: 200, minDistance: 56, maxDistance: 72 },
    ], cols1: 4, rows1: 4, cols2: 4, rows2: 5 },
  { id: 'hard',
    bands: [
      // Chapter 1 — 5×5, levels 1..100.
      { startLevel: 1, endLevel: 20, minDistance: 12, maxDistance: 25 },
      { startLevel: 21, endLevel: 50, minDistance: 26, maxDistance: 50 },
      { startLevel: 51, endLevel: 80, minDistance: 51, maxDistance: 80 },
      { startLevel: 81, endLevel: 100, minDistance: 81, maxDistance: 110 },
      // Chapter 2 — 5×6, levels 101..200 (difficulty RESETS, then ramps).
      { startLevel: 101, endLevel: 120, minDistance: 18, maxDistance: 35 },
      { startLevel: 121, endLevel: 150, minDistance: 36, maxDistance: 60 },
      { startLevel: 151, endLevel: 180, minDistance: 61, maxDistance: 95 },
      { startLevel: 181, endLevel: 200, minDistance: 96, maxDistance: 130 },
    ], cols1: 5, rows1: 5, cols2: 5, rows2: 6 },
];

const TIME_MULT: Record<string, number> = {
  '3x3': 4, '3x4': 5, '4x4': 6.5, '4x5': 8, '5x5': 11, '5x6': 14,
};
const TIME_BASE_SECONDS = 45;
const MAX_ATTEMPTS = 80;
/** Levels per track + chapter split + art slots. Mirrors src/config.ts. */
const LEVELS_PER_TRACK = 200;
const CHAPTER_1_LEVELS = 100;
const PUZZLE_IMAGE_COUNT = 50;
// ---------------------------------------------------------------------------
// RNG + scramble (deterministic per LOCKED rules)
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(base: number, attempt: number): number {
  const s = `${base}:${attempt}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function solvedTiles(size: number): number[] {
  const tiles = new Array<number>(size);
  for (let i = 0; i < size - 1; i++) tiles[i] = i + 1;
  tiles[size - 1] = 0;
  return tiles;
}

function delta(dir: number, rowLen: number): number {
  switch (dir) {
    case 0: return -1;
    case 1: return 1;
    case 2: return -rowLen;
    case 3: return rowLen;
    default: return 0;
  }
}

function opposite(dir: number): number {
  switch (dir) {
    case 0: return 1;
    case 1: return 0;
    case 2: return 3;
    case 3: return 2;
    default: return -1;
  }
}
function scramble(cols: number, rows: number, moves: number, seed: number): number[] {
  const board = solvedTiles(cols * rows);
  const rowLen = cols;
  const size = board.length;
  let blank = board.indexOf(0);
  let prevDir = -1;
  const rng = mulberry32(seed);
  for (let m = 0; m < moves; m++) {
    const candidates: number[] = [];
    if (blank % rowLen !== 0) candidates.push(0);
    if (blank % rowLen !== rowLen - 1) candidates.push(1);
    if (blank >= rowLen) candidates.push(2);
    if (blank < size - rowLen) candidates.push(3);
    const filtered = candidates.filter((c) => c !== opposite(prevDir));
    const pick = filtered.length > 0 ? filtered : candidates;
    const dir = pick[Math.floor(rng() * pick.length)];
    const swapIdx = blank + delta(dir, rowLen);
    const tmp = board[blank];
    board[blank] = board[swapIdx];
    board[swapIdx] = tmp;
    blank = swapIdx;
    prevDir = dir;
  }
  return board;
}

function manhattan(board: number[], cols: number): number {
  let sum = 0;
  for (let i = 0; i < board.length; i++) {
    const v = board[i];
    if (v === 0) continue;
    const target = v - 1;
    const tc = target % cols;
    const tr = Math.floor(target / cols);
    const cc = i % cols;
    const cr = Math.floor(i / cols);
    sum += Math.abs(tc - cc) + Math.abs(tr - cr);
  }
  return sum;
}
function linearConflict(board: number[], cols: number): number {
  const rows = Math.floor(board.length / cols);
  let conflicts = 0;
  for (let r = 0; r < rows; r++) {
    for (let a = 0; a < cols; a++) {
      const va = board[r * cols + a];
      if (va === 0) continue;
      const ta = va - 1;
      if (Math.floor(ta / cols) !== r) continue;
      for (let b = a + 1; b < cols; b++) {
        const vb = board[r * cols + b];
        if (vb === 0) continue;
        const tb = vb - 1;
        if (Math.floor(tb / cols) !== r) continue;
        if ((ta % cols) > (tb % cols)) conflicts++;
      }
    }
  }
  for (let c = 0; c < cols; c++) {
    for (let a = 0; a < rows; a++) {
      const va = board[a * cols + c];
      if (va === 0) continue;
      const ta = va - 1;
      if (ta % cols !== c) continue;
      for (let b = a + 1; b < rows; b++) {
        const vb = board[b * cols + c];
        if (vb === 0) continue;
        const tb = vb - 1;
        if (tb % cols !== c) continue;
        if (Math.floor(ta / cols) > Math.floor(tb / cols)) conflicts++;
      }
    }
  }
  return 2 * conflicts;
}

function heuristic(board: number[], cols: number): number {
  return manhattan(board, cols) + linearConflict(board, cols);
}

function keyOf(board: number[]): string {
  return board.join(',');
}

function isSolved(board: number[]): boolean {
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== (i === board.length - 1 ? 0 : i + 1)) return false;
  }
  return true;
}

function swap(board: number[], a: number, b: number): number[] {
  const next = board.slice();
  const t = next[a];
  next[a] = next[b];
  next[b] = t;
  return next;
}
// ---------------------------------------------------------------------------
// Solver 1: A* with Manhattan+LinearConflict (for <= 16 cells)
// ---------------------------------------------------------------------------

function solveAStar(start: number[], cols: number): number | null {
  const goalIdx = start.length - 1;
  const h0 = heuristic(start, cols);
  const startKey = keyOf(start);
  const open: { f: number; g: number; board: number[] }[] = [{ f: h0, g: 0, board: start }];
  const closed = new Set<string>([startKey]);
  const gScore = new Map<string, number>([[startKey, 0]]);
  const rows = Math.floor(start.length / cols);

  while (open.length > 0) {
    let bestI = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestI].f) bestI = i;
    }
    const cur = open[bestI];
    open.splice(bestI, 1);
    if (cur.board[goalIdx] === 0 && isSolved(cur.board)) {
      return cur.g;
    }
    const blank = cur.board.indexOf(0);
    const c0 = blank % cols;
    const r0 = Math.floor(blank / cols);
    const dirs: number[] = [];
    if (c0 > 0) dirs.push(0);
    if (c0 < cols - 1) dirs.push(1);
    if (r0 > 0) dirs.push(2);
    if (r0 < rows - 1) dirs.push(3);
    for (const d of dirs) {
      const child = swap(cur.board, blank, blank + delta(d, cols));
      const ck = keyOf(child);
      const ng = cur.g + 1;
      if (closed.has(ck)) continue;
      if (gScore.has(ck) && gScore.get(ck)! <= ng) continue;
      gScore.set(ck, ng);
      closed.add(ck);
      open.push({ f: ng + heuristic(child, cols), g: ng, board: child });
      if (open.length > 500000) return null;
    }
  }
  return null;
}
// ---------------------------------------------------------------------------
// Solver 2: IDA* (for grids > 16 cells). Phase 1a heuristic = Manhattan + LC.
// Phase 1b upgrades this to Walking Distance + Inversion Distance.
// ---------------------------------------------------------------------------

interface IdaResult {
  solved: boolean;
  cost: number;
  nodes: number;
  timeMs: number;
}

function solveIdaStar(start: number[], cols: number, maxTimeMs = 60000): IdaResult {
  const goalIdx = start.length - 1;
  const startT = Date.now();
  const rowLen = cols;
  let bound = heuristic(start, cols);
  let nodes = 0;

  function search(
    board: number[],
    g: number,
    bound: number,
    blank: number,
    prevMoveDir: number
  ): number {
    nodes++;
    if (Date.now() - startT > maxTimeMs) {
      return Number.POSITIVE_INFINITY;
    }
    const f = g + heuristic(board, cols);
    if (f > bound) return f;
    if (blank === goalIdx && isSolved(board)) {
      return -g;
    }
    let min = Number.POSITIVE_INFINITY;
    if (prevMoveDir !== 1 && blank % rowLen !== 0) {
      const r = searchChild(board, blank, -1, g, bound, blank - 1, 0);
      if (r < 0) return r;
      if (r < min) min = r;
    }
    if (prevMoveDir !== 0 && blank % rowLen !== rowLen - 1) {
      const r = searchChild(board, blank, 1, g, bound, blank + 1, 1);
      if (r < 0) return r;
      if (r < min) min = r;
    }
    if (prevMoveDir !== 3 && blank >= rowLen) {
      const r = searchChild(board, blank, -rowLen, g, bound, blank - rowLen, 2);
      if (r < 0) return r;
      if (r < min) min = r;
    }
    if (prevMoveDir !== 2 && blank < board.length - rowLen) {
      const r = searchChild(board, blank, rowLen, g, bound, blank + rowLen, 3);
      if (r < 0) return r;
      if (r < min) min = r;
    }
    return min;
  }

  function searchChild(
    board: number[],
    blank: number,
    swapDelta: number,
    g: number,
    bound: number,
    childBlank: number,
    childPrevDir: number
  ): number {
    const swapIdx = blank + swapDelta;
    const tmp = board[blank];
    board[blank] = board[swapIdx];
    board[swapIdx] = tmp;
    const res = search(board, g + 1, bound, childBlank, childPrevDir);
    board[swapIdx] = board[blank];
    board[blank] = tmp;
    return res;
  }

  for (;;) {
    const t = Date.now() - startT;
    if (t > maxTimeMs) {
      return { solved: false, cost: -1, nodes, timeMs: t };
    }
    const res = search(start, 0, bound, start.indexOf(0), -1);
    if (res < 0) {
      return { solved: true, cost: -res, nodes, timeMs: Date.now() - startT };
    }
    if (res === Number.POSITIVE_INFINITY) {
      return { solved: false, cost: -1, nodes, timeMs: Date.now() - startT };
    }
    bound = res;
  }
}
// ---------------------------------------------------------------------------
// Main: CLI parsing + verify-and-retry loop + report + output
// ---------------------------------------------------------------------------

interface Args {
  tracks: string[];
  out: string;
  /** Inclusive level range to generate (defaults to the whole track). */
  from: number;
  to: number;
  /** Keep the levels already in --out that this run does not regenerate. */
  merge: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    tracks: [],
    out: 'assets/levels.json',
    from: 1,
    to: LEVELS_PER_TRACK,
    merge: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--tracks=')) {
      args.tracks = a.slice('--tracks='.length).split(/[, ]+/).filter(Boolean);
    } else if (a === '--tracks' && i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
      args.tracks = argv[i + 1].split(/[, ]+/).filter(Boolean);
      i++;
    } else if (a.startsWith('--out=')) {
      args.out = a.slice('--out='.length).trim();
    } else if (a === '--out' && i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
      args.out = argv[i + 1].trim();
      i++;
    } else if (a.startsWith('--levels=')) {
      const [from, to] = parseLevelRange(a.slice('--levels='.length));
      args.from = from;
      args.to = to;
    } else if (a === '--levels' && i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
      const [from, to] = parseLevelRange(argv[i + 1]);
      args.from = from;
      args.to = to;
      i++;
    } else if (a === '--merge') {
      args.merge = true;
    }
  }
  return args;
}

/** Parses "1-200", "101-200" or "150" into an inclusive [from, to] pair. */
function parseLevelRange(spec: string): [number, number] {
  const text = spec.trim();
  const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(text);
  if (!m) {
    throw new Error(`Invalid --levels value "${spec}" (expected e.g. 1-200 or 101-200)`);
  }
  const from = Number(m[1]);
  const to = m[2] ? Number(m[2]) : from;
  if (from < 1 || to > LEVELS_PER_TRACK || from > to) {
    throw new Error(
      `--levels ${spec} is outside 1-${LEVELS_PER_TRACK} (expected from <= to)`
    );
  }
  return [from, to];
}

function targetFor(track: TrackConfig, level: number): number {
  const band = track.bands.find((b) => level >= b.startLevel && level <= b.endLevel);
  if (!band) throw new Error(`No band for ${track.id} level ${level}`);
  const range = band.endLevel - band.startLevel;
  const t = range === 0 ? 0 : (level - band.startLevel) / range;
  return Math.round(band.minDistance + t * (band.maxDistance - band.minDistance));
}

function timeLimitFor(distance: number, cols: number, rows: number): number {
  const mult = TIME_MULT[`${cols}x${rows}`] ?? 5;
  return Math.round(distance * mult + TIME_BASE_SECONDS);
}

function trackOrder(): TrackId[] {
  return ['easy', 'medium', 'hard'];
}

function chapterFor(level: number): 1 | 2 {
  return level <= CHAPTER_1_LEVELS ? 1 : 2;
}

function imageIndexFor(level: number): number {
  return (level - 1) % PUZZLE_IMAGE_COUNT;
}

function bandMax(track: TrackConfig, level: number): number {
  const band = track.bands.find((b) => level >= b.startLevel && level <= b.endLevel);
  return band ? band.maxDistance : 9999;
}

function trueDistance(board: number[], cols: number): number | null {
  if (board.length <= 16) {
    return solveAStar(board, cols);
  }
  const res = solveIdaStar(board, cols, 60000);
  return res.solved ? res.cost : null;
}

interface LevelOut {
  id: string;
  track: TrackId;
  level: number;
  cols: number;
  rows: number;
  seed: number;
  initialTiles: number[];
  targetSolveDistance: number;
  timeLimitSeconds: number;
  imageIndex: number;
  chapter: 1 | 2;
}
function generateLevel(track: TrackConfig, level: number): LevelOut {
  const cols = level <= CHAPTER_1_LEVELS ? track.cols1 : track.cols2;
  const rows = level <= CHAPTER_1_LEVELS ? track.rows1 : track.rows2;
  const targetBand = targetFor(track, level);
  const base = 1_000_000 + trackOrder().indexOf(track.id) * 1_000 + level;

  // The scramble-strength -> true-distance mapping is noisy, so sweep a wide
  // range of scramble strengths deterministically and keep the closest match.
  const lo = Math.max(2, Math.floor(targetBand * 0.8));
  const hi = Math.max(lo + 4, Math.ceil(targetBand * 4.0));
  const spread = hi - lo;
  let bestAttempt: { board: number[]; distance: number; seed: number } | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const est = lo + ((attempt * 2654435761) % (spread + 1));
    const seed = hashSeed(base + attempt * 13, attempt);
    const board = scramble(cols, rows, est, seed);
    const dist = trueDistance(board, cols);
    if (dist == null) continue;

    if (
      bestAttempt === null ||
      Math.abs(dist - targetBand) < Math.abs(bestAttempt.distance - targetBand)
    ) {
      bestAttempt = { board, distance: dist, seed };
    }

    if (dist >= track.bands[0].minDistance && dist <= bandMax(track, level)) {
      break; // accepted: inside the level's band
    }
  }

  if (!bestAttempt) {
    throw new Error(`Could not generate level ${track.id}-${level}`);
  }

  return {
    id: `${track.id}-${level}`,
    track: track.id,
    level,
    cols,
    rows,
    seed: bestAttempt.seed,
    initialTiles: bestAttempt.board,
    targetSolveDistance: bestAttempt.distance,
    timeLimitSeconds: timeLimitFor(bestAttempt.distance, cols, rows),
    imageIndex: imageIndexFor(level),
    chapter: chapterFor(level),
  };
}
function printProgress(track: TrackId, level: number, dist: number, ms: number): void {
  console.log(
    `  ${track.padEnd(6)} L${String(level).padStart(3)}  dist=${String(dist).padStart(3)}  ${ms}ms`
  );
}

function formatTime(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function generateTrackReport(levels: LevelOut[], track: TrackId): void {
  const trackCfg = TRACKS_DATA.find((t) => t.id === track)!;
  console.log(`\n[${track.toUpperCase()}] verification report`);
  for (const band of trackCfg.bands) {
    const subset = levels.filter((l) => l.level >= band.startLevel && l.level <= band.endLevel);
    if (subset.length === 0) continue;
    const dists = subset.map((l) => l.targetSolveDistance);
    const min = Math.min(...dists);
    const max = Math.max(...dists);
    const avg = dists.reduce((a, b) => a + b, 0) / dists.length;
    const inBand = subset.filter(
      (l) => l.targetSolveDistance >= band.minDistance && l.targetSolveDistance <= band.maxDistance
    ).length;
    console.log(
      `  L${String(band.startLevel).padStart(3)}-L${String(band.endLevel).padStart(3)}  ` +
        `min=${min} avg=${avg.toFixed(1)} max=${max}  inBand=${inBand}/${subset.length}`
    );
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.tracks.length === 0) {
    console.error(
      'Usage: generate.ts --tracks=easy,medium[,hard] --out=assets/levels.json ' +
        '[--levels=1-200] [--merge]'
    );
    process.exit(1);
  }
  const unknown = args.tracks.filter((t) => !trackOrder().includes(t as TrackId));
  if (unknown.length > 0) {
    console.error(`Unknown track(s): ${unknown.join(', ')} (valid: easy,medium,hard)`);
    process.exit(1);
  }
  // KNOWN LIMITATION: Hard track is NOT supported until Phase 1b.
  if (args.tracks.includes('hard')) {
    console.error(
      'Refusing to generate `hard`: 5x5/5x6 distances up to 130 are too slow with the current ' +
        'Manhattan+LinearConflict heuristics. Land Phase 1b (Walking Distance + Inversion ' +
        'Distance) first. Run only easy,medium.'
    );
    process.exit(1);
  }

  const outPath = path.resolve(args.out);
  const allLevels: LevelOut[] = [];
  const startAll = Date.now();

  for (const t of trackOrder()) {
    if (!args.tracks.includes(t)) continue;
    const track = TRACKS_DATA.find((c) => c.id === t)!;
    const start = Date.now();
    console.log(`\nGenerating ${track.id} L${args.from}-L${args.to}...`);
    for (let level = args.from; level <= args.to; level++) {
      const l0 = Date.now();
      const out = generateLevel(track, level);
      allLevels.push(out);
      printProgress(track.id, out.level, out.targetSolveDistance, Date.now() - l0);
    }
    generateTrackReport(allLevels.filter((l) => l.track === t), t);
    console.log(`[${t.toUpperCase()}] done in ${formatTime(Date.now() - start)}`);
  }

  // --merge: keep every level already in --out that this run didn't regenerate.
  // Lets a 200-level track (or a single chapter) be produced in several passes.
  let merged = 0;
  if (args.merge && fs.existsSync(outPath)) {
    const existing = JSON.parse(fs.readFileSync(outPath, 'utf8')) as { levels?: LevelOut[] };
    const regenerated = new Set(allLevels.map((l) => l.id));
    for (const level of existing.levels ?? []) {
      if (regenerated.has(level.id)) continue;
      allLevels.push(level);
      merged++;
    }
    console.log(`\nMerged ${merged} existing levels from ${outPath}`);
  }

  const order = trackOrder();
  allLevels.sort(
    (a, b) => order.indexOf(a.track) - order.indexOf(b.track) || a.level - b.level
  );

  const dataset = {
    version: 1,
    generatedAt: new Date().toISOString(),
    solver: 'A* (Manhattan+LinearConflict) <=16 cells; IDA* above (Phase 1a)',
    levelsPerTrack: LEVELS_PER_TRACK,
    chapter1Levels: CHAPTER_1_LEVELS,
    levels: allLevels,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(dataset, null, 2), 'utf8');
  console.log(`\nWrote ${allLevels.length} levels to ${outPath}`);
  for (const t of order) {
    const count = allLevels.filter((l) => l.track === t).length;
    const expected = args.merge && merged > 0 ? LEVELS_PER_TRACK : count;
    console.log(
      `  ${t.padEnd(6)} ${String(count).padStart(3)} levels` +
        (args.merge && merged > 0 ? ` (target ${expected})` : '')
    );
  }
  console.log(`Total time: ${formatTime(Date.now() - startAll)}`);
}

// -- Run --
// tsx sets require.main to its own entry in some modes; compare argv[1] to
// this file's absolute path to detect direct execution robustly.
const isDirectRun =
  typeof __filename === 'string' &&
  typeof process.argv[1] === 'string' &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectRun) {
  void main();
}
