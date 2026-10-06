// SLYDE — one Level-Map node: a carved socket with a raised wooden disc
// (UI-SPEC §4, lighting §1.2 — light from top-left). The 3D is the same
// layered-flat-shapes trick as the tiles: a dark socket recess, the disc's
// dark base peeking out below its lit face (thickness), a specular nick at
// the top-left. Icons are DRAWN in SVG — padlock (locked), paw print
// (current), brass check badge (done), brass inlay ring (every 10th level).
// Tapping presses the disc down into its socket.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { C, MOTION, TYPE, svgPaint } from '../theme';

const WRAP = 46; // layout footprint — identical to the old flat node
const BOX = 60; // svg canvas (room for the milestone ring + cast shadow)
const CENTER = BOX / 2;

export type MapNodeState = 'done' | 'current' | 'locked';

/** Drawn padlock for locked nodes (centred in the box). */
function Padlock() {
  return (
    <>
      <Path
        d="M 25.5 29.5 v -3.5 a 4.5 4.5 0 0 1 9 0 v 3.5"
        stroke={C.nodeLockedIcon}
        strokeWidth={2.6}
        strokeLinecap="round"
        fill="none"
      />
      <Rect x={24} y={29.5} width={12} height={9.5} rx={2.4} fill={C.nodeLockedIcon} />
      <Circle cx={30} cy={33} r={1.5} fill={C.nodeLockedBottom} />
      <Rect x={29.3} y={33} width={1.4} height={3.4} fill={C.nodeLockedBottom} />
    </>
  );
}

/** Drawn paw print for the current node — the trailhead companion. */
function Paw() {
  return (
    <>
      <Ellipse cx={23.4} cy={26} rx={2} ry={2.6} fill={C.brassText} />
      <Ellipse cx={27.7} cy={23.8} rx={2} ry={2.6} fill={C.brassText} />
      <Ellipse cx={32.3} cy={23.8} rx={2} ry={2.6} fill={C.brassText} />
      <Ellipse cx={36.6} cy={26} rx={2} ry={2.6} fill={C.brassText} />
      <Ellipse cx={30} cy={31.4} rx={5.4} ry={4.4} fill={C.brassText} />
    </>
  );
}

/** Brass check badge pinned on a conquered node. */
function CheckBadge() {
  return (
    <>
      <Circle cx={43} cy={17} r={7.6} fill={C.brass} stroke={C.brassDark} strokeWidth={1.4} />
      <Path
        d="M 39.2 17.2 l 2.6 2.8 l 5.2 -5.8"
        stroke={C.brassText}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  );
}

