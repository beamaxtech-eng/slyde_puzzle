// SLYDE — shared UI building blocks: WoodButton, Panel, BrassSwitch, IconButton, Icon.
// Follows UI-SPEC.md §1.1 (materials) + §1.2 (lighting model) + §1.5 (the
// wood + glass material). Buttons depress 3px on press; panels are carved-ins.
//
// Finish (bg1.jpg restyle): every card, panel and button is now 3D WOOD under a
// pane of LIQUID GLASS. See the material system below.

import React, { useRef } from "react";
import { ImageBackground, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { C, SPACE, TYPE, svgPaint } from "../theme";
import { Ionicons } from "@expo/vector-icons";

export type IconName =
  | 'trophy'
  | 'settings'
  | 'home'
  | 'refresh'
  | 'star'
  | 'checkmark'
  | 'lock-closed'
  | 'flame'
  | 'globe'
  | 'alert'
  | 'checkmark-circle'
  | 'chevron-back'
  | 'chevron-forward'
  | 'play'
  | 'pause'
  | 'volume-high'
  | 'volume-off'
  | 'arrow-back';

export function Icon({ name, size = 24, color = C.brassLight, style }: {
  name: IconName;
  size?: number;
  color?: string;
  style?: object;
}) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}

export const BG_IMAGE: number = require("../../assets/bg3.png");

/**
 * The app-wide photo-wood backdrop (bg3.png). Drop it in as the FIRST child of
 * a screen's root so every screen shares the same texture. absoluteFill +
 * cover; pointerEvents="none" so it never intercepts taps.
 */
export function WoodBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <ImageBackground
        source={BG_IMAGE}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// MATERIAL SYSTEM — 3D wood + liquid glass (palette sampled from bg1.jpg).
//
// Every card and button is one slab built from three stacked layers, all of it
// clipped into a single rounded face:
//
//   1. WOOD BODY — a top-left → bottom-right gradient through the bg1 plank
//      ramp (#7c491e → #5c2f0e → #3e1b08 → #1d0c04) with vertical grain
//      streaks. Fake-3D by lighting only, never perspective (decision D14).
//   2. LIQUID GLASS — a milky film densest at the lit top-left, a diagonal
//      specular streak, and light pooling along the bottom edge. All of it is
//      translucent and sits ON the wood, so the slab reads as one object.
//   3. THE RIM — a gradient hairline (lit top-left → shaded bottom-right) plus
//      a dark "side" showing under the raised face: the slab's visible
//      thickness, which is what actually sells the 3D read.
//
// Deliberately NOT used: `borderWidth` for the rim. React Native paints borders
// beneath children, so a child background would swallow them. Instead the rim
// is drawn inside the SVG (guaranteed draw order) and the thickness is a dark
// band on the face's own padding — the same trick MapNode's discs use.
// ---------------------------------------------------------------------------

/** Per-instance gradient-id seed. SVG ids must be unique, and web shares one doc. */
let MAT_SEQ = 0;

export type SurfaceTone = "wood" | "glass" | "brass" | "danger" | "ghost";

/** The four-stop ramp a surface's wood/metal body is cut from. */
const TONES: Record<SurfaceTone, { lit: string; mid: string; dark: string; deep: string }> = {
  wood: { lit: C.woodLit, mid: C.woodMid, dark: C.woodDark, deep: C.woodDeep },
  glass: { lit: C.woodLit, mid: C.woodMid, dark: C.woodDark, deep: C.woodDeep },
  ghost: { lit: C.woodLit, mid: C.woodMid, dark: C.woodDark, deep: C.woodDeep },
  brass: { lit: C.brassLight, mid: C.brass, dark: C.brassDark, deep: C.brassDeep },
  danger: { lit: C.dangerLight, mid: C.danger, dark: C.dangerDark, deep: C.dangerDeep },
};

/**
 * Vertical grain / plank-seam streaks as [x%, width%, lit?]. Frozen on purpose:
 * a wood texture that re-randomised per render would shimmer.
 */
