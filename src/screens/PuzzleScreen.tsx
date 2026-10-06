// SLYDE — Puzzle screen (UI-SPEC §6).
// HUD: time left / moves / target / goal plot (tap goal for full peek overlay),
// restart button. Timer drama: digits red ≤15s, tick zone ≤10s (audio Phase 4),
// red whole-screen urgency pulse ≤5s. Win/fail overlays per §6.5.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { C, MOTION, SPACE, TYPE } from '../theme';
import { after, clearFlow } from '../flow';
import { getLevel } from '../data/levels';
import { puzzleImageForLevel } from '../data/puzzles';
import { LEVELS_PER_TRACK } from '../config';
import { useAppStore } from '../store/app';
import { playSfx, haptic, setDucked } from '../audio';
import { WoodButton, Plaque, ConfirmDialog, IconButton, Icon, WoodBackdrop, WoodGlassSurface } from '../components/ui';
import { TileBoard, tileModeForLevel, BOARD_BORDER } from '../components/TileBoard';
import type { RootStackParamList } from '../nav';

type Props = NativeStackScreenProps<RootStackParamList, 'Puzzle'>;

// ---- Geometry constants -----------------------------------------------------
// Every size the HUD and the overlays need is derived from the window, never
// pinned to one phone — the Map's ladder is built the same way. A fixed pixel
// budget used to overflow its own chip on a narrow phone (or with Android's
// Display-size zoom), and since a chip's face clips its overflow, the goal
// miniature silently lost an outer column.
/** The goal chip is 1.5× a text chip in the HUD row's flex. */
const HUD_GOAL_FLEX = 1.5;
/** Three flex-1 chips + the goal chip = the row's flex total. */
const HUD_SLOTS_FLEX = 3 + HUD_GOAL_FLEX;
/** hudRow gap, and the horizontal padding inside a HUD chip. */
const HUD_GAP = 6;
const HUD_CHIP_PAD_X = 12;
/** The goal miniature fills its chip up to this height — the HUD stays a strip. */
const GOAL_MAX_BOARD_H = 72;
/** Overlay cards: one shared padding, plus caps so a tablet doesn't get an
 *  empty card and a narrow phone doesn't get a full-bleed one. */
const CARD_PAD = 28;
const CARD_MAX_W = 360;
const CARD_MIN_W = 240;

