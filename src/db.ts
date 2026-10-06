// SLYDE — SQLite persistence layer (expo-sqlite).
// Schema: track_progress(track, unlocked, streak),
//         level_best(track, level, best_time_ms, best_moves),
//         settings(key, value)
//
// All functions are async; the store hydrates from loadState() on boot.

import * as SQLite from 'expo-sqlite';
import type { BestScore, PersistedState, Settings, TrackProgress } from './types';
import type { TrackId } from './config';
import { TRACKS } from './config';

const DB_NAME = 'slyde.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  }
  return dbPromise;
}

let initPromise: Promise<void> | null = null;

function init(): Promise<void> {
  if (!initPromise) {
    initPromise = getDb().then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS track_progress (
          track TEXT PRIMARY KEY NOT NULL,
          unlocked INTEGER NOT NULL DEFAULT 1,
          streak INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS level_best (
          track TEXT NOT NULL,
          level INTEGER NOT NULL,
          best_time_ms INTEGER,
          best_moves INTEGER,
          PRIMARY KEY (track, level)
        );
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
      `);
    });
  }
  return initPromise;
}

function trackRowToProgress(row: { track: string; unlocked: number; streak: number }): TrackProgress {
  return {
    track: row.track as TrackProgress['track'],
    unlocked: row.unlocked,
    streak: row.streak,
  };
}

async function readSettingsRows(db: SQLite.SQLiteDatabase): Promise<Record<string, string>> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM settings'
  );
  const out: Record<string, string> = {};
  for (const r of rows) {
    out[r.key] = r.value;
  }
  return out;
}

function parseSettings(map: Record<string, string>): Settings {
  const bool = (k: string, def: boolean): boolean => {
    const v = map[k];
    return v === undefined ? def : v === '1';
  };
  return { music: bool('music', true), sound: bool('sound', true), haptics: bool('haptics', true) };
}

/**
 * Loads the entire persisted state. Called once at boot (App.tsx).
 * Returns default-ish values when the DB is empty.
 */
export async function loadState(): Promise<PersistedState> {
  await init();
  const db = await getDb();

  const progressRows = await db.getAllAsync<{ track: string; unlocked: number; streak: number }>(
    'SELECT track, unlocked, streak FROM track_progress'
  );
  const bestRows = await db.getAllAsync<{
    track: string;
    level: number;
    best_time_ms: number | null;
    best_moves: number | null;
  }>('SELECT track, level, best_time_ms, best_moves FROM level_best');
  const settingsMap = await readSettingsRows(db);

  const progress: PersistedState['progress'] = {} as PersistedState['progress'];
  for (const t of TRACKS) {
    progress[t.id] = { track: t.id, unlocked: 1, streak: 0 };
  }
  for (const r of progressRows) {
    const trackId = r.track as TrackId;
    if (progress[trackId]) {
      progress[trackId] = trackRowToProgress(r);
    }
  }

  const bests: PersistedState['bests'] = {};
  for (const r of bestRows) {
    const key = `${r.track}-${r.level}`;
    bests[key] = {
      track: r.track as BestScore['track'],
      level: r.level,
      bestTimeMs: r.best_time_ms,
      bestMoves: r.best_moves,
    };
  }

  return { progress, bests, settings: parseSettings(settingsMap) };
}
/** Saves a best score (upsert merge of independent best_time_ms / best_moves). */
export async function saveBest(b: BestScore): Promise<void> {
  await init();
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO level_best (track, level, best_time_ms, best_moves) VALUES (?, ?, ?, ?)
     ON CONFLICT(track, level) DO UPDATE SET
       best_time_ms = CASE
         WHEN excluded.best_time_ms IS NULL THEN level_best.best_time_ms
         WHEN level_best.best_time_ms IS NULL THEN excluded.best_time_ms
         ELSE MIN(level_best.best_time_ms, excluded.best_time_ms) END,
       best_moves = CASE
         WHEN excluded.best_moves IS NULL THEN level_best.best_moves
         WHEN level_best.best_moves IS NULL THEN excluded.best_moves
         ELSE MIN(level_best.best_moves, excluded.best_moves) END`,
    b.track,
    b.level,
    b.bestTimeMs,
    b.bestMoves
  );
}

/** Saves full settings object as individual key/value rows. */
export async function saveSettings(s: Settings): Promise<void> {
  await init();
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const [k, v] of Object.entries(s) as [keyof Settings, boolean][]) {
      await db.runAsync(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        k,
        v ? '1' : '0'
      );
    }
  });
}

/** Deletes per-track (or all) progress rows. */
export async function resetAll(track?: string): Promise<void> {
  await init();
  const db = await getDb();
  if (track) {
    await db.runAsync('DELETE FROM track_progress WHERE track = ?', track);
    await db.runAsync('DELETE FROM level_best WHERE track = ?', track);
    await db.runAsync(
      'INSERT INTO track_progress (track, unlocked, streak) VALUES (?, 1, 0)',
      track
    );
  } else {
    await db.execAsync('DELETE FROM track_progress; DELETE FROM level_best;');
    for (const t of TRACKS) {
      await db.runAsync(
        'INSERT INTO track_progress (track, unlocked, streak) VALUES (?, 1, 0)',
        t.id
      );
    }
  }
}

/** Ensures default progress rows exist for all tracks (idempotent). */
export async function ensureDefaultProgress(): Promise<void> {
  await init();
  const db = await getDb();
  for (const t of TRACKS) {
    await db.runAsync(
      'INSERT OR IGNORE INTO track_progress (track, unlocked, streak) VALUES (?, 1, 0)',
      t.id
    );
  }
}

/** Saves per-track progress (unlocked + streak). */
export async function saveTrackProgress(p: TrackProgress): Promise<void> {
  await init();
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO track_progress (track, unlocked, streak) VALUES (?, ?, ?)
     ON CONFLICT(track) DO UPDATE SET unlocked = excluded.unlocked, streak = excluded.streak`,
    p.track,
    p.unlocked,
    p.streak
  );
}

