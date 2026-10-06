// SLYDE — App root. Navigation + DB hydration.
// Hydrates the Zustand store from SQLite once at boot (before Home is shown).
// While hydrating, render a plain loading view (no navigation) — anything that
// calls useNavigation() must live inside the NavigationContainer.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import SplashScreen from './src/screens/SplashScreen';
import HomeScreen from './src/screens/HomeScreen';
import MapScreen from './src/screens/MapScreen';
import PreLevelScreen from './src/screens/PreLevelScreen';
import PuzzleScreen from './src/screens/PuzzleScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { useAppStore } from './src/store/app';
import { AudioProvider } from './src/audio';
import type { RootStackParamList } from './src/nav';
import { C } from './src/theme';
import { logCustomEvent, AnalyticsEvents } from './src/analytics';

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: C.bgWood },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Map" component={MapScreen} />
      <Stack.Screen name="PreLevel" component={PreLevelScreen} />
      <Stack.Screen
        name="Puzzle"
        component={PuzzleScreen}
        options={{ animation: 'none' }}
      />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  const hydrated = useAppStore((s) => s.hydrated);
  const hydrate = useAppStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
    // Log app start event (fire-and-forget; never rejects).
    // Firebase Analytics also collects sessions, app opens, etc. automatically.
    void logCustomEvent(AnalyticsEvents.APP_START);
  }, [hydrate]);

  if (!hydrated) {
    // Hydration gate: no navigation here. SplashScreen (which uses
    // useNavigation) must NOT render until it is inside the container.
    return (
      <View style={styles.loading}>
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <AudioProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <RootNavigator />
      </NavigationContainer>
    </AudioProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: C.bgWood,
  },
});