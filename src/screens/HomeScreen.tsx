// SLYDE — Home screen (UI-SPEC §3). Hub: icon bar, logo block, track cards,
// bottom stats bar. Track selection merged into Home (D12).

import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../nav";
import { C, SPACE, TYPE } from "../theme";
import { TRACKS, LEVELS_PER_TRACK, type TrackId } from "../config";
import { useAppStore } from "../store/app";
import { playSfx, haptic } from "../audio";
import { IconButton, WoodBackdrop, WoodGlassSurface } from "../components/ui";

type Nav = NativeStackNavigationProp<RootStackParamList, "Home">;

const TRACK_COLORS: Record<TrackId, string> = {
  easy: "#3e9e52",
  medium: "#ffd76e",
  hard: "#ff9a80",
};

const TRACK_MODE_PILL: Record<TrackId, string> = {
  easy: "Numbers",
  medium: "Image + Numbers",
  hard: "Image only",
};

const TRACK_GRID: Record<TrackId, string> = {
  easy: "3×3 & 3×4 grid",
  medium: "4×4 & 4×5 grid",
  hard: "5×5 & 5×6 grid",
};

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const progress = useAppStore((s) => s.progress);
  const bests = useAppStore((s) => s.bests);

  const bestEntries = Object.values(bests).filter((b) => b.bestTimeMs != null);
  const solvedCount = bestEntries.length;
  const globalBestMs = bestEntries.reduce(
    (min, b) => Math.min(min, b.bestTimeMs ?? Infinity),
    Infinity,
  );

  const formatGlobalBest = () => {
    if (globalBestMs === Infinity) return "—";
    const totalSec = globalBestMs / 1000;
    const m = Math.floor(totalSec / 60);
    const s = Math.round(totalSec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <View style={styles.root}>
      <WoodBackdrop />
      <View style={styles.iconBar}>
        <IconButton
          icon="trophy"
          onPress={() => navigation.navigate("Leaderboard", { trackId: "easy" })}
        />
        <IconButton icon="settings" onPress={() => navigation.navigate("Settings")} />
      </View>

      <View style={styles.logoBlock}>
        <Text style={styles.logo}>slyde</Text>
        <Text style={styles.caption}>WELCOME BACK</Text>
        <Text style={styles.invite}>"Ready to slide?"</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.cards}
        showsVerticalScrollIndicator={false}>
        {TRACKS.map((track) => {
          const p = progress[track.id];
          const unlocked = p?.unlocked ?? 1;
          return (
            <Pressable
              key={track.id}
              onPress={() => {
                // Session start (Flow 1): tapping a track IS consent to play.
                // Map opens in FLOW mode → ★ pops in → glides → auto-starts.
                playSfx("click");
                haptic("light");
                navigation.navigate("Map", {
                  trackId: track.id,
                  fromLevel: Math.max(1, unlocked - 1),
                  animateTo: unlocked,
                  autoStart: true,
                });
              }}
              style={({ pressed }) => [styles.cardPress, pressed && styles.cardPressed]}>
              <WoodGlassSurface
                radius={18}
                accent={TRACK_COLORS[track.id]}
                bodyStyle={styles.cardBody}>
                <View style={styles.cardTop}>
                  <Text
                    style={[styles.cardName, { color: TRACK_COLORS[track.id] }]}>
                    {" "}
                    {track.name}{" "}
                  </Text>
                  <View style={styles.levelPill}>
                    <Text style={styles.levelPillText}>level {unlocked}/{LEVELS_PER_TRACK}</Text>
                  </View>
                </View>
                <Text style={styles.cardSub}>{TRACK_GRID[track.id]}</Text>
                <View style={styles.modePill}>
                  <Text style={styles.modePillText}>
                    {TRACK_MODE_PILL[track.id]}
                  </Text>
                </View>
              </WoodGlassSurface>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.statsBar}>
        <IconButton
          icon="trophy"

          wide
          onPress={() => navigation.navigate("Leaderboard", { trackId: "easy" })}
        />
        <WoodGlassSurface radius={14} bodyStyle={styles.statBody} style={styles.statPanel}>
          <Text style={styles.statLabel}>BEST TIME</Text>
          <Text style={styles.statValue}>{formatGlobalBest()}</Text>
        </WoodGlassSurface>
        <WoodGlassSurface radius={14} bodyStyle={styles.statBody} style={styles.statPanel}>
          <Text style={styles.statLabel}>SOLVED</Text>
          <Text style={styles.statValue}>{solvedCount}</Text>
        </WoodGlassSurface>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bgWood,
  },
  iconBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.lg,
    paddingTop: 60,
    paddingBottom: 4,
  },
  logoBlock: { alignItems: "center", marginTop: -30, marginBottom: 20 },
  logo: {
    color: C.textGold,
    fontSize: 48,
    fontWeight: "700",
    fontFamily: TYPE.serif,
  },
  caption: {
    color: C.labelTan,
    fontSize: 12,
    letterSpacing: 3,
    marginTop: 0,
    fontFamily: TYPE.serif,
  },
  invite: {
    color: C.gold,
    fontSize: 16,
    fontStyle: "italic",
    marginTop: 4,
    fontFamily: TYPE.serif,
  },
  cards: { paddingHorizontal: SPACE.lg, paddingBottom: 14 },
  // Wood-under-glass card. The press state lives on the outer Pressable so the
  // whole slab (and its cast shadow) dips together.
  cardPress: { marginBottom: SPACE.md },
  cardPressed: {
    transform: [{ translateY: 3 }, { scale: 0.99 }],
    opacity: 0.97,
  },
  cardBody: {
    paddingVertical: 18,
    paddingHorizontal: SPACE.lg,
    // Clears the status accent bar bled down the left edge.
    paddingLeft: SPACE.lg + 6,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardName: { fontSize: 24, fontWeight: "700", fontFamily: TYPE.serif },
  levelPill: {
    backgroundColor: C.glassThickness,
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.glassRimLightSoft,
  },
  levelPillText: {
    color: C.textPrimary,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: TYPE.serif,
  },
  cardSub: {
    color: C.labelTan,
    fontSize: 13,
    marginTop: 8,
    fontFamily: TYPE.serif,
  },
  modePill: {
    alignSelf: "flex-start",
    marginTop: 10,
    backgroundColor: C.brass,
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  modePillText: {
    color: C.brassText,
    fontSize: 12,
    fontWeight: "700",
    fontFamily: TYPE.serif,
  },
  statsBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.lg,
    paddingTop: 2,
    paddingBottom: 10,
    gap: 8,
  },
  statPanel: { flex: 1 },
  statBody: { height: 62, alignItems: "center", justifyContent: "center" },
  statLabel: {
    color: C.labelTan,
    fontSize: 9,
    letterSpacing: 1,
    fontFamily: TYPE.serif,
  },
  statValue: {
    color: C.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: TYPE.serif,
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
});