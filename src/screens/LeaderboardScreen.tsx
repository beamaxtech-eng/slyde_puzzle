// SLYDE — Leaderboard screen (UI-SPEC §7).
// Personal bests with per-track tabs (active = brass), summary line
// (solved / streak), rows in tabular figures, and the global
// "coming soon" promise as a dashed placeholder.

import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { C, SPACE, TYPE } from "../theme";
import { useAppStore } from "../store/app";
import { LEVELS_PER_TRACK, TRACKS, type TrackId } from "../config";
import type { RootStackParamList } from "../nav";
import {
  Icon,
  IconButton,
  WoodBackdrop,
  WoodButton,
  WoodGlassSurface,
} from "../components/ui";

type Props = NativeStackScreenProps<RootStackParamList, "Leaderboard">;

function formatMs(ms: number | null): string {
  if (ms == null) return "—";
  const totalSec = ms / 1000;
  const m = Math.floor(totalSec / 60);
  const s = (totalSec % 60).toFixed(0).padStart(2, "0");
  return `${m}:${s}`;
}

export default function LeaderboardScreen({ navigation, route }: Props) {
  const [active, setActive] = useState<TrackId>(route.params.trackId);
  const bests = useAppStore((s) => s.bests);
  const progress = useAppStore((s) => s.progress);

  const trackBests = useMemo(() => {
    const list: { level: number; time: string; moves: string }[] = [];
    for (let lvl = 1; lvl <= LEVELS_PER_TRACK; lvl++) {
      const b = bests[`${active}-${lvl}`];
      if (b?.bestTimeMs != null) {
        list.push({
          level: lvl,
          time: formatMs(b.bestTimeMs),
          moves: b.bestMoves != null ? String(b.bestMoves) : "—",
        });
      }
    }
    return list.sort((a, b) => a.level - b.level);
  }, [bests, active]);

  const solved = trackBests.length;
  const streak = progress[active]?.streak ?? 0;

  return (
    <View style={styles.root}>
      <WoodBackdrop />
      <View style={styles.header}>
        <IconButton
          icon="arrow-back"
          onPress={() => navigation.goBack()}
          size={28}
          hitSlop={12}
        />
        <Text style={styles.heading}>Your Best Scores</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.tabs}>
        {TRACKS.map((t) => (
          <WoodButton
            key={t.id}
            label={t.name}
            variant={active === t.id ? "primary" : "secondary"}
            onPress={() => setActive(t.id)}
            style={styles.tabBtn}
          />
        ))}
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryItem}>
          <Icon name="checkmark-circle" size={16} color={C.gold} style={{ marginRight: 4 }} /> {solved}/{LEVELS_PER_TRACK}
        </Text>
        <Text style={styles.summaryItem}>
          <Icon name="flame" size={16} color={C.gold} style={{ marginRight: 4 }} /> {streak}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}>
        {trackBests.map((row) => (
          <WoodGlassSurface
            key={row.level}
            radius={14}
            lite
            bodyStyle={styles.rowBody}
            style={styles.row}>
            <Text style={styles.rowLevel}>L{row.level}</Text>
            <Text style={styles.rowTime}>{row.time} time</Text>
            <Text style={styles.rowMoves}>{row.moves} moves</Text>
          </WoodGlassSurface>
        ))}
        {solved === 0 && (
          <Text style={styles.empty}>
            No completed levels yet. Go solve something!
          </Text>
        )}
      </ScrollView>

      <View style={styles.comingSoon}>
        <Text style={styles.comingSoonText}>
          <Icon name="globe" size={16} color={C.labelTan} style={{ marginRight: 6 }} /> Global leaderboard — coming soon
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgWood },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 52,
    paddingHorizontal: SPACE.md,
    paddingBottom: 6,
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
    fontSize: 19,
    fontWeight: "700",
    fontFamily: TYPE.serif,
  },
  spacer: { width: 50 },
  tabs: {
    flexDirection: "row",
    marginHorizontal: SPACE.lg,
    justifyContent: "space-between",
    marginTop: 8,
    gap: 3,
    
  },
  tabBtn: { 
    
   
  },
  summary: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    paddingVertical: 12,
  },
  summaryItem: {
    color: C.gold,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: TYPE.serif,
  },
  list: { paddingHorizontal: SPACE.lg, paddingBottom: 12 },
  // Wood-under-glass row. `lite` paint keeps a 100-row list cheap.
  row: { marginBottom: 10 },
  rowBody: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  rowLevel: {
    color: C.gold,
    fontSize: 15,
    fontWeight: "700",
    width: 44,
    fontFamily: TYPE.serif,
  },
  rowTime: {
    color: C.textPrimary,
    fontSize: 15,
    flex: 1,
    fontVariant: ["tabular-nums"],
    fontFamily: TYPE.serif,
  },
  rowMoves: {
    color: C.labelTan,
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    fontFamily: TYPE.serif,
  },
  empty: {
    color: C.labelTan,
    fontSize: 15,
    textAlign: "center",
    marginTop: 40,
    fontFamily: TYPE.serif,
  },
  comingSoon: {
    marginHorizontal: SPACE.lg,
    marginBottom: 24,
    paddingVertical: 18,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: C.labelTan,
    alignItems: "center",
    backgroundColor: C.panelBg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  comingSoonText: { color: C.labelTan, fontSize: 14, fontFamily: TYPE.serif },
});