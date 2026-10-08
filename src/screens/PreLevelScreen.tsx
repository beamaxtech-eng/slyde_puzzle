// SLYDE — Pre-Level Card (UI-SPEC §5).
// The breath before the level: big 50pt level number, four pre-game answers
// (target moves, time limit, best, streak), solver-verified badge, dataset
// footnote. Manual entry only — the auto-play flow skips this screen.

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { C, SPACE, TYPE } from "../theme";
import { getLevel, datasetVersion, hasVerifiedDataset } from "../data/levels";
import type { TrackId } from "../config";
import { useAppStore } from "../store/app";
import {
  WoodButton,
  Plaque,
  IconButton,
  Icon,
  IconName,
  WoodBackdrop,
  WoodGlassSurface,
} from "../components/ui";
import type { RootStackParamList } from "../nav";

type Props = NativeStackScreenProps<RootStackParamList, "PreLevel">;

export default function PreLevelScreen({ route, navigation }: Props) {
  const trackId = route.params.trackId as TrackId;
  const { level } = route.params;
  const levelData = getLevel(trackId, level);
  const progress = useAppStore((s) => s.progress);
  const bests = useAppStore((s) => s.bests);
  const best = bests[`${trackId}-${level}`];
  const streak = progress[trackId].streak;
  const gridLabel = `${levelData.cols}×${levelData.rows} grid`;

  const modeLabel =
    levelData.cols * levelData.rows <= 12
      ? "Numbers"
      : levelData.cols === 4
        ? "Image + numbers"
        : "Image only";

  const contextLine =
    levelData.chapter === 2
      ? `Chapter 2 · new board! ${gridLabel}`
      : `${gridLabel} · ${modeLabel}`;

  const verified = hasVerifiedDataset();

  return (
    <View style={styles.root}>
      <WoodBackdrop />
      <View style={styles.header}>
        <IconButton
          icon='arrow-back'
          onPress={() => navigation.goBack()}
          size={28}
        />
      </View>

      <View style={styles.center}>
        <Text style={styles.levelNumber}>Level {level}</Text>
        <Text style={styles.contextLine}>{contextLine}</Text>

        <WoodGlassSurface
          radius={18}
          tone='glass'
          style={styles.infoPanel}
          bodyStyle={styles.infoPanelBody}>
          <InfoRow
            label='TARGET MOVES'
            value={`~${levelData.targetSolveDistance}`}
          />
          <InfoRow
            label='TIME LIMIT'
            value={formatTime(levelData.timeLimitSeconds)}
          />
          <InfoRow
            label='YOUR BEST'
            value={
              best?.bestTimeMs != null
                ? `${(best.bestTimeMs / 1000).toFixed(1)} · ${best.bestMoves} moves`
                : "—"
            }
          />
          <InfoRow label='STREAK' value={`${streak} `} icon='flame' />
        </WoodGlassSurface>

        <Plaque style={styles.verify}>
          <View style={styles.verifyRow}>
            {verified && (
              <Icon name='checkmark-circle' size={14} color={C.greenSoft} />
            )}
            <Text style={styles.verifyText}>
              {verified ? "solver-verified (exact)" : "approximate (stub)"}
            </Text>
          </View>
        </Plaque>

        <WoodButton
          label='Play'
          onPress={() => navigation.replace("Puzzle", { trackId, level })}
          style={styles.play}
        />
      </View>
    </View>
  );
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: IconName;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValueContainer}>
        {icon && (
          <Icon name={icon} size={16} color={C.gold} style={styles.infoIcon} />
        )}
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgWood },
  header: { paddingTop: 56, paddingHorizontal: SPACE.md },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE.xl,
    paddingBottom: 32,
  },
  levelNumber: {
    color: C.textGold,
    fontSize: 50,
    fontWeight: "700",
    fontFamily: TYPE.serif,
    lineHeight: 54,
  },
  contextLine: {
    color: C.labelTan,
    fontSize: 14,
    marginTop: 8,
    fontFamily: TYPE.serif,
    textAlign: "center",
  },
  infoPanel: { alignSelf: "stretch", marginTop: 28 },
  infoPanelBody: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  infoLabel: {
    color: C.labelTan,
    fontSize: 11,
    letterSpacing: 1.5,
    fontFamily: TYPE.serif,
  },
  infoValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  infoIcon: {
    marginRight: 2,
  },
  infoValue: {
    color: C.textPrimary,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: TYPE.serif,
    textAlign: "right",
  },
  verify: { marginTop: 16, alignSelf: "center" },
  verifyRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  verifyText: { color: C.greenSoft, fontSize: 13, fontFamily: TYPE.serif },
  play: { alignSelf: "stretch", marginTop: 24 },
  footnote: {
    color: C.textDisabled,
    fontSize: 11,
    marginTop: 12,
    fontFamily: TYPE.serif,
  },
});
