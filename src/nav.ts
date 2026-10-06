// SLYDE — navigation param list shared across screens.
import type { TrackId } from './config';

export type RootStackParamList = {
  Splash: undefined;
  Home: undefined;
  /**
   * Map dual mode (UI-SPEC §4): manual mode (no extra params) is the calm
   * explorer. Flow mode passes the automations the ★ marker performs:
   *   - animateTo: the level the ★ lands on (auto-scroll target too)
   *   - fromLevel:  the node the ★ glides FROM (missing = pop in place)
   *   - autoStart:  after the sequence, replace to Puzzle(animateTo)
   */
  Map: { trackId: TrackId; fromLevel?: number; animateTo?: number; autoStart?: boolean };
  PreLevel: { trackId: TrackId; level: number };
  Puzzle: { trackId: TrackId; level: number };
  Leaderboard: { trackId: TrackId };
  Settings: undefined;
};