export default function MapNode({
  level,
  state,
  glow,
  bestTimeMs,
  onPress,
}: {
  level: number;
  state: MapNodeState;
  glow: number | Animated.AnimatedInterpolation<string | number>;
  bestTimeMs: number | null;
  onPress: () => void;
}) {
  const press = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;

  // No entry animation on purpose: every node paints at full opacity the
  // moment the map scenery mounts, so the board is complete on the very first
  // frame instead of trickling in over ~900ms.

  // Current node only: a slow bob, and a shine that orbits the disc.
  useEffect(() => {
    if (state !== 'current') return;
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: MOTION.nodeBobMs / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: MOTION.nodeBobMs / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    const shineLoop = Animated.loop(
      Animated.timing(shine, {
        toValue: 1,
        duration: MOTION.nodeShineMs,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    bobLoop.start();
    shineLoop.start();
    return () => {
      bobLoop.stop();
      shineLoop.stop();
    };
  }, [state, bob, shine]);

  const pressIn = () =>
    Animated.spring(press, { toValue: 1, speed: 34, bounciness: 0, useNativeDriver: true }).start();
  const pressOut = () =>
    Animated.spring(press, { toValue: 0, speed: 30, bounciness: 7, useNativeDriver: true }).start();

  const faceTop =
    state === 'done' ? C.nodeDoneTop : state === 'current' ? C.nodeCurrentTop : C.nodeLockedTop;
  const faceBottom =
    state === 'done'
      ? C.nodeDoneBottom
      : state === 'current'
        ? C.nodeCurrentBottom
        : C.nodeLockedBottom;
  const sink = state === 'locked' ? 2 : 0; // locked discs sit deeper in the socket

  // These three tokens are rgba(): split them for SVG, or react-native-svg
  // drops the alpha and paints the highlights fully opaque (see theme.ts).
  const rim = svgPaint(C.nodeRim);
  const socketLip = svgPaint(C.nodeSocketLip);
  const sheen = svgPaint(C.nodeSheen);

  const pressY = press.interpolate({ inputRange: [0, 1], outputRange: [0, 2.5] });
  const pressScale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.95] });
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  const spin = shine.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const bestSecs = bestTimeMs != null ? (bestTimeMs / 1000).toFixed(1) : null;

  return (
    <Animated.View style={styles.wrap}>
      {state === 'current' && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            { opacity: glow, transform: [{ scale: Animated.add(1, Animated.multiply(glow, 0.5)) }] },
          ]}
        />
      )}

      {/* The carved socket (static — part of the table) */}
      <Svg width={BOX} height={BOX} style={styles.socket} pointerEvents="none">
        <Circle cx={CENTER} cy={CENTER} r={25} fill={C.nodeSocket} />
        <Ellipse cx={CENTER} cy={CENTER - 19} rx={15} ry={5} fill={rim.color} fillOpacity={rim.alpha} />
        <Ellipse cx={CENTER} cy={CENTER + 19.5} rx={15} ry={4.5} fill={socketLip.color} fillOpacity={socketLip.alpha} />
        {level % 10 === 0 && (
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={27.5}
            fill="none"
            stroke={C.brass}
            strokeWidth={1.8}
            opacity={0.9}
          />
        )}
      </Svg>

      {/* The raised disc (bobs, presses into the socket) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.disc,
          {
            top: -7 + sink,
            transform: [{ translateY: pressY }, { translateY: bobY }, { scale: pressScale }],
          },
        ]}
      >
        <Svg width={BOX} height={BOX}>
          <Circle cx={CENTER} cy={CENTER + 2.6} r={22} fill={rim.color} fillOpacity={rim.alpha} />
          <Circle cx={CENTER} cy={CENTER} r={22} fill={faceBottom} />
          <Circle cx={CENTER} cy={CENTER - 2} r={20.5} fill={faceTop} />
          <Ellipse cx={CENTER - 6} cy={CENTER - 9} rx={9} ry={5} fill={sheen.color} fillOpacity={sheen.alpha} opacity={0.5} />
          <Circle cx={CENTER - 9.5} cy={CENTER - 11} r={1.8} fill={sheen.color} fillOpacity={sheen.alpha} opacity={0.85} />
          {state === 'locked' && <Padlock />}
          {state === 'current' && <Paw />}
          {state === 'done' && <CheckBadge />}
        </Svg>
        {state === 'done' && <Text style={styles.num}>{level}</Text>}
      </Animated.View>

      {state === 'current' && (
        <Animated.View
          pointerEvents="none"
          style={[styles.shineOrbit, { transform: [{ rotate: spin }] }]}
        >
          <View style={styles.shineDot} />
        </Animated.View>
      )}

      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={state === 'locked'}
        style={StyleSheet.absoluteFill}
      />

      {bestSecs != null && <Text style={styles.bestLabel}>{bestSecs}s</Text>}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: WRAP, height: WRAP },
  halo: {
    position: 'absolute',
    left: -10,
    top: -10,
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: C.gold,
  },
  socket: { position: 'absolute', left: -7, top: -7 },
  disc: { position: 'absolute', left: -7, width: BOX, height: BOX },
  num: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: BOX,
    height: BOX - 4,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    color: C.bgDeep,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    fontFamily: TYPE.serif,
  },
  shineOrbit: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  shineDot: {
    position: 'absolute',
    top: -1,
    alignSelf: 'center',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: C.nodeSheen,
  },
  bestLabel: {
    position: 'absolute',
    top: 46,
    left: -27,
    width: 100,
    textAlign: 'center',
    color: C.labelTan,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    fontFamily: TYPE.serif,
  },
});

