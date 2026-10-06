// SLYDE — TileBoard (UI-SPEC §6.1, §6.2).
// Carved wooden tray, 3D light-wood tiles (2px light top / 3px dark bottom,
// 9px corners, 2px margins). A tile slides when you TAP it or DRAG it toward the
// blank: the locked rules live in tileGesture.ts and the motion is the spec's
// (lift 80ms, settle 140ms, snap-back 130ms).
// Tiles position-offset to home coordinates here: a tile is laid out at its home
// cell for life and moved only by animated offsets, so a move never re-lays-out
// the board and the settle can play while the logical move has already landed
// (UI-SPEC §6.2: "instant commit + 140ms settle").

import React, { useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, PanResponder, StyleSheet, Text, View } from 'react-native';
import { C, MOTION, TYPE } from '../theme';
import type { LevelRecord } from '../types';
import { puzzleImageForLevel } from '../data/puzzles';
import { commitsSlide, dragOffset, tileMove } from './tileGesture';

export type TileMode = 'number' | 'image-number' | 'image';

/** Width of the carved wood tray border (px). */
export const BOARD_BORDER = 12;
/** Gap between neighbouring tiles (px). */
export const TILE_MARGIN = -10;

/** Tile lift while held: scale + upward nudge (UI-SPEC §6.2, §12). */
const LIFT_SCALE = 1.06;
const LIFT_Y = -4;

/** Outer size of a board (tray border included) for a given tile size. */
export function boardOuterSize(tileSize: number, cols: number, rows: number) {
  return {
    width: cols * tileSize + BOARD_BORDER * 2,
    height: rows * tileSize + BOARD_BORDER * 2,
  };
}

export interface TileBoardProps {
  level: LevelRecord;
  tiles: number[];
  tileSize?: number;
  onSlide: (index: number) => void;
}

export function tileModeForLevel(level: LevelRecord): TileMode {
  const cells = level.cols * level.rows;
  if (cells <= 12) return 'number';
  if (level.cols === 4) return 'image-number';
  return 'image';
}

export function TileBoard({ level, tiles, tileSize = 64, onSlide }: TileBoardProps) {
  const cols = level.cols;
  const rows = level.rows;
  const mode = tileModeForLevel(level);
  const { width: boardWidth, height: boardHeight } = boardOuterSize(tileSize, cols, rows);
  // The picture this board is cut from (undefined → palette-swatch fallback).
  const imageSource = puzzleImageForLevel(level);
  // Where the hole is — tiles next to it are the only movable ones.
  const blank = tiles.indexOf(0);

  return (
    <View style={[styles.board, { width: boardWidth, height: boardHeight }]}>
      {tiles.map((value, index) => {
        if (value === 0) return null;
        const col = index % cols;
        const row = Math.floor(index / cols);
        // Home cell of this tile inside the finished picture.
        const homeCol = (value - 1) % cols;
        const homeRow = Math.floor((value - 1) / cols);
        return (
          <TileView
            key={value}
            value={value}
            index={index}
            blankIndex={blank}
            col={col}
            row={row}
            homeCol={homeCol}
            homeRow={homeRow}
            cols={cols}
            rows={rows}
            size={tileSize}
            mode={mode}
            imageSource={imageSource}
            onSlide={onSlide}
          />
        );
      })}
    </View>
  );
}