export default function PuzzleScreen({ route, navigation }: Props) {
  const { trackId, level } = route.params;
  const levelData = useMemo(() => getLevel(trackId, level), [trackId, level]);
  const cols = levelData.cols;
  const rows = levelData.rows;
  // The previews below are sized from the live window, so a rotation or an
  // Android Display-size change re-lays them out instead of clipping them.
  const { width: screenW, height: screenH } = useWindowDimensions();
  // The picture this level is cut from (undefined → palette-swatch fallback).
  const imageSource = puzzleImageForLevel(levelData);

  const completeLevel = useAppStore((s) => s.completeLevel);
  const failLevel = useAppStore((s) => s.failLevel);

  const [attemptId, setAttemptId] = useState(0);
  const [tiles, setTiles] = useState<number[]>(() => levelData.initialTiles.slice());
  const [moves, setMoves] = useState(0);
  const [status, setStatus] = useState<'idle' | 'running' | 'won' | 'failed'>('idle');
  const [timeLeft, setTimeLeft] = useState(levelData.timeLimitSeconds);
  const [attempts, setAttempts] = useState(1);
  const [restarted, setRestarted] = useState(false);
  const [goalPeek, setGoalPeek] = useState(false);
  const [boardArea, setBoardArea] = useState({ w: 0, h: 0 });
  const [winInfo, setWinInfo] = useState<{ timeMs: number; moves: number; newBest: boolean } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);
  const wonRef = useRef(false);
  const failHandledRef = useRef(false);
  const lastWholeSecRef = useRef(-1);
  const urgency = useRef(new Animated.Value(0)).current;
  const totalCells = cols * rows;

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Red urgency pulse (≤5s): overlay opacity 0→30%→0, 320ms/cycle.
  useEffect(() => {
    if (timeLeft <= 5 && timeLeft > 0) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(urgency, { toValue: 0.3, duration: MOTION.urgencyPulseMs / 2, useNativeDriver: true }),
          Animated.timing(urgency, { toValue: 0, duration: MOTION.urgencyPulseMs / 2, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    urgency.setValue(0);
    return;
  }, [timeLeft, urgency]);

  useEffect(() => {
    beginTimer();
    return () => stopTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  const win = useCallback(
    (elapsedMs: number) => {
      if (wonRef.current) return;
      wonRef.current = true;
      stopTimer();
      const firstAttempt = attempts === 1 && !restarted;
      setStatus('won');
      playSfx('win');
      // haptic('success');
      void completeLevel({ track: trackId, level, timeMs: elapsedMs, moves, firstAttempt }).then(
        ({ newBestTime }) => {
          setWinInfo({ timeMs: elapsedMs, moves, newBest: newBestTime });
          if (newBestTime) {
            // 4-note fanfare ~0.6s after the win chime (UI-SPEC §11).
            setTimeout(() => playSfx('best'), 600);
          }
        }
      );
    },
    [attempts, restarted, completeLevel, trackId, level, moves, stopTimer]
  );


  // Auto-flow after a win (Flow 2): hold 2200ms => Map flow mode => star N->N+1.
  useEffect(() => {
    if (status !== 'won') return;
    const cancels: (() => void)[] = [];
    cancels.push(
      after(MOTION.winHoldMs, () => {
        clearFlow();
        if (level >= LEVELS_PER_TRACK) {
          // No level 101 — hand the player back to the map (manual mode).
          navigation.popTo('Map', { trackId });
        } else {
          // popTo, not replace: the Map may still be below us from manual play,
          // and a second Map stacked over the first would make back ambiguous.
          navigation.popTo('Map', { trackId, fromLevel: level, animateTo: level + 1, autoStart: true });
        }
      })
    );
    return () => cancels.forEach((c) => c());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status === 'won']);

  // Idle-aware fail gate (Flow 3): silence 5000ms => land on Map.
  const [failArmed, setFailArmed] = useState(false);
  useEffect(() => {
    if (status !== 'failed') return;
    const cancels: (() => void)[] = [];
    cancels.push(
      after(MOTION.failIdleMs, () => {
        clearFlow();
        navigation.popTo('Map', { trackId });
      })
    );
    return () => cancels.forEach((c) => c());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status === 'failed']);

  useEffect(() => {
    if (status === 'failed' && failArmed) {
      const t = setTimeout(() => {
        clearFlow();
        restart();
      }, MOTION.failReadyMs);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failArmed, status === 'failed']);  function beginTimer() {
    stopTimer();
    const total = levelData.timeLimitSeconds;
    setTimeLeft(total);
    setStatus('idle');
    setDucked(false);
    startRef.current = Date.now();
    lastWholeSecRef.current = total + 1;
    playSfx('start');
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const left = Math.max(0, Math.ceil(total - elapsed / 1000));
      setTimeLeft(left);
      // Fire tick/urgent once per second-boundary, not per 200ms poll.
      const whole = Math.ceil(total - elapsed / 1000);
      if (whole !== lastWholeSecRef.current) {
        lastWholeSecRef.current = whole;
        if (left <= 0) {
          stopTimer();
          setDucked(false);
          if (!failHandledRef.current) {
            failHandledRef.current = true;
            playSfx('fail');
            haptic('error');
            failLevel(trackId);
            setStatus('failed');
          }
        } else if (left <= 5) {
          // Urgent zone: double-beep + haptic each second (music stays ducked).
          playSfx('urgent');
          haptic('medium');
        } else if (left <= 10) {
          // Tick zone: tick each second; music ducks to ~1/3.
          playSfx('tick');
          setDucked(true);
        } else {
          setDucked(false);
        }
      }
    }, 200);
  }

  const restart = useCallback(() => {
    stopTimer();
    wonRef.current = false;
    failHandledRef.current = false;
    setAttempts((a) => a + 1);
    setRestarted(true);
    setTiles(levelData.initialTiles.slice());
    setMoves(0);
    setStatus('idle');
    setWinInfo(null);
    setAttemptId((id) => id + 1); // remounts the board (per §6.6)
  }, [levelData.initialTiles, stopTimer]);
  const [quitVisible, setQuitVisible] = useState(false);
  const confirmQuit = () => {
    clearFlow();
    setQuitVisible(true);
  };

  /**
   * Every "leave the level" action lands on the Level Map — the hub you came
   * from — and never straight on Home or Splash.
   *
   * popTo targets the Map by NAME instead of counting screens: if the Map is
   * below us (manual play: Home > Map > Puzzle) it is popped back to, and if the
   * ★ auto-start replaced it (flow play: Home > Puzzle) it is put back in its
   * place. Either way the stack is exactly Home > Map — back/quit can't
   * overshoot to Home, can't land on Splash, and can't stack a second Map.
   *
   * Only trackId travels with us, so the Map returns in its calm manual mode and
   * a stale animateTo/autoStart can't replay the ★ sequence (cancellation law).
   */
  const backToMap = useCallback(() => {
    clearFlow();
    navigation.popTo('Map', { trackId });
  }, [navigation, trackId]);

  function attemptSlide(index: number) {
    if (status === 'won' || status === 'failed') return;
    const blank = tiles.indexOf(0);
    const tc = index % cols;
    const tr = Math.floor(index / cols);
    const bc = blank % cols;
    const br = Math.floor(blank / cols);
    const adjacent = Math.abs(tc - bc) + Math.abs(tr - br) === 1;
    if (!adjacent) return;

    const next = tiles.slice();
    next[index] = 0;
    next[blank] = tiles[index];
    setTiles(next);
    setMoves((m) => m + 1);
    playSfx('thock');
    haptic('light');
    if (status === 'idle') setStatus('running');

    const solved = next.every((v, i) => v === (i === totalCells - 1 ? 0 : i + 1));
    if (solved) win(Date.now() - startRef.current);
  }
  const tileSize = useMemo(() => {
    if (boardArea.w <= 0 || boardArea.h <= 0) return 64;
    // Board outer size = cols*tileSize + 2*BOARD_BORDER; fit it in the area.
    const availW = boardArea.w - BOARD_BORDER * 2 - 4;
    const availH = boardArea.h - BOARD_BORDER * 2 - 4;
    const fit = Math.min(availW / cols, availH / rows);
    // Clamp: never below usable, never cartoonishly large on 3×3 boards.
    return Math.max(34, Math.min(110, Math.floor(fit)));
  }, [boardArea, cols, rows]);

  // ---- Miniature sizes: pure math from the window (nothing measured here) ----
  // The goal chip's width is decided by the HUD row's flex, so its preview is
  // sized from that same fraction: it fits the chip on every phone, and on a
  // tablet the chip and the preview grow together instead of a fixed 72px toy
  // sitting in the middle of a large empty card.
  const chipInnerW =
    (screenW - SPACE.md * 2 - HUD_GAP * 3) * (HUD_GOAL_FLEX / HUD_SLOTS_FLEX) -
    HUD_CHIP_PAD_X * 2;
  // Peek / win / fail cards: a margin on a phone, a cap on a tablet.
  const cardW = Math.min(CARD_MAX_W, Math.max(CARD_MIN_W, screenW - SPACE.xl * 2));
  const cardInnerW = cardW - CARD_PAD * 2;
  // Both previews are grids, so a cell is bound by the tighter axis: does the
  // grid fit the box's width? its height? The height terms keep the goal chip a
  // strip and keep the peek card's title + hint on screen.
  const goalCell = Math.max(
    6,
    Math.min(
      Math.floor(chipInnerW / cols),
      Math.floor(chipInnerW / rows),
      Math.floor(GOAL_MAX_BOARD_H / rows)
    )
  );
  const peekCell = Math.max(
    10,
    Math.min(
      Math.floor(cardInnerW / cols),
      Math.floor(cardInnerW / rows),
      Math.floor((screenH * 0.5) / rows)
    )
  );

  const solvedTiles = useMemo(() => {
    const arr = new Array<number>(totalCells);
    for (let i = 0; i < totalCells - 1; i++) arr[i] = i + 1;
    arr[totalCells - 1] = 0;
    return arr;
  }, [totalCells]);

  return (
    <View style={styles.root}>
      <WoodBackdrop />
      <View style={styles.topBar}>
        <IconButton
          icon="arrow-back"
          onPress={confirmQuit}
          size={28}
          hitSlop={12}
        />
        <Text style={styles.topTitle}> Level {level}</Text>
        <IconButton
          icon="refresh"
          onPress={restart}
          size={24}
        />
      </View>

      <View style={styles.hudRow}>
        <Plaque
          accent={timeLeft <= 15 ? C.red : undefined}
          style={styles.hudPlaque}
          bodyStyle={styles.hudPlaqueBody}>
          <Text style={styles.hudLabel}>TIME</Text>
          <Text style={[styles.hudValue, timeLeft <= 15 && styles.clockWarn, timeLeft <= 5 && styles.clockCrit]}>
            {formatClock(timeLeft)}
          </Text>
        </Plaque>
        <Plaque style={styles.hudPlaque} bodyStyle={styles.hudPlaqueBody}>
          <Text style={styles.hudLabel}>MOVES</Text>
          <Text style={styles.hudValue}>{moves}</Text>
        </Plaque>
        <Plaque style={styles.hudPlaque} bodyStyle={styles.hudPlaqueBody}>
          <Text style={styles.hudLabel}>TARGET</Text>
          <Text style={styles.hudValue}>~{levelData.targetSolveDistance}</Text>
        </Plaque>
        <Pressable
          onPress={() => setGoalPeek(true)}
          style={({ pressed }) => [styles.goalBtn, pressed && styles.goalBtnPressed]}>
          <Plaque style={styles.goalPlaque} bodyStyle={styles.goalPlaqueBody}>
            <Text style={styles.hudLabel}>GOAL</Text>
            <MiniBoard tiles={solvedTiles} cols={cols} rows={rows} cell={goalCell} mode={tileModeForLevel(levelData)} imageSource={imageSource} />
          </Plaque>
        </Pressable>
      </View>

      <View
        style={styles.boardWrap}
        onLayout={(e) =>
          setBoardArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
        }
      >
        <TileBoard key={attemptId} level={levelData} tiles={tiles} tileSize={tileSize} onSlide={attemptSlide} />
      </View>

      {timeLeft <= 5 && timeLeft > 0 && status !== 'won' && (
        <Animated.View pointerEvents="none" style={[styles.urgent, { opacity: urgency }]} />
      )}

      {goalPeek && (
        <Pressable style={styles.overlay} onPress={() => setGoalPeek(false)}>
          <WoodGlassSurface
            radius={20}
            tone='glass'
            bodyStyle={[styles.overlayCardBody, { width: cardW }]}>
            <Text style={styles.goalPeekTitle}>Goal</Text>
            <MiniBoard tiles={solvedTiles} cols={cols} rows={rows} cell={peekCell} mode={tileModeForLevel(levelData)} imageSource={imageSource} />
            <Text style={styles.goalPeekHint}>tap anywhere to close</Text>
            <WoodButton
              style={styles.cancelButton}
              onPress={() => setGoalPeek(false)}
              label="Cancel"
            />
          </WoodGlassSurface>
        </Pressable>
      )}

      {status === 'won' && (
        <View style={styles.overlay}>
          <WoodGlassSurface
            radius={20}
            tone='glass'
            bodyStyle={[styles.overlayCardBody, { width: cardW }]}>
            <Text style={styles.overlayTitle}>Solved! </Text>
            {winInfo && (
              <View style={styles.winStats}>
                <Text style={styles.winLine}>{formatClock(Math.round(winInfo.timeMs / 1000))} · {winInfo.moves} moves</Text>
                {winInfo.newBest && <Text style={styles.newBest}> New personal best!</Text>}
              </View>
            )}
            <WoodButton
              label={level < LEVELS_PER_TRACK ? 'Next level' : 'Level map'}
              onPress={() => {
                if (level < LEVELS_PER_TRACK) { clearFlow(); navigation.replace('PreLevel', { trackId, level: level + 1 }); }
                else backToMap();
              }}
              style={styles.overlayButton}
            />
            <WoodButton label="Level map" variant="ghost" onPress={backToMap} style={styles.overlayButton} />
          </WoodGlassSurface>
        </View>
      )}

      {status === 'failed' && (
        <Pressable style={styles.overlay} onPress={() => { clearFlow(); setFailArmed(true); }}>
          <WoodGlassSurface
            radius={20}
            tone='glass'
            bodyStyle={[styles.overlayCardBody, { width: cardW }]}>
            <Text style={styles.overlayTitleDanger}>Time's up!</Text>
            <Text style={styles.overlayBody}>Tap anywhere to auto-retry…</Text>
            <WoodButton label="Retry now" onPress={restart} style={styles.overlayButton} />
            <WoodButton label="Level map" variant="ghost" onPress={backToMap} style={styles.overlayButton} />
          </WoodGlassSurface>
        </Pressable>
      )}

      <ConfirmDialog
        visible={quitVisible}
        title="Leave the level?"
        body="Progress on this attempt will be lost."
        confirmLabel="Leave"
        cancelLabel="Keep playing"
        destructive
        onConfirm={() => {
          setQuitVisible(false);
          backToMap();
        }}
        onCancel={() => setQuitVisible(false)}
      />
    </View>
  );
}

function MiniBoard({ tiles, cols, rows, cell, mode, imageSource }: {
  tiles: number[];
  cols: number;
  rows: number;
  cell: number;
  mode: 'number' | 'image-number' | 'image';
  imageSource?: number;
}) {
  // Tile inner content box for the scaled-down preview.
  const sliceW = cell - 2;
  const sliceH = cell - 3;
  return (
    <View style={{ width: cols * cell, height: rows * cell, marginTop: 2 }}>
      {tiles.map((value, index) => {
        if (value === 0) return <View key={index} style={{ width: cell, height: cell }} />;
        const col = index % cols;
        const row = Math.floor(index / cols);
        const homeCol = (value - 1) % cols;
        const homeRow = Math.floor((value - 1) / cols);
        const showImage = imageSource !== undefined && mode !== 'number';
        return (
          <View key={index} style={{ position: 'absolute', left: col * cell, top: row * cell, width: cell, height: cell, backgroundColor: C.tileFace, borderRadius: cell / 20, borderTopWidth: 1, borderTopColor: C.tileBevelLight, borderBottomWidth: 0.5, borderBottomColor: C.tileBevelDark, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',paddingRight: 2 }}>
            {mode === 'number' ? (
              <Text style={{ color: C.tileText, fontSize: cell * 0.45, fontWeight: '700' }}>{value}</Text>
            ) : showImage ? (
              <Image
                source={imageSource}
                style={{ position: 'absolute', left: -homeCol * sliceW, top: -homeRow * sliceH, width: cols * sliceW, height: rows * sliceH }}
                resizeMode="cover"
                fadeDuration={0}
              />
            ) : (
              <View style={{ flex: 1, alignSelf: 'stretch', margin: 1, borderRadius: 2, backgroundColor: imageColor(value) }} />
            )}
            {mode === 'image-number' && (
              <View
                style={{
                  position: 'absolute',
                  top: 1,
                  left: 1,
                  backgroundColor: C.brass,
                  borderRadius: 4,
                  paddingHorizontal: 2,
                }}
              >
                {/* <Text style={{ color: C.brassText, fontSize: Math.max(7, cell * 0.3), fontWeight: '700' }}>
                  {value}
                </Text> */}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function imageColor(value: number): string {
  const palette = ['#8a5a3b', '#5b7a5a', '#6b5a8a', '#a37635', '#7a5a4a', '#4a7a8a', '#8a7a5a', '#5a8a6a'];
  return palette[value % palette.length];
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgWood },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: SPACE.md },
  topTitle: { color: C.textPrimary, fontSize: 17, fontWeight: '700', fontFamily: TYPE.serif },
  hudRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: SPACE.md, marginTop: 10, gap: HUD_GAP },
  hudPlaque: { flex: 1 },
  hudPlaqueBody: { paddingVertical: 6, paddingHorizontal: HUD_CHIP_PAD_X, alignItems: 'center' },
  hudLabel: { color: C.labelTan, fontSize: 9, letterSpacing: 1, fontFamily: TYPE.serif },
  hudValue: { color: C.textPrimary, fontSize: 16, fontWeight: '700', fontFamily: TYPE.serif, fontVariant: ['tabular-nums'], marginTop: 2 },
  clockWarn: { color: C.timerWarn },
  clockCrit: { color: C.timerCritical },
  goalBtn: { flex: HUD_GOAL_FLEX },
  goalBtnPressed: { transform: [{ translateY: 2 }], opacity: 0.92 },
  goalPlaque: { alignSelf: 'stretch' },
  goalPlaqueBody: { paddingVertical: 2, paddingHorizontal: HUD_CHIP_PAD_X, alignItems: 'center' },
  boardWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingBottom: 10 },
  urgent: { ...StyleSheet.absoluteFill, backgroundColor: C.red },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: C.overlayDim, alignItems: 'center', justifyContent: 'center' },
  // The finish (wood under glass) comes from WoodGlassSurface — this is only the
  // modal card's inner padding and alignment. Its width comes from the window
  // (cardW in the screen), so the card keeps a margin on a phone and grows on a
  // tablet; the peek preview is sized from cardInnerW so it always fits.
  overlayCardBody: { padding: CARD_PAD, alignItems: 'center' },
  overlayTitle: { color: C.success, fontSize: 28, fontWeight: '700', fontFamily: TYPE.serif },
  overlayTitleDanger: { color: C.danger, fontSize: 26, fontWeight: '700', fontFamily: TYPE.serif },
  overlayBody: { color: C.labelTan, fontSize: 15, marginVertical: 10, textAlign: 'center', fontFamily: TYPE.serif },
  overlayButton: { alignSelf: 'stretch', marginTop: 10 },
   cancelButton: { alignSelf: 'stretch', marginTop: 16 },
  winStats: { alignItems: 'center', marginTop: 8, marginBottom: 4 },
  winLine: { color: C.textPrimary, fontSize: 16, fontFamily: TYPE.serif },
  newBest: { color: C.gold, fontSize: 14, fontWeight: '700', marginTop: 4, fontFamily: TYPE.serif },
  goalPeekTitle: { color: C.textGold, fontSize: 24, fontWeight: '700', marginBottom: 12, fontFamily: TYPE.serif },
  goalPeekHint: { color: C.labelTan, fontSize: 12, marginTop: 14, fontFamily: TYPE.serif },
});