const GRAIN: [number, number, boolean][] = [
  [5, 0.9, false], [10, 0.5, true], [16, 1.1, false], [23, 0.6, true],
  [30, 1.4, false], [36, 0.5, true], [43, 0.8, false], [50, 1.2, false],
  [57, 0.5, true], [63, 0.9, false], [70, 1.3, false], [77, 0.6, true],
  [83, 1.0, false], [90, 0.7, true], [95, 0.5, false],
];

/** Stable per-instance id (allocated once, never re-rendered). */
function useMatId() {
  const ref = useRef<number | null>(null);
  if (ref.current === null) ref.current = ++MAT_SEQ;
  return ref.current;
}

/**
 * Layers 2 + 3: the liquid glass pane and the rim hairline. Rendered above the
 * wood body, so both the sheen and the rim always win.
 */
function GlassPane({ radius, uid }: { radius: number; uid: number }) {
  const r = Math.max(2, radius - 0.75);
  // Every token is split: an alpha-free color for `stopColor`/`fill`, and the
  // alpha passed separately (see svgPaint — rgba() strings lose their alpha).
  const filmTop = svgPaint(C.glassFilmTop);
  const filmMid = svgPaint(C.glassFilmMid);
  const clear = svgPaint(C.glassClear);
  const sheen = svgPaint(C.glassSheen);
  const caustic = svgPaint(C.glassCaustic);
  const rimLit = svgPaint(C.glassRimLight);
  const rimSoft = svgPaint(C.glassRimLightSoft);
  const rimDark = svgPaint(C.glassRimDark);
  const innerLine = svgPaint(C.glassInnerLine);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents='none'>
      <Svg width='100%' height='100%'>
        <Defs>
          {/* Milky film — densest at the top-left, where the lamp hits. */}
          <LinearGradient id={`f${uid}`} x1='0' y1='0' x2='0.45' y2='1'>
            <Stop offset='0' stopColor={filmTop.color} stopOpacity={filmTop.alpha} />
            <Stop offset='0.55' stopColor={filmMid.color} stopOpacity={filmMid.alpha} />
            <Stop offset='1' stopColor={clear.color} stopOpacity={clear.alpha} />
          </LinearGradient>
          {/* Specular streak sweeping across the upper-left corner. */}
          <LinearGradient id={`s${uid}`} x1='0' y1='0' x2='1' y2='1'>
            <Stop offset='0' stopColor={clear.color} stopOpacity={clear.alpha} />
            <Stop offset='0.22' stopColor={sheen.color} stopOpacity={sheen.alpha} />
            <Stop offset='0.46' stopColor={clear.color} stopOpacity={clear.alpha} />
          </LinearGradient>
          {/* Light refracted through the slab, pooling along the bottom edge. */}
          <LinearGradient id={`c${uid}`} x1='0' y1='1' x2='0.35' y2='0.4'>
            <Stop offset='0' stopColor={caustic.color} stopOpacity={caustic.alpha} />
            <Stop offset='1' stopColor={clear.color} stopOpacity={clear.alpha} />
          </LinearGradient>
          {/* The glass edge itself: lit top-left, shaded bottom-right. */}
          <LinearGradient id={`r${uid}`} x1='0' y1='0' x2='0.7' y2='1'>
            <Stop offset='0' stopColor={rimLit.color} stopOpacity={rimLit.alpha} />
            <Stop offset='0.45' stopColor={rimSoft.color} stopOpacity={rimSoft.alpha} />
            <Stop offset='1' stopColor={rimDark.color} stopOpacity={rimDark.alpha} />
          </LinearGradient>
        </Defs>
        <Rect x='0' y='0' width='100%' height='100%' fill={`url(#f${uid})`} />
        <Rect x='0' y='0' width='100%' height='100%' fill={`url(#s${uid})`} />
        <Rect x='0' y='0' width='100%' height='100%' fill={`url(#c${uid})`} />
        {/* 1px refraction line just inside the lit top edge. */}
        <Rect
          x={3}
          y={1.5}
          width='94%'
          height={1}
          fill={innerLine.color}
          fillOpacity={innerLine.alpha}
        />
        <Rect
          x='0.75'
          y='0.75'
          width='98.5%'
          height='98.5%'
          rx={r}
          ry={r}
          fill='none'
          stroke={`url(#r${uid})`}
          strokeWidth={1.5}
        />
      </Svg>
    </View>
  );
}

