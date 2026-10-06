// SLYDE — Splash screen (UI-SPEC §2).
// Mini 2×2 wooden puzzle mark, 60pt brass-gradient logo, pulsing
// "tap to continue". The WHOLE screen is one pressable — the tap is
// load-bearing: it unlocks the audio context (OS requires a user gesture
// before sound). Tap → navigate to Home (screen fade + whoosh).
//
// Auto-advance: the brand moment lasts MOTION.splashAutoMs (3s) and then Home
// takes over on its own, so a passive player is never parked on a logo. The
// hand-off is scheduled through the flow engine (flow.ts), so per the
// cancellation law a tap kills the pending timer and goes Home immediately —
// the two can never both fire.

import React, { useCallback, useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../nav";
import { C, MOTION, TYPE } from "../theme";
import { feedback } from "../audio";
import { WoodBackdrop } from "../components/ui";
import { after, clearFlow } from "../flow";
import auth from "@react-native-firebase/auth";
import firestoreModule from "@react-native-firebase/firestore";

type Nav = NativeStackNavigationProp<RootStackParamList, "Splash">;

export default function SplashScreen() {
  const navigation = useNavigation<Nav>();
  const pulse = useRef(new Animated.Value(1)).current;

  // Single exit: clears pending automation, then hands over to Home.
  const goHome = useCallback(() => {
    clearFlow(); // manual input (or the timer itself) kills all automation
    feedback("whoosh", "light");
    navigation.replace("Home");
  }, [navigation]);

  // Auto-advance: 3s of brand, then Home on its own. Scheduled through the
  // flow engine so the tap below cancels it (cancellation law) — and so the
  // cleanup un-schedules it if this screen unmounts first.
  useEffect(() => after(MOTION.splashAutoMs, goHome), [goHome]);

  useEffect(() => {
    const registerAnonymous = async () => {
      try {
        const currentUser = auth().currentUser;

        if (!currentUser) {
          const result = await auth().signInAnonymously();
          console.log("Anonymous user:", result.user.uid);
        }

        const user = auth().currentUser;
        if (user) {
          await firestore().collection("users").doc(user.uid).set({
            createdAt: firestoreModule.FieldValue.serverTimestamp(),
          });
        }
      } catch (error) {
        console.log("Anonymous login failed:", error);
      }
    };

    void registerAnonymous();
  }, []);

  // Cancellation-law safety net: leaving the splash kills pending automation.
  useEffect(() => () => clearFlow(), []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.2,
          duration: MOTION.tapPulseMs / 2,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: MOTION.tapPulseMs / 2,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Pressable style={styles.root} onPress={goHome}>
      <WoodBackdrop />
      <View style={styles.brand}>
        <View style={styles.markWrap}>
          <View style={styles.mark}>
            <View style={styles.markRow}>
              <View style={styles.tileSm}>
                <Text style={styles.tileSmText}>1</Text>
              </View>
              <View style={styles.tileSm}>
                <Text style={styles.tileSmText}>2</Text>
              </View>
            </View>
            <View style={styles.markRow}>
              <View style={styles.tileSm}>
                <Text style={styles.tileSmText}>3</Text>
              </View>
              <View style={styles.tileBlank} />
            </View>
          </View>
        </View>

        <Text style={styles.logo}>slyde</Text>
        <Text style={styles.caption}>SLIDE · SOLVE · REPEAT</Text>
        <Animated.Text style={[styles.tap, { opacity: pulse }]}>
          tap to continue
        </Animated.Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bgWood,
    justifyContent: "center",
  },
  brand: {
    alignItems: "center",
    paddingHorizontal: 28,
  },
  markWrap: {
    width: 154,
    height: 154,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  mark: {
    width: 128,
    height: 128,
    backgroundColor: C.boardBorder,
    borderRadius: 14,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 12,
    elevation: 8,
  },
  markRow: { flexDirection: "row" },
  tileSm: {
    width: 54,
    height: 54,
    margin: 2,
    borderRadius: 8,
    backgroundColor: C.tileFace,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopColor: C.tileBevelLight,
    borderLeftColor: C.tileBevelLight,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderRightColor: C.tileBevelDark,
    borderBottomColor: C.tileBevelDark,
    alignItems: "center",
    justifyContent: "center",
  },
  tileSmText: {
    color: C.tileText,
    fontSize: 24,
    fontWeight: "700",
    fontFamily: TYPE.serif,
  },
  tileBlank: {
    width: 54,
    height: 54,
    margin: 2,
    borderRadius: 8,
    backgroundColor: C.boardInset,
  },
  logo: {
    color: C.textGold,
    fontSize: 62,
    fontWeight: "700",
    fontFamily: TYPE.serif,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  caption: {
    color: C.labelTan,
    fontSize: 13,
    letterSpacing: 3,
    marginTop: 10,
    fontFamily: TYPE.serif,
  },
  tap: {
    color: C.textPrimary,
    fontSize: 15,
    marginTop: 30,
    fontFamily: TYPE.serif,
  },
});
function firestore() {
  return firestoreModule();
}
