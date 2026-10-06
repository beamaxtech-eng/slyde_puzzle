// SLYDE — Zustand store. Holds progress, bests, settings.
// completeLevel() handles bests min-merge, streak increment, unlock advance,
// and persistence atomically. Screens must call it exactly once per win.

import { create } from 'zustand';
import type { BestScore, PersistedState, Settings, TrackProgress } from '../types';
import type { TrackId } from '../config';
import { LEVELS_PER_TRACK } from '../config';
import * as db from '../db';

export interface WinInput {
  track: TrackId;
  level: number;
  /** Elapsed solving time in ms. */
  timeMs: number;
  /** Number of tile slides used. */
  moves: number;
  /** true only when this solve was on the first attempt (no restart, no fail). */
  firstAttempt: boolean;
}

interface AppState {
  hydrated: boolean;
  progress: Record<TrackId, TrackProgress>;
  bests: Record<string, BestScore>;
  settings: Settings;
  /** true while timer is in a warning zone → music ducks. */
  duckMusic: boolean;

  hydrate: () => Promise<void>;
  completeLevel: (win: WinInput) => Promise<{ newBestTime: boolean; newBestMoves: boolean }>;
  /** Marks a timer fail (streak reset; first-attempt continuity broken). */
  failLevel: (track: TrackId) => void;
  setSettings: (partial: Partial<Settings>) => Promise<void>;
  resetTrack: (track: TrackId) => Promise<void>;
  resetAllProgress: () => Promise<void>;
}

const DEFAULT_SETTINGS: Settings = { music: true, sound: true, haptics: true };

function emptyProgress(): Record<TrackId, TrackProgress> {
  return {
    easy: { track: 'easy', unlocked: 1, streak: 0 },
    medium: { track: 'medium', unlocked: 1, streak: 0 },
    hard: { track: 'hard', unlocked: 1, streak: 0 },
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  hydrated: false,
  progress: emptyProgress(),
  bests: {},
  settings: { ...DEFAULT_SETTINGS },
  duckMusic: false,

  hydrate: async () => {
    const state: PersistedState = await db.loadState();
    set({
      hydrated: true,
      progress: state.progress,
      bests: state.bests,
      settings: state.settings ? state.settings : { ...DEFAULT_SETTINGS },
    });
  },

  completeLevel: async (win) => {
    const { progress, bests } = get();
    const key = `${win.track}-${win.level}`;
    const prevBest = bests[key];
    const newBestTime = win.timeMs > 0 && (prevBest?.bestTimeMs == null || win.timeMs < prevBest.bestTimeMs);
    const newBestMoves = (prevBest?.bestMoves == null || win.moves < prevBest.bestMoves);

    const best: BestScore = {
      track: win.track,
      level: win.level,
      bestTimeMs: newBestTime ? win.timeMs : prevBest?.bestTimeMs ?? win.timeMs,
      bestMoves: newBestMoves ? win.moves : prevBest?.bestMoves ?? win.moves,
    };

    // Streak: increment only on first attempt; else unchanged.
    const prevProgress = progress[win.track];
    const streak = win.firstAttempt ? prevProgress.streak + 1 : prevProgress.streak;

    // Unlock advance: only level+1 if completed level == current unlocked.
    let unlocked = prevProgress.unlocked;
    if (win.level >= prevProgress.unlocked && win.level < LEVELS_PER_TRACK) {
      unlocked = win.level + 1;
    }

    const newProgress: TrackProgress = { ...prevProgress, unlocked, streak };
    const newBests: Record<string, BestScore> = { ...bests, [key]: best };

    set({ progress: { ...progress, [win.track]: newProgress }, bests: newBests });

    await db.saveTrackProgress(newProgress);
    await db.saveBest(best);

    return { newBestTime, newBestMoves };
  },

  failLevel: (track) => {
    // Streak resets to 0 on timer fail for the given track.
    const progress = get().progress;
    const p = progress[track];
    if (p && p.streak !== 0) {
      const newProgress: TrackProgress = { ...p, streak: 0 };
      set({ progress: { ...progress, [track]: newProgress } });
      void db.saveTrackProgress(newProgress);
    }
  },

  setSettings: async (partial) => {
    const next = { ...get().settings, ...partial };
    set({ settings: next });
    await db.saveSettings(next);
  },

  resetTrack: async (track) => {
    await db.resetAll(track);
    const progress = { ...get().progress, [track]: { track, unlocked: 1, streak: 0 } };
    const bests = { ...get().bests };
    for (const k of Object.keys(bests)) {
      if (k.startsWith(`${track}-`)) {
        delete bests[k];
      }
    }
    set({ progress, bests });
  },

  resetAllProgress: async () => {
    await db.resetAll();
    set({ progress: emptyProgress(), bests: {} });
  },
}));