/**
 * Layer 1: the wood/metal body — a gradient ramp plus vertical grain streaks.
 * `lite` swaps the SVG gradients for flat translucent bands: near-identical at
 * small sizes but with zero extra native views, so long lists (up to 100
 * leaderboard rows) stay smooth.
 */
function MaterialBody({
  tone,
  lite = false,
  uid,
}: {
  tone: SurfaceTone;
  lite?: boolean;
  uid: number;
}) {
  const t = TONES[tone];

  // `ghost` is glass with no wood behind it — a bare frosted pane.
  if (tone === "ghost") return null;

  if (lite) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents='none'>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: t.deep }]} />
        <View style={[styles.liteBand, { top: 0, height: "58%", backgroundColor: t.mid, opacity: 0.85 }]} />
        <View style={[styles.liteBand, { top: 0, height: "30%", backgroundColor: t.lit, opacity: 0.45 }]} />
        <View style={[styles.liteBand, { top: 0, height: "52%", backgroundColor: C.glassFilmTop, opacity: 0.9 }]} />
        <View style={[styles.liteBand, { bottom: 0, height: "32%", backgroundColor: C.glassCaustic }]} />
        <View style={[styles.liteRimTop, { backgroundColor: C.glassRimLight }]} />
        <View style={[styles.liteRimLeft, { backgroundColor: C.glassRimLightSoft }]} />
        <View style={[styles.liteRimRight, { backgroundColor: C.glassRimDark }]} />
      </View>
    );
  }

  // `ghost` never reaches here — it has no body.
  const lit = svgPaint(t.lit);
  const mid = svgPaint(t.mid);
  const dark = svgPaint(t.dark);
  const deep = svgPaint(t.deep);
  const grainLit = svgPaint(C.woodGrainLight);
  const grainDark = svgPaint(C.woodGrainDark);
  const clear = svgPaint(C.glassClear);

  return (
    <>
      <View style={StyleSheet.absoluteFill} pointerEvents='none'>
        <Svg width='100%' height='100%'>
          <Defs>
            <LinearGradient id={`b${uid}`} x1='0' y1='0' x2='0.38' y2='1'>
              <Stop offset='0' stopColor={lit.color} stopOpacity={lit.alpha} />
              <Stop offset='0.38' stopColor={mid.color} stopOpacity={mid.alpha} />
              <Stop offset='0.78' stopColor={dark.color} stopOpacity={dark.alpha} />
              <Stop offset='1' stopColor={deep.color} stopOpacity={deep.alpha} />
            </LinearGradient>
            {/* The wood darkens as it wraps away from the light. */}
            <LinearGradient id={`v${uid}`} x1='0' y1='0' x2='1' y2='0'>
              <Stop offset='0' stopColor={grainDark.color} stopOpacity={grainDark.alpha} />
              <Stop offset='0.5' stopColor={clear.color} stopOpacity={clear.alpha} />
              <Stop offset='1' stopColor={grainDark.color} stopOpacity={grainDark.alpha} />
            </LinearGradient>
          </Defs>
          <Rect x='0' y='0' width='100%' height='100%' fill={`url(#b${uid})`} />
          {GRAIN.map(([x, w, isLit], i) => (
            <Rect
              key={i}
              x={`${x}%`}
              y='0'
              width={`${w}%`}
              height='100%'
              fill={isLit ? grainLit.color : grainDark.color}
              fillOpacity={isLit ? grainLit.alpha : grainDark.alpha}
            />
          ))}
          <Rect x='0' y='0' width='100%' height='100%' fill={`url(#v${uid})`} />
        </Svg>
      </View>
    </>
  );
}

/**
 * The complete finish: body → (accent bar) → liquid glass. Every card, panel,
 * chip and button in the app paints through this, so the material is one thing.
 */
