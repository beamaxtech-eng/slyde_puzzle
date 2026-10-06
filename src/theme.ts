// SLYDE — visual design tokens. Wood + brass "craftsman's table" language.
// Colors ONLY live here and in src/config.ts (gameplay). Never hardcode colors
// in screens/components — extend this object instead.
// Values follow UI-SPEC.md §1.

export const C = {
  // Background (dark wood table in lamplight)
  bgDeep: "#1d1209",
  bgWood: "#432a14",
  bgWoodLight: "#5c3a1e",
  bgGlow: "#6e4928",
  vignette: "rgba(9,5,3,0.55)",

  // Panels (recessed insets)
  panelBg: "#3e1b08",
  panelBgAlt: "#2a1306",
  panelEdge: "#1d0c04",
  panelTopLine: "rgba(240,220,184,0.12)",
  panelShadow: "rgba(0,0,0,0.28)",

  // Brass
  brassLight: "#faf9f6",
  brass: "#7e5709",
  brassDark: "#af6b12",
  brassText: "#fac988",

  // Tiles (light wood face)
  tileFace: "#e8c489",
  tileFaceLight: "#f1d7a5",
  tileBevelLight: "#fff3d6",
  tileBevelDark: "#a37635",
  tileText: "#4a2f14",

  // Board / tray (carved wood)
  boardBorder: "#6b4423",
  boardInnerShadow: "#1f1208",
  boardInset: "#221608",

  // ---- Wood material ----
  // The card/button finish. Sampled from assets/bg1.jpg (deep amber planks in
  // lamplight): its pixel ramp runs #0d0600 → #7c491e, top-lit. Every raised
  // surface is this wood under a pane of liquid glass.
  woodLit: "#7c491e", // top-left lit face
  woodMid: "#5c2f0e", // mid face
  woodDark: "#3e1b08", // shaded face
  woodDeep: "#1d0c04", // bottom-right depth
  woodGrainLight: "rgba(206,150,88,0.13)", // lit grain streaks
  woodGrainDark: "rgba(13,6,0,0.30)", // shaded grain streaks / plank seams

  // ---- Liquid glass ----
  // A translucent, refracting pane laid over the wood: a milky film lit from
  // the top-left, a diagonal specular streak, and light pooling along the
  // bottom edge. Nothing hovers above the wood — it is all one slab.
  glassFilmTop: "rgba(255,244,228,0.22)",
  glassFilmMid: "rgba(255,236,206,0.07)",
  glassClear: "rgba(233, 160, 101, 0)", // transparent end-stop
  glassSheen: "rgba(112, 91, 32, 0.01)", // diagonal specular streak
  glassCaustic: "rgba(255,206,150,0.18)", // refracted bloom, bottom edge
  glassRimLight: "rgba(155, 128, 65, 0.62)", // bright glass edge (top)
  glassRimLightSoft: "rgba(255,247,228,0.26)", // softer glass edge (left)
  glassRimDark: "rgba(9,4,0,0.55)", // shaded glass edge (right)
  glassInnerLine: "rgba(255,250,238,0.14)", // 1px refraction line
  glassThickness: "rgba(9,4,0,0.78)", // the slab's dark side (3D depth)

  // Metal + warning finishes, so the glass recipe can tint brass and danger
  // buttons without new hardcoded colors in components.
  brassDeep: "#af6f0ec4",
  dangerLight: "#c51616c5",
  dangerDark: "#a82020",
  dangerDeep: "#b31515",
  // Label on the danger finish — white, for contrast against the red ramp.
  dangerText: "#f1cbac",

  // Text (serif, warm cream)
  textPrimary: "#f0dcb8",
  textGold: "#f5d9a8",
  labelTan: "#cfb17b",
  textDisabled: "#beaf9b",

  // Status colors (UI-SPEC §1.1)
  green: "#20a73d",
  greenSoft: "#6dbb74",
  gold: "#ffd76e",
  red: "#c0968b",
  success: "#3e9e52",
  danger: "#df1616",
  dangerPulse: "rgba(255,154,128,0.55)",

  // Map nodes
  nodeDone: "#3e9e52",
  nodeDoneGlow: "#5dbb6e",
  nodeCurrent: "#ffd76e",
  nodeCurrentPulse: "#fff2b0",
  nodeLocked: "#241708",
  nodeLockedIcon: "#8a7350",

  // Star marker
  star: "#f7d877",
  starDark: "#b8860b",

  // Timer (tabular figures)
  timerNormal: "#f0dcb8",
  timerWarn: "#e8b53c",
  timerCritical: "#ff9a80",

  // HUD plaques
  plaqueBg: "#3e1b08",
  plaqueEdge: "#1d0c04",

  // Overlays
  overlayDim: "rgba(20,10,4,0.82)",
  overlayPanel: "#3e1b08",
  overlayPanelBorder: "#1d0c04",

  // Level Map scenery (UI-SPEC §4) — the 3D "carved table" depth stack.
  mapSkyTop: "#160d05",
  mapSkyMid: "#3a2410",
  mapSkyBottom: "#54341a",
  mapLantern: "rgba(255,206,122,0.22)",
  mapGrain: "rgba(20,11,4,0.5)",
  mapMote: "rgba(255,224,168,0.5)",
  mapVignette: "rgba(9,5,3,0.66)",

  // Trail carved into the wood: dark groove, lit dashes riding inside it.
  trailGroove: "#1b1005",
  trailGrooveLip: "rgba(240,220,184,0.10)",
  trailDash: "#6b4a24",
  trailDashDone: "#c69a4e",

  // Node sockets (the hole a node sits in) + disc lighting model.
  nodeSocket: "#1d1207",
  nodeSocketLip: "rgba(255,231,184,0.13)",
  nodeDoneTop: "#57bd6c",
  nodeDoneBottom: "#276f36",
  nodeCurrentTop: "#ffe9a6",
  nodeCurrentBottom: "#c9992f",
  nodeLockedTop: "#4a3720",
  nodeLockedBottom: "#231708",
  nodeSheen: "rgba(255,255,255,0.30)",
  nodeRim: "rgba(0,0,0,0.35)",
} as const;

