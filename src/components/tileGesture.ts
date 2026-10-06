// SLYDE — pure sliding-tile interaction rules (UI-SPEC §6.2, AGENT.md §3.2).
// Deliberately free of React/React Native imports: the board's gesture math
// lives here so it can be exercised without a device (see the checks run over
// this module) while `TileBoard.tsx` stays a thin rendering layer.
//
// Locked rules being encoded:
//   • single-tile slides only — the tile must be a direct neighbour of the blank
//   • drag is axis-locked toward the blank and capped at one cell
//   • a release that carried ≥ 35% of a cell into the blank commits the slide
//   • a tap (finger travel < 8px) commits immediately + settles
//   • a short release snaps back instead

/** Finger travel (px) below which a touch is a tap, not a drag. */
export const TAP_SLOP = 8;
/** Fraction of a cell a drag must carry toward the blank before release commits. */
export const DRAG_COMMIT = 0.35;

export interface TileMove {
  /** True when the blank is directly next door — the only movable case. */
  adjacent: boolean;
  /** Cell offset of the tile's current cell, relative to its HOME cell. */
  cellX: number;
  cellY: number;
  /** Cell offset of the blank (the tile's destination), relative to its home. */
  nextX: number;
  nextY: number;
}

/** Geometry of the tile holding `value` in cell (col,row) of a `cols`-wide board. */
export function tileMove(
  col: number,
  row: number,
  value: number,
  blankIndex: number,
  cols: number,
  size: number
): TileMove {
  const homeCol = (value - 1) % cols;
  const homeRow = Math.floor((value - 1) / cols);
  const stepCol = (blankIndex % cols) - col;
  const stepRow = Math.floor(blankIndex / cols) - row;
  const adjacent = Math.abs(stepCol) + Math.abs(stepRow) === 1;
  // A tile that is not next door has no destination at all, so it can never be
  // carried anywhere: cell == next, which makes every offset below zero.
  const toCol = adjacent ? col + stepCol : col;
  const toRow = adjacent ? row + stepRow : row;
  return {
    adjacent,
    cellX: (col - homeCol) * size,
    cellY: (row - homeRow) * size,
    nextX: (toCol - homeCol) * size,
    nextY: (toRow - homeRow) * size,
  };
}

/** How far (px) a finger at (dx,dy) has carried the tile toward the blank. */
export function carriedDistance(move: TileMove, dx: number, dy: number, size: number): number {
  if (move.nextX !== move.cellX) return clamp(dx * Math.sign(move.nextX - move.cellX), 0, size);
  if (move.nextY !== move.cellY) return clamp(dy * Math.sign(move.nextY - move.cellY), 0, size);
  return 0;
}

/** Tile offset for a finger at (dx,dy): one axis only, toward the blank, ≤ 1 cell. */
export function dragOffset(
  move: TileMove,
  dx: number,
  dy: number,
  size: number
): { x: number; y: number } {
  const carried = carriedDistance(move, dx, dy, size);
  if (move.nextX !== move.cellX) return { x: Math.sign(move.nextX - move.cellX) * carried, y: 0 };
  if (move.nextY !== move.cellY) return { x: 0, y: Math.sign(move.nextY - move.cellY) * carried };
  return { x: 0, y: 0 };
}

/** Does a release at (dx,dy) slot the tile in, or snap it back home? */
export function commitsSlide(move: TileMove, dx: number, dy: number, size: number): boolean {
  if (!move.adjacent) return false;
  // A tap barely travels; a drag has to have carried the tile most of the cell.
  return Math.hypot(dx, dy) < TAP_SLOP || carriedDistance(move, dx, dy, size) >= size * DRAG_COMMIT;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}