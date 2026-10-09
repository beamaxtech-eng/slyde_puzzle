// SLYDE — Level Map screen, redesigned as "The Brass Ladder" (UI-SPEC §4).
//
// The old screen composed an SVG sine-path trail, scroll-parallax backdrops,
// windowed node rendering and a JS-driven scroll tween — a lot of moving
// parts, each a jank source (per-frame JS work, deferred mounting, scroll
// polling). This redesign keeps the identity (carved MapNode discs, wood
// table, chapter gate, ★ flow marker) and throws the machinery away:
//
//   • a wide, curvy river — one smooth sine band drawn as a single static SVG
//     polyline, sampled denser than the nodes so it truly flows (no parallax)
//   • the whole ladder mounts at once; no deferral, no fades, no stagger
//   • scroll framing is one-shot per arrival; glides use the NATIVE
//     scrollTo animation — zero per-frame JS
//   • on every win the ★ SWIMS up the river: one progress tween whose X/Y are
//     keyframed from samples of the curve itself (native-driven), plus a
//     scale pulse; its scroll partner is the native glide started in the same
//     tick
//
// Flow (UI-SPEC §4): settle → ★ pops on the completed node and glides up to
// the next (0.9s) → brief landing hold → the next Puzzle replaces the map.
// The cancellation law holds: any manual tap/back calls clearFlow().

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { C, MOTION, SPACE, TYPE } from "../theme";
import MapNode from "../components/MapNode";
import { useAppStore } from "../store/app";
import { LEVELS_PER_TRACK, CHAPTER_1_LEVELS } from "../config";
import type { TrackId } from "../config";
import { after, clearFlow } from "../flow";
import type { RootStackParamList } from "../nav";
import { IconButton, Icon, WoodBackdrop } from "../components/ui";
import MapBanner from "../ads/MapBanner";

type Props = NativeStackScreenProps<RootStackParamList, "Map">;

const ROW_H = 200; // vertical rhythm of the river (node centres are ROW_H apart)
const NODE = 46; // MapNode footprint
const GATE_H = 92; // Chapter 2 divider band
const TOP_PAD = 48;
const BOTTOM_PAD = 96;
const CHAPTER_SPLIT = CHAPTER_1_LEVELS; // gate sits between the two chapters
// Rungs mounted beyond each viewport edge. Each MapNode is a small SVG tree,
// so the ladder only mounts ~a screenful + buffer at a time — a full 200-node
// mount stalls the JS thread (sluggish taps, slow screen transitions).
const WIN_BUFFER = 8;
// The river is rasterised as short SVG strips (RIVER_BAND levels each) —
// Android draws an SVG into a bitmap capped by the GPU texture limit, and a
// single full-height strip hard-crashes on mount once the map is tall
// ("Canvas: trying to draw too large bitmap").
const RIVER_BAND = 10; // levels per strip
const RIVER_BAND_PAD = 20; // headroom inside each strip for the stroke

const GATE_SUB: Record<TrackId, string> = {
  easy: "bigger boards ahead: 3×4",
  medium: "bigger boards ahead: 4×5",
  hard: "bigger boards ahead: 5×6",
};

function nodeState(
  level: number,
  unlocked: number,
): "done" | "current" | "locked" {
  if (level < unlocked) return "done";
  if (level === unlocked) return "current";
  return "locked";
}

/** The Chapter 2 plaque spanning the ladder band between the chapters. */
function ChapterGate({ top, trackId }: { top: number; trackId: TrackId }) {
  return (
    <View style={[styles.gate, { top }]} pointerEvents='none'>
      <View style={styles.gateRule} />
      <Text style={styles.gateTitle}>CHAPTER 2</Text>
      <Text style={styles.gateSub}>{GATE_SUB[trackId]}</Text>
      <View style={styles.gateRule} />
    </View>
  );
}