function SurfacePaint({
  radius,
  tone = "wood",
  lite = false,
  accent,
}: {
  radius: number;
  tone?: SurfaceTone;
  lite?: boolean;
  accent?: string;
}) {
  const uid = useMatId();
  return (
    <>
      <MaterialBody tone={tone} lite={lite} uid={uid} />
      {!!accent && (
        <>
          {/* Wide, faint bloom then the solid status bar — both under glass. */}
          <View
            style={[
              styles.surfaceAccentGlow,
              { backgroundColor: accent, borderTopLeftRadius: radius, borderBottomLeftRadius: radius },
            ]}
          />
          <View
            style={[
              styles.surfaceAccent,
              { backgroundColor: accent, borderTopLeftRadius: radius, borderBottomLeftRadius: radius },
            ]}
          />
        </>
      )}
      <GlassPane radius={radius} uid={uid} />
    </>
  );
}

/**
 * A wood-under-glass surface: the shared finish for cards, panels and chips.
 * Content goes inside; the padding lives on the inner body so the paint and the
 * rim can fill the whole face.
 */
export function WoodGlassSurface({
  children,
  radius = 18,
  tone = "wood",
  accent,
  lite = false,
  raised = true,
  style,
  bodyStyle,
}: {
  children?: React.ReactNode;
  radius?: number;
  tone?: SurfaceTone;
  /** Optional status color bled down the left edge (track cards). */
  accent?: string;
  /** Cheap paint for long lists — no SVG. */
  lite?: boolean;
  /** true = sits on the table: lit bottom edge + dark thickness beneath.
   *  false = carved in: dark shadow lip along the top. */
  raised?: boolean;
  style?: object;
  bodyStyle?: object;
}) {
  return (
    <View
      style={[
        
        raised ? styles.surfaceShadowRaised : styles.surfaceShadowCarved,
        { borderRadius: radius },
        style,
      ]}>
      <View
        style={[
          styles.surfaceFace,
          { borderRadius: radius, paddingBottom: raised ? 4 : 0, paddingTop: raised ? 0 : 3 },
        ]}>
        {/* Wrapper with no padding of its own: the paint's fill box is then
            unambiguous, and the dark thickness shows through beneath it. */}
        <View style={[styles.paintBase, tone === "ghost" && styles.paintBaseGhost]}>
          <SurfacePaint radius={radius} tone={tone} lite={lite} accent={accent} />
          <View style={[styles.surfaceBody, bodyStyle]}>{children}</View>
        </View>
      </View>
    </View>
  );
}

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  compact?: boolean;
  style?: object;
}

/** Corner radius shared by every button face. */
const BUTTON_RADIUS = 14;

