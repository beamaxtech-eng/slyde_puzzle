// SLYDE — Settings screen (UI-SPEC §8).
// Green-on toggles (music / sound / haptics), default-track button group,
// quarantined destructive reset rows (native alert confirmations), version
// footer. Sound off also stops music (single silent-world mental model).

import React, { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ImageBackground,
} from "react-native";
import { C, SPACE, TYPE } from "../theme";
import { useAppStore } from "../store/app";
import { buyRemoveAds, restorePurchases } from "../purchases/purchases";
import {
  BrassSwitch,
  ConfirmDialog,
  IconButton,
  Panel,
  WoodButton,
  WoodGlassSurface,
} from "../components/ui";
import { TRACKS, type TrackId } from "../config";
const BG_IMAGE: number = require("../../assets/bg3.png");
import type { RootStackParamList } from "../nav";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
type Props = NativeStackScreenProps<RootStackParamList, "Settings">;
/** Which destructive reset is awaiting confirmation (null = none). */
type PendingReset = { kind: "track"; track: TrackId } | { kind: "all" } | null;

export default function SettingsScreen({ navigation }: Props) {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const resetTrack = useAppStore((s) => s.resetTrack);
  const resetAllProgress = useAppStore((s) => s.resetAllProgress);
  const [defaultTrack, setDefaultTrack] = useState<TrackId>("easy");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingReset>(null);

  // ---- Ads & purchases (monetization spec §13) ----
  const adsRemoved = useAppStore((s) => s.settings.adsRemoved);
  const adFreeEnabled = useAppStore((s) => s.settings.adFreeEnabled);
  const setAdFreeEnabled = useAppStore((s) => s.setAdFreeEnabled);

  const onBuy = async () => {
    setBusy(true);
    const r = await buyRemoveAds();
    setBusy(false);
    if (r === "error") Alert.alert("Purchase failed", "Please try again later.");
    // 'cancelled' = the user closed the store sheet: no feedback needed.
    // 'ok' flips this whole section to the ad-free switch instantly.
  };

  const onRestore = async () => {
    setBusy(true);
    const ok = await restorePurchases();
    setBusy(false);
    Alert.alert(
      ok ? "Restored" : "Nothing to restore",
      ok
        ? "Ad-free is active again."
        : "No previous purchase was found for this store account."
    );
  };

  const onToggle = (key: "music" | "sound" | "haptics", value: boolean) => {
    if (key === "sound" && !value) {
      void setSettings({ sound: false, music: false });
    } else {
      void setSettings({ [key]: value });
    }
  };

  const confirmPending = () => {
    if (!pending) return;
    const p = pending;
    setPending(null);
    setBusy(true);
    const work = p.kind === "track" ? resetTrack(p.track) : resetAllProgress();
    void work.finally(() => setBusy(false));
  };

  return (
    <ImageBackground
      source={BG_IMAGE}
      style={styles.root}
      resizeMode="cover">
        <IconButton
          icon="chevron-back"
          onPress={() => navigation.goBack()}
          size={26}
          hitSlop={12}
          style={styles.back}
        />
      <Text style={styles.heading}>Settings</Text>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <Panel>
          <BrassSwitch
            label='Background music'
            value={settings.music}
            onValueChange={(v) => onToggle("music", v)}
          />
          <BrassSwitch
            label='Sound effects'
            value={settings.sound}
            onValueChange={(v) => onToggle("sound", v)}
          />
          <BrassSwitch
            label='Haptics'
            value={settings.haptics}
            onValueChange={(v) => onToggle("haptics", v)}
          />
        </Panel>

        <Text style={styles.section}>Ads</Text>
        <Panel>
          {adsRemoved ? (
            // PAID USERS: the ad-free switch. Toggling never loses the
            // purchase — it only re-enables/disables banners + interstitials;
            // the rewarded "+30s" stays available either way.
            <>
              <BrassSwitch
                label="Ad-free mode"
                value={adFreeEnabled}
                onValueChange={setAdFreeEnabled}
              />
              <Text style={styles.adsHint}>
                {adFreeEnabled
                  ? "Banners and win-screen video ads are off."
                  : "Ads are back on. Switch on to hide them again — your purchase is never lost."}
              </Text>
            </>
          ) : (
            // FREE USERS: the purchase button.
            <>
              <WoodButton
                label="Remove Ads"
                onPress={() => void onBuy()}
                disabled={busy}
                style={styles.adsFirstButton}
              />
              <Text style={styles.adsHint}>
                One-time purchase. Hides the map banner and win-screen video
                ads.
              </Text>
            </>
          )}
          {/* Apple requires a restore control (monetization spec §15.7). */}
          <WoodButton
            label="Restore Purchases"
            variant="ghost"
            onPress={() => void onRestore()}
            disabled={busy}
            style={styles.adsButton}
          />
        </Panel>

        <Text style={styles.section}>Default track</Text>
        <View style={styles.buttonGroup}>
          {TRACKS.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setDefaultTrack(t.id)}
              style={({ pressed }) => [styles.groupPress, pressed && styles.groupBtnPressed]}>
              <WoodGlassSurface
                radius={10}
                tone={defaultTrack === t.id ? "brass" : "wood"}
                bodyStyle={styles.groupBody}>
                <Text
                  style={[
                    styles.groupLabel,
                    defaultTrack === t.id && styles.groupLabelActive,
                  ]}>
                  {t.name}
                </Text>
              </WoodGlassSurface>
            </Pressable>
          ))}
        </View>

        <View style={styles.destructiveZone}>
          <Text style={styles.sectionDanger}>Reset a track</Text>
          {TRACKS.map((t) => (
            <WoodButton
              key={t.id}
              label={`Reset ${t.name}`}
              variant='danger'
              disabled={busy}
              onPress={() => setPending({ kind: "track", track: t.id })}
              style={styles.resetButton}
            />
          ))}
          <Text style={styles.sectionDanger}>Reset everything</Text>
          <WoodButton
            label='Reset everything'
            variant='danger'
            disabled={busy}
            onPress={() => setPending({ kind: "all" })}
            style={styles.resetButton}
          />
        </View>


      </ScrollView>

      <ConfirmDialog
        visible={pending != null}
        title={
          pending?.kind === "all"
            ? "Reset everything?"
            : `Reset ${pending?.kind === "track" ? pending.track : ""} progress?`
        }
        body={
          pending?.kind === "all"
            ? "Erases all progress, best scores, and resets settings. Cannot be undone."
            : "Wipes unlocked levels and best scores for this track."
        }
        confirmLabel={pending?.kind === "all" ? "Reset All" : "Reset"}
        destructive
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgWood },
  heading: {
    color: C.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    paddingTop: 56,
    paddingBottom: 12,
    fontFamily: TYPE.serif,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 52,
    paddingHorizontal: SPACE.md,
  },
  back: {
    position: "absolute",
    top: 46,
    left: SPACE.md,
    zIndex: 1,
  },

  content: { paddingHorizontal: SPACE.lg, paddingBottom: 40 },
  section: {
    color: C.labelTan,
    fontSize: 13,
    letterSpacing: 1.5,
    marginTop: SPACE.xl,
    marginBottom: SPACE.sm,
    fontFamily: TYPE.serif,
  },
  buttonGroup: { flexDirection: "row", gap: 8 },
  groupPress: { flex: 1 },
  groupBody: { paddingVertical: 8, alignItems: "center" },
  groupBtnPressed: {
    transform: [{ translateY: 2 }],
  },
  groupLabel: {
    color: C.labelTan,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: TYPE.serif,
  },
  groupLabelActive: { color: C.brassText, fontWeight: "700" },
  // ---- Ads & purchases section ----
  adsFirstButton: { marginTop: SPACE.xs },
  adsButton: { marginTop: SPACE.sm },
  adsHint: {
    color: C.labelTan,
    fontSize: 12,
    marginTop: SPACE.xs,
    marginBottom: SPACE.sm,
    fontFamily: TYPE.serif,
  },
  destructiveZone: { marginTop: SPACE.xl },
  sectionDanger: {
    color: C.red,
    fontSize: 13,
    letterSpacing: 1.5,
    marginTop: SPACE.lg,
    marginBottom: SPACE.sm,
    fontFamily: TYPE.serif,
  },
  resetButton: { marginBottom: SPACE.sm ,
    
  },
  version: {
    color: C.textDisabled,
    fontSize: 12,
    textAlign: "center",
    marginTop: 24,
    fontFamily: TYPE.serif,
  },
});