export const TYPE = {
  serif: "Georgia",
  serifBold: "Georgia-Bold",
} as const;

export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  screen: 20,
} as const;

export const MOTION = {
  tileLiftMs: 80,
  tileSettleMs: 140,
  tileSnapBackMs: 130,
  /** Level Map flow: settle after arrival → ★ pops and glides → landing
   * hold → next level replaces the map. No map fade-out: the Puzzle replaces
   * the map directly. */
  flowMarkerDelayMs: 500,
  markerGlideMs: 900,
  flowLandingHoldMs: 250,
  nodePulseMs: 1600,
  tapPulseMs: 1500,
  /** Splash: the brand moment holds this long, then Home takes over by itself.
   * A tap still skips ahead early (and is what unlocks the audio context). */
  splashAutoMs: 3000,
  urgencyPulseMs: 320,
  winHoldMs: 2200,
  failReadyMs: 2200,
  failIdleMs: 5000,
  fanfareDelayMs: 600,
  /** Level Map: the current node bobs, and its halo sweeps a slow shine. */
  nodeBobMs: 2600,
  nodeShineMs: 4200,
  /** Level Map: lantern light breathes over the scenery. */
  lanternMs: 7000,
  /** Level Map: dust motes drift across the lamplight. */
  moteMs: 9000,
} as const;

/**
 * Splits a color token into an alpha-free color plus a separate alpha, for use
 * with react-native-svg.
 *
 * IMPORTANT: react-native-svg resolves an `rgba()` string passed to `stopColor`
 * (or `fill` / `stroke`) to its RGB and **drops the alpha**, painting the shape
 * fully opaque. A "transparent" token used that way becomes solid white — which
 * is how a full-surface gradient overlay can blank the entire UI. Always pass
 * the pair this returns instead of the raw token.
 *
 *   const film = svgPaint(C.glassFilmTop);
 *   <Stop stopColor={film.color} stopOpacity={film.alpha} />
 */
export function svgPaint(token: string): { color: string; alpha: number } {
  const m = /^rgba?\(([^)]+)\)$/i.exec(token.trim());
  if (!m) return { color: token, alpha: 1 };
  const parts = m[1].split(",").map((p) => parseFloat(p.trim()));
  const r = parts[0] || 0;
  const g = parts[1] || 0;
  const b = parts[2] || 0;
  const a = parts.length > 3 ? parts[3] : 1;
  const hex =
    "#" +
    [r, g, b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("");
  return { color: hex, alpha: Number.isNaN(a) ? 1 : a };
}
