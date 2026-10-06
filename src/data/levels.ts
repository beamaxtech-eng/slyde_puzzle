// SLYDE — level dataset access layer.
// Prefers verified records from assets/levels.json (version >= 1); falls back
// to generateStubLevel() while the dataset version is 0. When the real dataset
// is committed, stub mode disappears automatically.

import type { LevelRecord } from '../types';
import type { TrackId } from '../config';
import { generateStubLevel } from './stub';

// Static import of the generated dataset. Metro treats JSON modules as
// inline objects. version 0 = placeholders (stub fallback active).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dataset = require('../../assets/levels.json') as {
  version: number;
  levels: LevelRecord[];
};

let byId: Map<string, LevelRecord> | null = null;

function indexIfNeeded(): void {
  if (byId !== null) {
    return;
  }
  byId = new Map();
  if (dataset.version >= 1) {
    for (const level of dataset.levels) {
      byId.set(level.id, level);
    }
  }
}

/** True when a real verified dataset is present. */
export function hasVerifiedDataset(): boolean {
  indexIfNeeded();
  return dataset.version >= 1 && byId !== null && byId.size > 0;
}

/**
 * Returns the level record for `track`/`level`.
 * When the verified dataset is unavailable, generates a deterministic stub.
 * Note: stubs approximate difficulty; optional warnings remain out (Phase 0).
 */
export function getLevel(track: TrackId, level: number): LevelRecord {
  indexIfNeeded();
  if (dataset.version >= 1) {
    const found = byId?.get(`${track}-${level}`);
    if (found) {
      return found;
    }
  }
  return generateStubLevel(track, level);
}

/** Storage version string, useful for logs. */
export function datasetVersion(): number {
  return dataset.version;
}
