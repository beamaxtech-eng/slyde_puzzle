// SLYDE — shared type definitions.
import type { TrackId } from './config';

/** Cross-platform button type list (used by db as string union). */
export type ButtonType = 'primary' | 'secondary' | 'danger' | 'ghost' | 'mapNode';

/** A single verified (or stubbed) level record. */
export interface LevelRecord {
  id: string; // e.g. "easy-23"
  track: TrackId;
  level: number; // 1..LEVELS_PER_TRACK
  cols: number;
  rows: number;
  seed: number;
  /** 1D array, length cols*rows; values 1..(n-1), 0 = blank. */
  initialTiles: number[];
  targetSolveDistance: number;
  timeLimitSeconds: number;
  imageIndex: number;
  chapter: 1 | 2;
}

/** Best score for a single level (each improve independently). */
export interface BestScore {
  track: TrackId;
  level: number;
  bestTimeMs: number | null;
  bestMoves: number | null;
}

/** Per-track progression. unlocked = highest level number unlocked
 * (1..LEVELS_PER_TRACK). */
export interface TrackProgress {
  track: TrackId;
  unlocked: number;
  streak: number;
}

/** User settings. */
export interface Settings {
  music: boolean;
  sound: boolean;
  haptics: boolean;
  /** The purchased "Remove Ads" entitlement. RevenueCat is the source of
   *  truth; this is the local cache so the app starts correctly offline. */
  adsRemoved: boolean;
  /** The user's ad-free switch — only meaningful when adsRemoved is true.
   *  Defaults ON after purchase; toggling off never revokes the purchase. */
  adFreeEnabled: boolean;
}

/** Snapshot of the whole local DB state, used to hydrate the Zustand store. */
export interface PersistedState {
  progress: Record<TrackId, TrackProgress>;
  bests: Record<string, BestScore>; // keyed `${track}-${level}`
  settings: Settings | null;
}
