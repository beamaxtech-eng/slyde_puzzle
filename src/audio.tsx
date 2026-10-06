// SLYDE — Audio + haptics engine (UI-SPEC §11).
// expo-audio SFX + looping music with ducking; expo-haptics feedback.
// All playback gates on the persisted settings:
//   sound=off   → no SFX, no music (a fully silent world).
//   music=off   → music stops, SFX continue.
//   haptics=off → all vibration suppressed.
//
// Architecture: <AudioProvider/> (mount once in App.tsx) preloads every SFX
// player + the music loop and registers them in a module-level registry, so
// playSfx()/haptic()/setDucked() work from any screen without prop drilling.

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  createAudioPlayer,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioPlayer,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { AppState, AppStateStatus } from 'react-native';
import { useAppStore } from './store/app';

export const audioContext = createContext<null>(null);

export type SfxName =
  | 'thock' | 'click' | 'whoosh' | 'tick'
  | 'urgent' | 'fail' | 'win' | 'best' | 'start';

const SFX_SOURCES: Record<SfxName, number> = {
  thock: require('../assets/sfx/thock.wav'),
  click: require('../assets/sfx/click.wav'),
  whoosh: require('../assets/sfx/whoosh.wav'),
  tick: require('../assets/sfx/tick.wav'),
  urgent: require('../assets/sfx/urgent.wav'),
  fail: require('../assets/sfx/fail.wav'),
  win: require('../assets/sfx/win.wav'),
  best: require('../assets/sfx/best.wav'),
  start: require('../assets/sfx/start.wav')
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MUSIC_SOURCE: number = require('../assets/sfx/music.wav');

const SFX_VOLUME: Record<SfxName, number> = {
  thock: 1.0, click: 0.7, whoosh: 0.6, tick: 0.6,
  urgent: 1.0, fail: 1.0, win: 1.0, best: 0.9, start: 0.8,
};

const MUSIC_BASE_VOLUME = 0.35;
const MUSIC_DUCK_VOLUME = 0.12;

// ---------------------------------------------------------------------------
// Module-level registry (filled by <AudioProvider/>)
// ---------------------------------------------------------------------------

const sfxPlayers = new Map<SfxName, AudioPlayer>();
let musicPlayer: AudioPlayer | null = null;

/** Play one SFX. No-op when the sound setting is off or the player isn't ready. */
export function playSfx(name: SfxName): void {
  if (!useAppStore.getState().settings.sound) return;
  const p = sfxPlayers.get(name);
  if (!p) return;
  p.seekTo(0);
  p.volume = SFX_VOLUME[name];
  p.play();
}

export type HapticKind = 'light' | 'medium' | 'success' | 'error';

/** Fire a haptic. No-op when the haptics setting is off. */
export function haptic(kind: HapticKind): void {
  if (!useAppStore.getState().settings.haptics) return;
  switch (kind) {
    case 'light':
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      break;
    case 'medium':
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      break;
    case 'success':
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      break;
    case 'error':
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      break;
  }
}

/** Convenience: SFX + optional haptic together (the common case). */
export function feedback(name: SfxName, kind?: HapticKind): void {
  playSfx(name);
  if (kind) haptic(kind);
}

/** Duck (or restore) background music volume — timer warning zones. */
export function setDucked(ducked: boolean): void {
  useAppStore.setState({ duckMusic: ducked });
}

// ---------------------------------------------------------------------------
// AudioProvider — mounts once, preloads everything, drives music
// ---------------------------------------------------------------------------

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const musicOn = useAppStore((s) => s.settings.music);
  const soundOn = useAppStore((s) => s.settings.sound);
  const ducked = useAppStore((s) => s.duckMusic);

  const players = {
    thock: useAudioPlayer(SFX_SOURCES.thock),
    click: useAudioPlayer(SFX_SOURCES.click),
    whoosh: useAudioPlayer(SFX_SOURCES.whoosh),
    tick: useAudioPlayer(SFX_SOURCES.tick),
    urgent: useAudioPlayer(SFX_SOURCES.urgent),
    fail: useAudioPlayer(SFX_SOURCES.fail),
    win: useAudioPlayer(SFX_SOURCES.win),
    best: useAudioPlayer(SFX_SOURCES.best),
    start: useAudioPlayer(SFX_SOURCES.start),
  };
  const music = useAudioPlayer(MUSIC_SOURCE);
  const musicStatus = useAudioPlayerStatus(music);

  // Register players in the module registry.
  useMemo(() => {
    for (const [name, p] of Object.entries(players) as [SfxName, AudioPlayer][]) {
      sfxPlayers.set(name, p);
    }
    musicPlayer = music;
  }, [players, music]);

  // Configure audio session once.
  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
    });
    return () => {
      sfxPlayers.clear();
      musicPlayer = null;
    };
  }, []);

  // Track the app lifecycle: leaving the app (home screen, app switcher,
  // another app) must STOP the music, and coming back must resume it. We gate
  // playback on this state in the music effect below instead of pausing
  // imperatively here — an imperative pause flips musicStatus.playing, which
  // re-runs that effect and silently restarted the music in the background.
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => {
      subscription.remove();
    };
  }, []);

  // Loop + volume + gating for music.
  useEffect(() => {
    if (!music) return;
    music.loop = true;
  }, [music]);

  useEffect(() => {
    if (!music || !musicStatus.isLoaded) return;
    // Music plays only while the app is foregrounded AND the settings allow
    // it. `appState` in the gate is what pauses/resumes on app switches.
    const shouldPlay = musicOn && soundOn && appState === 'active';
    music.volume = ducked ? MUSIC_DUCK_VOLUME : MUSIC_BASE_VOLUME;
    if (shouldPlay && !musicStatus.playing) {
      music.play();
    } else if (!shouldPlay && musicStatus.playing) {
      music.pause();
    }
  }, [music, musicStatus, musicOn, soundOn, ducked, appState]);

  return <audioContext.Provider value={null}>{children}</audioContext.Provider>;
}

/** Test hook (not currently used) — exposes the registry for dev tooling. */
export function getMusicPlayer(): AudioPlayer | null {
  return musicPlayer;
}