export default function MapScreen({ route, navigation }: Props) {
  const trackId = route.params.trackId as TrackId;
  const { fromLevel, animateTo, autoStart } = route.params;
  const { width } = useWindowDimensions();
  const progress = useAppStore((s) => s.progress);
  const bests = useAppStore((s) => s.bests);
  const unlocked = progress[trackId]?.unlocked ?? 1;

  const isFlowMode = animateTo != null;

  // ---- Ladder geometry: pure math, nothing measured at runtime ----
  const rowTop = useCallback(
    (level: number) =>
      TOP_PAD +
      (LEVELS_PER_TRACK - level) * ROW_H +
      (level <= CHAPTER_SPLIT ? GATE_H : 0),
    [],
  );
  const contentHeight =
    TOP_PAD + LEVELS_PER_TRACK * ROW_H + GATE_H + BOTTOM_PAD;

  // ---- The river: one wide, smooth sine curve flowing up the map. Nodes sit
  // exactly on the curve; on every win the ★ SWIMS along it — its motion is
  // keyframed from samples of this same curve, so the native-driven tween
  // follows the flow precisely instead of cutting chords. ----
  // One lazy S-curve per ~1090px. The wavelength was tuned when rows were
  // 78px (14 rows); pinning it in PIXELS keeps the curve's on-screen shape
  // identical no matter how far apart the nodes sit.
  const RIVER_WAVELENGTH_PX = 14 * 78;
  const RIVER_FREQ = (Math.PI * 2) / (RIVER_WAVELENGTH_PX / ROW_H);
  const ampX = Math.min(width / 2 - NODE / 2 - 10, width * 0.32);
  const riverX = useCallback(
    (level: number) => width / 2 + Math.sin(level * RIVER_FREQ) * ampX,
    [width, ampX],
  );
  // Continuous row geometry — valid for fractional levels while sampling.
  // The chapter gap blends linearly across the gate band (levels 50→51), so
  // the river and the ★ cross it as one smooth diagonal instead of a vertical
  // snap. Integer levels are pixel-identical to the old step function.
  const rowCenterAt = useCallback((level: number) => {
    const t = Math.min(1, Math.max(0, CHAPTER_SPLIT + 1 - level));
    return (
      TOP_PAD + (LEVELS_PER_TRACK - level) * ROW_H + t * GATE_H + ROW_H / 2
    );
  }, []);

  // The river is drawn as short SVG strips (~RIVER_BAND levels tall) rather
  // than one full-height canvas — see RIVER_BAND. Each strip samples 0.75
  // levels past its edges, so neighbours overlap with identical geometry and
  // the opaque strokes hide every join. Recomputed only when `unlocked` or
  // the layout changes — never on scroll.
  const riverBands = useMemo(() => {
    const bands: {
      key: number;
      top: number;
      height: number;
      pts: string;
      donePts: string;
    }[] = [];
    const STEP = 0.25;
    for (let start = 1; start <= LEVELS_PER_TRACK; start += RIVER_BAND) {
      const end = Math.min(LEVELS_PER_TRACK, start + RIVER_BAND - 1);
      const lo = start - 0.75;
      const hi = end + 0.75;
      const top = rowCenterAt(hi) - RIVER_BAND_PAD;
      const height = rowCenterAt(lo) - rowCenterAt(hi) + RIVER_BAND_PAD * 2;
      const pts: string[] = [];
      const donePts: string[] = [];
      for (let lvl = hi; lvl >= lo - 1e-9; lvl -= STEP) {
        const p = `${riverX(lvl).toFixed(2)},${(rowCenterAt(lvl) - top).toFixed(2)}`;
        pts.push(p);
        if (lvl <= unlocked) donePts.push(p);
      }
      bands.push({
        key: start,
        top,
        height,
        pts: pts.join(" "),
        donePts: donePts.join(" "),
      });
    }
    return bands;
  }, [riverX, rowCenterAt, unlocked]);

  // The ★ swim path between the departure and destination nodes — sampled
  // from the very same curve that draws the river. A from==to flow yields
  // flat ranges: the ★ just pops in place, which is what a fresh session
  // wants (settle → pulse → start).
  const swim = useMemo(() => {
    const from = fromLevel ?? animateTo ?? unlocked;
    const to = animateTo ?? from;
    const ts: number[] = [];
    const xs: number[] = [];
    const ys: number[] = [];
    const STEPS = 12;
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      const lvl = from + (to - from) * t;
      ts.push(t);
      xs.push(riverX(lvl) - NODE / 2);
      ys.push(rowCenterAt(lvl) - NODE / 2);
    }
    return { ts, xs, ys };
  }, [fromLevel, animateTo, unlocked, riverX, rowCenterAt]);
  // Levels render top→bottom as 100…1 so level 1 sits at the BOTTOM (D11:
  // progress = climbing up).
  const levelsDescending = useMemo(
    () =>
      Array.from({ length: LEVELS_PER_TRACK }, (_, i) => LEVELS_PER_TRACK - i),
    [],
  );

  // ---- Visibility window: only rungs near the viewport mount their carved
  // MapNode discs; distant rungs render nothing (the rail still spans the
  // whole climb, so the ladder never looks broken). Driven straight from
  // onScroll — no timers, no per-frame listeners — and the state only updates
  // when a boundary level actually changes, i.e. a few times per screenful.
  const focusLevel = isFlowMode
    ? (fromLevel ?? animateTo ?? unlocked)
    : unlocked;
  const [win, setWin] = useState(() => ({
    start: Math.max(1, focusLevel - WIN_BUFFER - 8),
    end: Math.min(LEVELS_PER_TRACK, focusLevel + WIN_BUFFER + 8),
  }));

  // ---- Scroll framing: instant positioning on arrival, native glides after ----
  const scrollRef = useRef<ScrollView>(null);
  const [viewportH, setViewportH] = useState(0);
  const centerScrollY = useCallback(
    (level: number) => {
      if (viewportH <= 0) return 0;
      const y = rowTop(level) + ROW_H / 2 - viewportH / 2;
      return Math.max(0, Math.min(y, Math.max(0, contentHeight - viewportH)));
    },
    [viewportH, rowTop, contentHeight],
  );
  // Latest framing fn for timer callbacks (the flow effect must not re-arm
  // when the viewport merely gets measured).
  const centerRef = useRef(centerScrollY);
  centerRef.current = centerScrollY;

  // Snap (unanimated) to the level the map opens on. Re-runs on param change,
  // so a pop-back from Puzzle re-frames on the just-completed node — and re-
  // centres the mount window over the levels this flow needs (from → to).
  useEffect(() => {
    if (viewportH <= 0) return;
    const focus = isFlowMode ? (fromLevel ?? animateTo ?? unlocked) : unlocked;
    scrollRef.current?.scrollTo({ y: centerScrollY(focus), animated: false });
    const lo = isFlowMode ? Math.min(fromLevel ?? focus, focus) : focus;
    const hi = isFlowMode ? Math.max(animateTo ?? focus, focus) : focus;
    setWin({
      start: Math.max(1, lo - WIN_BUFFER),
      end: Math.min(LEVELS_PER_TRACK, hi + WIN_BUFFER),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportH, isFlowMode, fromLevel, animateTo, unlocked]);

  // Feed the visibility window from real scroll events. The loop is 100 cheap
  // arithmetic checks per event; the setState is a no-op unless the window
  // moved, so scrolling itself never thrashes React.
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (viewportH <= 0) return;
      const y = e.nativeEvent.contentOffset.y;
      let start = LEVELS_PER_TRACK;
      let end = 1;
      for (let lvl = 1; lvl <= LEVELS_PER_TRACK; lvl++) {
        const top = rowTop(lvl);
        if (top + ROW_H >= y && top <= y + viewportH) {
          if (lvl < start) start = lvl;
          if (lvl > end) end = lvl;
        }
      }
      if (end < start) return;
      const next = {
        start: Math.max(1, start - WIN_BUFFER),
        end: Math.min(LEVELS_PER_TRACK, end + WIN_BUFFER),
      };
      setWin((prev) =>
        prev.start === next.start && prev.end === next.end ? prev : next,
      );
    },
    [viewportH, rowTop],
  );

  // ---- The ★ marker: one progress value — X/Y read straight off the river.
  // The view is LAID OUT at the swim's tail (the departure node) and the
  // transforms carry only the small delta along the curve. A layout frame at
  // the content origin + pure-transform positioning is exactly what Android's
  // view-clipping logic detaches (transforms aren't part of the clip bounds),
  // which used to make the star mount and swim completely invisible.
  const markerT = useRef(new Animated.Value(0)).current;
  const markerBase = { x: swim.xs[0], y: swim.ys[0] };
  const markerX = markerT.interpolate({
    inputRange: swim.ts,
    outputRange: swim.xs.map((x) => x - markerBase.x),
  });
  const markerY = markerT.interpolate({
    inputRange: swim.ts,
    outputRange: swim.ys.map((y) => y - markerBase.y),
  });
  const markerScale = useRef(new Animated.Value(1)).current;
  const [markerVisible, setMarkerVisible] = useState(false);

  // Breathing glow behind the current node's halo (1.6s loop, native-driven).
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: MOTION.nodePulseMs / 2,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: MOTION.nodePulseMs / 2,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const glow = pulse.interpolate({
    inputRange: [0.4, 1],
    outputRange: [0.12, 0.6],
  });

  // ---- Flow mode (UI-SPEC §4): settle → pop + glide → hold → next level ----
  useEffect(() => {
    if (!isFlowMode) {
      setMarkerVisible(false);
      return;
    }
    // Park the ★ at the tail of the swim path (the departure node); a
    // pop-back from Puzzle re-arms here because animateTo/fromLevel changed.
    const to = animateTo ?? unlocked;
    markerT.setValue(0);
    markerScale.setValue(1);
    setMarkerVisible(true);
    const cancels: (() => void)[] = [];
    cancels.push(
      after(MOTION.flowMarkerDelayMs, () => {
        Animated.parallel([
          // Swim up the river: X/Y are keyframed from samples of the curve
          // itself, so this single native-driven tween rides the flow.
          Animated.timing(markerT, {
            toValue: 1,
            duration: MOTION.markerGlideMs,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          // Pulse, overshoot, settle — the swimmer's kick.
          Animated.sequence([
            Animated.spring(markerScale, {
              toValue: 1.3,
              speed: 26,
              bounciness: 8,
              useNativeDriver: true,
            }),
            Animated.spring(markerScale, {
              toValue: 1,
              speed: 20,
              bounciness: 7,
              useNativeDriver: true,
            }),
          ]),
        ]).start();
        // The camera follows with the native scroll animation — no JS per frame.
        scrollRef.current?.scrollTo({
          y: centerRef.current(to),
          animated: true,
        });
      }),
      after(
        MOTION.flowMarkerDelayMs +
          MOTION.markerGlideMs +
          MOTION.flowLandingHoldMs,
        () => {
          if (autoStart && animateTo != null) {
            clearFlow();
            navigation.replace("Puzzle", { trackId, level: animateTo });
          } else {
            setMarkerVisible(false);
          }
        },
      ),
    );
    return () => cancels.forEach((c) => c());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFlowMode, animateTo, fromLevel, autoStart]);

  // Cancellation law safety net: leaving the map kills all pending automation.
  useEffect(() => () => clearFlow(), []);

  const goPlay = (level: number) => {
    if (level > unlocked) return;
    clearFlow(); // manual input kills all automation
    navigation.navigate("PreLevel", { trackId, level });
  };

  return (
    <View style={styles.root}>
      <WoodBackdrop />

      <View style={styles.header}>
        <IconButton
          icon='arrow-back'
          onPress={() => {
            clearFlow();
            navigation.navigate("Home");
          }}
          size={28}
        />
        <Text style={styles.heading}>{trackId}</Text>
        <Text style={styles.counter}>
          {unlocked}
          <Text style={styles.counterDim}> / {LEVELS_PER_TRACK}</Text>
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
        onScroll={onScroll}
        scrollEventThrottle={16}>
        {/* The river: short static strips — dark bed for the full length,
            brass flow where you've already climbed. Only strips inside the
            visibility window mount; painted once per unlock, never touched
            during scroll. */}
        {riverBands.map((band) => {
          const bStart = band.key;
          const bEnd = Math.min(LEVELS_PER_TRACK, bStart + RIVER_BAND - 1);
          if (bStart > win.end + 1 || bEnd < win.start - 1) return null;
          return (
            <Svg
              key={`river-${bStart}`}
              pointerEvents='none'
              style={{ position: "absolute", left: 0, top: band.top }}
              width={width}
              height={band.height}>
              <Polyline
                points={band.pts}
                fill='none'
                stroke={C.trailGroove}
                strokeWidth={15}
                strokeLinecap='round'
                strokeLinejoin='round'
              />
              {band.donePts.length > 0 && (
                <Polyline
                  points={band.donePts}
                  fill='none'
                  stroke={C.trailDashDone}
                  strokeWidth={10}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
              )}
            </Svg>
          );
        })}

        {levelsDescending.map((level) => {
          const mounted = level >= win.start && level <= win.end;
          // The gate lives between the last chapter-1 row and the first
          // chapter-2 row — show it while either side of it is mounted.
          const showGate =
            level === CHAPTER_SPLIT &&
            win.start <= CHAPTER_SPLIT + 1 &&
            win.end >= CHAPTER_SPLIT;
          if (!mounted && !showGate) return null;
          return (
            <React.Fragment key={level}>
              {showGate && (
                <ChapterGate top={rowTop(level) - GATE_H} trackId={trackId} />
              )}
              {mounted && (
                <View
                  style={[
                    styles.row,
                    {
                      top: rowTop(level),
                      transform: [{ translateX: riverX(level) - width / 2 }],
                    },
                  ]}>
                  {(level % 5 === 0 || level === unlocked) && (
                    <Text style={styles.levelNum}>{level}</Text>
                  )}
                  <MapNode
                    level={level}
                    state={nodeState(level, unlocked)}
                    glow={level === unlocked ? glow : 0}
                    bestTimeMs={
                      bests[`${trackId}-${level}`]?.bestTimeMs ?? null
                    }
                    onPress={() => goPlay(level)}
                  />
                </View>
              )}
            </React.Fragment>
          );
        })}

        {/* The ★ — laid out on the departure node, deltas ride the river */}
        {markerVisible && (
          <Animated.View
            pointerEvents='none'
            style={[
              styles.marker,
              {
                left: markerBase.x,
                top: markerBase.y,
                transform: [
                  { translateX: markerX },
                  { translateY: markerY },
                  { scale: markerScale },
                ],
              },
            ]}>
            <Icon name='star' size={26} color={C.brassText} />
          </Animated.View>
        )}
      </ScrollView>

      {/* Map-only adaptive banner (monetization spec §11) — pinned below the
          scrollable path so it can never cover a level node, and collapsed
          entirely while ad-free or unloaded. NEVER mount on the Puzzle
          screen: a banner there mis-taps drags. */}
      <MapBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgDeep },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 56,
    paddingBottom: 8,
    paddingHorizontal: SPACE.md,
    borderBottomWidth: 2,
    borderBottomColor: C.panelTopLine,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  heading: {
    color: C.textPrimary,
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: TYPE.serif,
  },
  counter: {
    color: C.brassLight,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: TYPE.serif,
    minWidth: 50,
    textAlign: "right",
  },
  counterDim: { color: C.labelTan, fontWeight: "400", fontSize: 13 },

  scroll: { flex: 1 },
  content: { height: TOP_PAD + LEVELS_PER_TRACK * ROW_H + GATE_H + BOTTOM_PAD },

  // One rung: disc on the river, level number tucked beneath. The whole row
  // is shifted onto the curve via a layout-neutral transform.
  row: {
    position: "absolute",
    left: 0,
    right: 0,
    height: ROW_H,
    paddingTop: (ROW_H - NODE) / 2,
    alignItems: "center",
  },
  levelNum: {
    color: C.labelTan,
    fontSize: 11,
    fontFamily: TYPE.serif,
    opacity: 0.85,
    marginTop: 1,
  },

  // Chapter 2 band between the chapters.
  gate: {
    position: "absolute",
    left: 0,
    right: 0,
    height: GATE_H,
    alignItems: "center",
    justifyContent: "center",
  },
  gateRule: {
    alignSelf: "center",
    width: 120,
    height: 2,
    borderRadius: 1,
    backgroundColor: C.brassDark,
    marginVertical: 7,
  },
  gateTitle: {
    color: C.brassLight,
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: "700",
    fontFamily: TYPE.serif,
  },
  gateSub: {
    color: C.labelTan,
    fontSize: 11,
    marginTop: 2,
    fontFamily: TYPE.serif,
  },

  // The ★ flow marker — same brass coin; its real position is set inline
  // (left/top at the swim's tail) so clipping never detaches it.
  marker: {
    position: "absolute",
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.brass,
    borderWidth: 2,
    borderColor: C.brassLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
});