function TileView({
  value,
  index,
  blankIndex,
  col,
  row,
  homeCol,
  homeRow,
  cols,
  rows,
  size,
  mode,
  imageSource,
  onSlide,
}: {
  value: number;
  index: number;
  blankIndex: number;
  col: number;
  row: number;
  homeCol: number;
  homeRow: number;
  cols: number;
  rows: number;
  size: number;
  mode: TileMode;
  imageSource?: number;
  onSlide: (index: number) => void;
}) {
  // Inner content box of a tile face (borders: 2px left/right, 2+3px top/bottom).
  const sliceW = size - 8;
  const sliceH = size - 9;
  const showImage = imageSource !== undefined && mode !== 'number';

  // Where this tile may go — the locked rules live in tileGesture.ts so they
  // stay testable: single-tile, axis-locked slides to a neighbouring blank.
  const move = tileMove(col, row, value, blankIndex, cols, size);
  const { cellX, cellY } = move;

  // The tile is laid out at its home cell for life and moved only by offsets:
  // `cell` = which cell it sits in, `drag` = the finger, `lift` = seated→held.
  // The rendered position therefore never depends on React state, so a move can
  // land the instant the finger lifts (UI-SPEC §6.2: "instant commit + 140ms
  // settle") while the tile still glides — no jump cut, and the recorded solve
  // time stays honest because nothing waits on the animation.
  const cell = useRef(new Animated.ValueXY({ x: cellX, y: cellY })).current;
  const drag = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const lift = useRef(new Animated.Value(0)).current; // 0 = seated, 1 = lifted
  const busy = useRef(false); // held or settling → refuse new gestures
  const [held, setHeld] = useState(false); // a lifted tile draws over its neighbours

  // PanResponder handlers are created once, so they read the live frame's values
  // through this ref instead of closing over a stale render.
  const live = useRef({ size, move, index, onSlide });
  live.current = { size, move, index, onSlide };

  // A board that lays out at a new position (resize, restart, or a move this
  // tile did not animate itself) must not keep a stale offset behind.
  useLayoutEffect(() => {
    if (busy.current) return; // our own glide is already heading for the target
    cell.setValue({ x: cellX, y: cellY });
  }, [cell, cellX, cellY]);

  function liftUp() {
    setHeld(true);
    Animated.timing(lift, {
      toValue: 1,
      duration: MOTION.tileLiftMs,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }

  /** Glide into a cell offset, then seat the tile again. */
  function glide(target: { x: number; y: number }, duration: number) {
    const settle = { duration, easing: Easing.out(Easing.cubic), useNativeDriver: false } as const;
    Animated.parallel([
      Animated.timing(cell, { ...settle, toValue: target }),
      Animated.timing(drag, { ...settle, toValue: { x: 0, y: 0 } }),
      Animated.timing(lift, { ...settle, toValue: 0 }),
    ]).start(() => {
      busy.current = false;
      setHeld(false);
    });
  }

  /** Released short of the threshold: slide back home (UI-SPEC §12). */
  function snapBack() {
    const back = { duration: MOTION.tileSnapBackMs, easing: Easing.out(Easing.cubic), useNativeDriver: false } as const;
    Animated.parallel([
      Animated.timing(drag, { ...back, toValue: { x: 0, y: 0 } }),
      Animated.timing(lift, { ...back, toValue: 0 }),
    ]).start(() => {
      busy.current = false;
      setHeld(false);
    });
  }

  /** Tap, or a drag past 35% of a cell: the move lands now, the tile glides. */
  function commit() {
    const { index: cellIndex, move: destination, onSlide: emit } = live.current;
    emit(cellIndex); // the parent owns moves/timer/win — hand it over now
    glide({ x: destination.nextX, y: destination.nextY }, MOTION.tileSettleMs);
  }

  const pan = useRef(
    PanResponder.create({
      // Only a movable tile claims the touch at all — same rule as a plain tap.
      onStartShouldSetPanResponder: () => live.current.move.adjacent && !busy.current,
      onPanResponderGrant: () => {
        busy.current = true;
        liftUp();
      },
      onPanResponderMove: (_evt, g) => {
        const { size: cellSize, move: m } = live.current;
        drag.setValue(dragOffset(m, g.dx, g.dy, cellSize));
      },
      onPanResponderRelease: (_evt, g) => {
        const { size: cellSize, move: m } = live.current;
        // A tap (barely any travel) or a drag that carried ≥35% of the cell
        // toward the blank slots the tile in; anything shorter snaps back.
        if (commitsSlide(m, g.dx, g.dy, cellSize)) commit();
        else snapBack();
      },
      onPanResponderTerminate: () => snapBack(),
      onPanResponderTerminationRequest: () => true,
    })
  ).current;

  const liftScale = lift.interpolate({ inputRange: [0, 1], outputRange: [1, LIFT_SCALE] });
  const liftOffset = lift.interpolate({ inputRange: [0, 1], outputRange: [0, LIFT_Y] });

  return (
    <Animated.View
      {...pan.panHandlers}
      style={[
        styles.tile,
        held && styles.tileHeld,
        {
          left: BOARD_BORDER + TILE_MARGIN + homeCol * size,
          top: BOARD_BORDER + TILE_MARGIN + homeRow * size,
          width: size,
          height: size,
          // Offset transforms compose in order: cell → finger → lift nudge.
          transform: [
            { translateX: cell.x },
            { translateY: cell.y },
            { translateX: drag.x },
            { translateY: drag.y },
            { scale: liftScale },
            { translateY: liftOffset },
          ],
        },
      ]}
    >
      <View style={styles.tileFace}>
        {mode === 'number' ? (
          <Text style={[styles.tileNumber, { fontSize: size * 0.4 }]}>{value}</Text>
        ) : showImage ? (
          // Slice of the level's picture: the whole image scaled to the board,
          // shifted so this tile's home cell sits inside the tile frame.
          <Image
            source={imageSource}
            style={{
              position: 'absolute',
              left: -homeCol * sliceW,
              top: -homeRow * sliceH,
              width: cols * sliceW,
              height: rows * sliceH,
            }}
            resizeMode="cover"
            fadeDuration={0}
          />
        ) : (
          <View style={styles.imageSlice}>
            <View style={[styles.imageSwatch, { backgroundColor: imageColor(value) }]} />
          </View>
        )}
        {mode === 'image-number' && (
          <View style={styles.brassBadge}>
            <Text style={styles.brassBadgeText}>{value}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

function imageColor(value: number): string {
  const palette = ['#8a5a3b', '#5b7a5a', '#6b5a8a', '#a37635', '#7a5a4a', '#4a7a8a', '#8a7a5a', '#5a8a6a'];
  return palette[value % palette.length];
}

const styles = StyleSheet.create({
  board: {
    backgroundColor: C.boardInset,
    borderColor: C.boardBorder,
    borderWidth: 10, // 10px wood tray border
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  tile: { position: 'absolute' },
  // A held/dragged tile is lifted, so it must draw above its neighbours.
  tileHeld: { zIndex: 10 },
  tileFace: {
    flex: 1,
    borderRadius: 9, // 9px corners
    backgroundColor: C.tileFace,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 3, // dark 3px bottom edge (lighting model)
    borderTopColor: C.tileBevelLight,
    borderLeftColor: C.tileBevelLight,
    borderRightColor: C.tileBevelDark,
    borderBottomColor: C.tileBevelDark,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  tileNumber: {
    color: C.tileText,
    fontWeight: '700',
    fontFamily: TYPE.serif,
  },
  imageSlice: { flex: 1, alignSelf: 'stretch' },
  imageSwatch: { flex: 1, borderRadius: 4 },
  brassBadge: {
    position: 'absolute',
    top: 3,
    left: 3,
    backgroundColor: C.brass,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  brassBadgeText: { color: C.brassText, fontSize: 11, fontWeight: '700' },
});