/** Wood-under-glass button: polished brass by default. Depresses 3px on press. */
export function WoodButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  compact = false,
  style,
}: ButtonProps) {
  const tone: SurfaceTone =
    variant === "danger"
      ? "danger"
      : variant === "secondary"
        ? "wood"
        : variant === "ghost"
          ? "ghost"
          : "brass";

  return (
    <Pressable
      accessibilityRole='button'
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.buttonShadow,
        variant === "ghost" && styles.buttonShadowGhost,
        { borderRadius: BUTTON_RADIUS },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      <View
        style={[
          styles.buttonFace,
          variant === "ghost" && styles.buttonFaceGhost,
          { borderRadius: BUTTON_RADIUS },
        ]}>
        <View style={[styles.paintBase, variant === "ghost" && styles.paintBaseGhost]}>
          <SurfacePaint radius={BUTTON_RADIUS} tone={tone} />
          <View style={[styles.buttonBody, compact && styles.buttonBodyCompact]}>
            <Text
              style={[
                styles.label,
                variant === "secondary" && styles.labelSecondary,
                variant === "ghost" && styles.labelGhost,
                variant === "danger" && styles.labelDanger,
              ]}>
              {label}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** Corner radius of an icon button face. */
const ICON_RADIUS = 14;

/** Icon bar / stat button (50×50 wood under glass, or wider) — vector icons. */
export function IconButton({
  icon,
  onPress,
  wide = false,
  color = C.brassLight,
  size = 24,
  hitSlop,
  style,
}: {
  icon: IconName;
  onPress?: () => void;
  wide?: boolean;
  color?: string;
  size?: number;
  hitSlop?: number;
  style?: object;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={hitSlop}
      style={({ pressed }) => [
        styles.iconBtnShadow,
        { borderRadius: ICON_RADIUS },
        pressed && styles.iconBtnPressed,
        style,
      ]}>
      <View style={[styles.iconBtnFace, { borderRadius: ICON_RADIUS }]}>
        <View style={styles.paintBase}>
          <SurfacePaint radius={ICON_RADIUS} tone='wood' />
          <View style={[styles.iconBtnBody, wide && styles.iconBtnBodyWide]}>
            <Icon name={icon} color={color} size={size} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** Panel — a glass slab carved into the wood (the settings card). */
export function Panel({
  children,
  style,
  bodyStyle,
}: {
  children: React.ReactNode;
  style?: object;
  bodyStyle?: object;
}) {
  return (
    <WoodGlassSurface
      radius={18}
      tone='glass'
      raised={false}
      bodyStyle={bodyStyle ?? styles.panelBody}
      style={style}>
      {children}
    </WoodGlassSurface>
  );
}

/**
 * Recessed HUD plaque — a small glass chip. `accent` bleeds a status color down
 * its left edge (e.g. the timer going red), which is a quieter warning than
 * repainting the whole chip.
 */
export function Plaque({
  children,
  style,
  bodyStyle,
  accent,
}: {
  children: React.ReactNode;
  style?: object;
  bodyStyle?: object;
  accent?: string;
}) {
  return (
    <WoodGlassSurface
      
      tone='glass'
      raised={false}
      accent={accent}
      bodyStyle={bodyStyle ?? styles.plaqueBody}
      style={style}>
      {children}
    </WoodGlassSurface>
  );
}

/**
 * Themed confirmation dialog (replaces the native Alert, which cannot be
 * styled). Wood + brass card over a dimmed table, with two wood buttons.
 */
export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType='fade'
      onRequestClose={onCancel}
      statusBarTranslucent>
      <Pressable style={styles.dialogDim} onPress={onCancel}>
        {/* Inner press swallows taps so only the backdrop dismisses. */}
        <Pressable style={styles.dialogCard} onPress={() => undefined}>
          <View style={styles.paintBase}>
            <SurfacePaint radius={18} tone='glass' />
            <View style={styles.dialogCardBody}>
              <Text style={styles.dialogTitle}>{title}</Text>
              {!!body && <Text style={styles.dialogBody}>{body}</Text>}
              <WoodButton
                label={confirmLabel}
                variant={destructive ? "danger" : "primary"}
                onPress={onConfirm}
                style={styles.dialogButton}
              />
              <WoodButton
                label={cancelLabel}
                variant='ghost'
                onPress={onCancel}
                style={styles.dialogButton}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Track (toggle) switch with a green-on state, per §8. */
export function BrassSwitch({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole='switch'
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      style={({ pressed }) => [styles.switchRow, pressed && styles.switchRowPressed]}>
      <Text style={styles.switchLabel}>{label}</Text>
      <View style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // ---- Surfaces ---- one wood slab under one pane of liquid glass
  surfaceShadow: {
    // Fully covered by the face, but Android only draws `elevation` shadows
    // for a view that has a background.
    backgroundColor: C.glassThickness,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 12,
  },
  surfaceShadowRaised: { elevation: 7 },
  surfaceShadowCarved: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 5,
  },
  // Holds the paint and clips it to the rounded face. Its own dark background
  // is what shows as the slab's thickness below a raised face — or as its
  // shadow lip above a carved one. Both come from the padding passed at call
  // time, so the 3D read lives in one place.
  surfaceFace: {
    backgroundColor: C.glassThickness,
    overflow: "hidden",
  },
  // Sits directly under the SVG paint. If the paint ever fails to render, the
  // surface still reads as wood instead of a white or black void.
  paintBase: { backgroundColor: C.woodMid },
  paintBaseGhost: { backgroundColor: "transparent" },

  surfaceBody: { paddingVertical: 18, paddingHorizontal: SPACE.lg },
  surfaceAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 5, opacity: 0.95 },
  surfaceAccentGlow: { position: "absolute", left: 0, top: 0, bottom: 0, width: 18, opacity: 0.2 },

  // Lite paint: flat translucent bands instead of SVG gradients (long lists).
  liteBand: { position: "absolute", left: 0, right: 0 },
  liteRimTop: { position: "absolute", left: 0, right: 0, top: 0, height: 1.5 },
  liteRimLeft: { position: "absolute", left: 0, top: 0, bottom: 0, width: 1 },
  liteRimRight: { position: "absolute", right: 0, top: 0, bottom: 0, width: 1 },

  // ---- Buttons ---- (brass / wood / glass, all over the same wood slab)
  buttonShadow: {
    backgroundColor: C.glassThickness, // covered by the face; needed for Android elevation
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.42,
    shadowRadius: 9,
    elevation: 8,
    
  },
  buttonFace: { backgroundColor: C.glassThickness, paddingBottom: 4, overflow: "hidden" },
  // A ghost button is a bare frosted pane: no dark plate behind the glass, so
  // the wood backdrop shows through and only the rim defines it.
  buttonShadowGhost: { backgroundColor: "transparent" },
  buttonFaceGhost: { backgroundColor: "transparent", paddingBottom: 0 },
  buttonBody: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonBodyCompact: { paddingVertical: 8, paddingHorizontal: 16 },
  pressed: {
    transform: [{ translateY: 3 }],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  disabled: { opacity: 0.4 },
  label: {
    color: C.brassText,
    fontSize: 18,
    fontWeight: "700",
    fontFamily: TYPE.serif,
    letterSpacing: 0.5,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  labelSecondary: { color: C.textPrimary },
  labelGhost: { color: C.brassLight },
  // White on the danger ramp; the base label already supplies the dark lift.
  labelDanger: { color: C.dangerText, textShadowRadius: 3 },

  // ---- Icon buttons ---- (the same wood slab as the cards)
  iconBtnShadow: {
    backgroundColor: C.glassThickness, // covered by the face; needed for Android elevation
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.34,
    shadowRadius: 6,
    elevation: 5,
  },
  iconBtnFace: { backgroundColor: C.glassThickness, paddingBottom: 4, overflow: "hidden" },
  iconBtnBody: { width: 50, height: 46, alignItems: "center", justifyContent: "center" },
  iconBtnBodyWide: { width: undefined, height: 60, paddingHorizontal: 20 },
  iconBtnPressed: {
    transform: [{ translateY: 2 }],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },

  // ---- Panel / plaque ---- (carved glass slabs — the finish itself lives in
  // WoodGlassSurface; these are only the inner paddings)
  panelBody: { padding: SPACE.lg },
  plaqueBody: { paddingVertical: 8, paddingHorizontal: 12 },

  // ---- Switch ----
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACE.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  switchRowPressed: { opacity: 0.8 },
  switchLabel: { color: C.textPrimary, fontSize: 16, fontFamily: TYPE.serif },
  track: {
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#1d1308",
    borderWidth: 1,
    borderColor: C.panelEdge,
    borderTopColor: "rgba(0,0,0,0.45)", // carved-in: dark top lip, lit bottom lip
    borderBottomColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    padding: 3,
  },
  trackOn: { backgroundColor: C.green },
  knob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.textPrimary,
    borderTopWidth: 2, // raised: lit top-left, shaded bottom-right
    borderLeftWidth: 2,
    borderTopColor: "rgba(255,255,255,0.75)",
    borderLeftColor: "rgba(255,255,255,0.75)",
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomColor: "rgba(0,0,0,0.3)",
    borderRightColor: "rgba(0,0,0,0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 2,
  },
  knobOn: { alignSelf: "flex-end" },

  // ---- Confirm dialog ----
  dialogDim: {
    flex: 1,
    backgroundColor: C.overlayDim,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACE.xl,
  },
  // A glass slab floating over the dimmed table; the 5px of face showing below
  // the paint is its visible thickness.
  dialogCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 18,
    backgroundColor: C.glassThickness,
    paddingBottom: 5,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 12,
  },
  dialogCardBody: {
    padding: SPACE.xl,
    alignItems: "center",
  },
  dialogTitle: {
    color: C.textGold,
    fontSize: 21,
    fontWeight: "700",
    fontFamily: TYPE.serif,
    textAlign: "center",
  },
  dialogBody: {
    color: C.labelTan,
    fontSize: 15,
    fontFamily: TYPE.serif,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 6,
    lineHeight: 21,
  },
  dialogButton: { alignSelf: "stretch", marginTop: 12 },
});