import { getAnalytics } from '@react-native-firebase/analytics';

/**
 * Log a custom event to Firebase Analytics via the native SDK
 * (@react-native-firebase/analytics, backed by google-services.json).
 *
 * Fire-and-forget: returned promise never rejects, so analytics
 * can never crash the app. Callers may `void` the result.
 *
 * @param eventName - The name of the event to log (snake_case, per Firebase conventions)
 * @param eventParams - Optional parameters to include with the event
 */
export const logCustomEvent = (
  eventName: string,
  eventParams?: Record<string, unknown>,
): Promise<void> => {
  try {
    return getAnalytics()
      .logEvent(eventName, eventParams)
      .catch((error: unknown) => {
        console.error(`Failed to log event '${eventName}':`, error);
      });
  } catch (error) {
    // Sync validation errors (invalid/reserved event names, bad params)
    console.error(`Failed to log event '${eventName}':`, error);
    return Promise.resolve();
  }
};

/**
 * Smoke-test event — handy for verifying the integration in
 * Firebase Console > Analytics > DebugView.
 */
export const logTestEvent = (): Promise<void> => logCustomEvent('test_event');

/**
 * Common event types that can be logged
 */
export const AnalyticsEvents = {
  APP_START: 'app_start',
  SCREEN_VIEW: 'screen_view',
  LEVEL_STARTED: 'level_started',
  LEVEL_COMPLETED: 'level_completed',
  LEVEL_FAILED: 'level_failed',
  BUTTON_CLICKED: 'button_clicked',
  MENU_OPENED: 'menu_opened',
  SETTINGS_CHANGED: 'settings_changed',
  LEADERBOARD_OPENED: 'leaderboard_opened',
  SOUND_TOGGLED: 'sound_toggled',
  MUSIC_TOGGLED: 'music_toggled',
};