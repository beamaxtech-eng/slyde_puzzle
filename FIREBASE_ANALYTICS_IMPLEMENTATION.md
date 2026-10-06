# Firebase Analytics Implementation Guide

## Overview
This project uses Firebase Analytics on Android via the **native** React Native Firebase SDK
(`@react-native-firebase/analytics`). The previous web-only Firebase JS SDK setup
(`firebase` / `firebase/analytics` in `src/firebase/config.ts`) was removed — the JS SDK's
Analytics module does not work in React Native native builds.

## Implementation (minimum steps, all verified)

### 1. Packages installed
```bash
npm install @react-native-firebase/app @react-native-firebase/analytics
```
- `@react-native-firebase/app` — required core module
- `@react-native-firebase/analytics` — native Analytics bindings

Both are **autolinked** into the Android build automatically (Expo/RN 0.86 autolinking).

### 2. Google Services Gradle plugin
- `android/build.gradle`:
  ```gradle
  classpath('com.google.gms:google-services:4.5.0')
  ```
- `android/app/build.gradle`:
  ```gradle
  apply plugin: "com.google.gms.google-services"
  ```

### 3. google-services.json
Located at `android/app/google-services.json` (project `games-bad12`,
package `com.anonymous.slyde`). The plugin reads it at build time to configure the native
Firebase SDK — **no JS-side config is needed or used**.

### 4. Analytics utility module
`src/analytics/index.ts` provides:
- `logCustomEvent(eventName, params?)` — fire-and-forget; the returned promise never rejects
- `logTestEvent()` — logs a `test_event` smoke-test event
- `AnalyticsEvents` constants for consistent event naming

### 5. Event logging
`App.tsx` logs an `app_start` event on mount. Firebase Analytics also collects sessions,
first opens, app updates, etc. automatically — no extra code needed.

## Usage Examples

```typescript
import { logCustomEvent, AnalyticsEvents, logTestEvent } from './src/analytics';

// Smoke test (visible in Firebase DebugView)
void logTestEvent();

// Log a basic event
void logCustomEvent(AnalyticsEvents.BUTTON_CLICKED, { button_name: 'Start Game' });

// Log with additional parameters
void logCustomEvent(AnalyticsEvents.LEVEL_COMPLETED, {
  level_id: 'level_1',
  score: 1000,
  time_taken: 60,
});

// Screen view tracking
void logCustomEvent(AnalyticsEvents.SCREEN_VIEW, { screen_name: 'HomeScreen' });
```

## Events Tracked

| Event Name | Description |
|------------|-------------|
| `app_start` | When the app launches (logged in `App.tsx`) |
| `test_event` | Smoke-test event for verifying the integration |
| `screen_view` | When users navigate to different screens |
| `level_started` | When a puzzle level begins |
| `level_completed` | When a puzzle level is completed |
| `level_failed` | When a puzzle level fails |
| `button_clicked` | When users interact with buttons |
| `menu_opened` | When menu screens are opened |
| `settings_changed` | When settings are modified |
| `leaderboard_opened` | When leaderboard is accessed |
| `sound_toggled` | When sound settings change |
| `music_toggled` | When music settings change |

## Verifying on Android

1. Build and run: `npm run android` (i.e. `expo run:android`) — a native build is required
   (the native module does not run in Expo Go).
2. Enable Analytics debug mode on the device:
   ```bash
   adb shell setprop debug.firebase.analytics.app com.anonymous.slyde
   ```
3. Relaunch the app, then open **Firebase Console → Analytics → DebugView** — the
   `app_start` / `test_event` events should appear within ~30 seconds.
4. Without debug mode, events can take up to 24 hours to show in regular reports.

## Notes

- The `firebase` npm package (JS web SDK) remains in `package.json` but is **unused** by the
  app; it can be removed (`npm uninstall firebase`) if web support is not needed.
- Do **not** run `expo prebuild --clean` without re-applying the google-services gradle setup —
  it regenerates `android/` from `app.json` and would drop the manual gradle edits.
- All event logging is wrapped in `.catch()` so analytics can never crash the app.
- Event names follow Firebase best practices (snake_case, ≤ 40 chars).
