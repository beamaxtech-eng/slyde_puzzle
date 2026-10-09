// SLYDE — ad monetization configuration (slyde-ads-monetization.md §5).
// The single place that decides between Google's test IDs (development) and
// the real AdMob unit IDs (release). Never click live ads in development —
// Google flags accounts for invalid traffic; the test IDs always serve test
// ads instead.

import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

// TODO(release): replace with the real AdMob ad-unit IDs per platform
// (AdMob console → Apps → Slyde → Ad units). Format: ca-app-pub-XXXX…/ZZZZ…
const PROD = {
  banner: Platform.select({
    android: 'ca-app-pub-REPLACE_ANDROID_PUB_ID/REPLACE_BANNER_UNIT',
    ios: 'ca-app-pub-REPLACE_IOS_PUB_ID/REPLACE_BANNER_UNIT',
  })!,
  interstitial: Platform.select({
    android: 'ca-app-pub-REPLACE_ANDROID_PUB_ID/REPLACE_INTERSTITIAL_UNIT',
    ios: 'ca-app-pub-REPLACE_IOS_PUB_ID/REPLACE_INTERSTITIAL_UNIT',
  })!,
  rewarded: Platform.select({
    android: 'ca-app-pub-REPLACE_ANDROID_PUB_ID/REPLACE_REWARDED_UNIT',
    ios: 'ca-app-pub-REPLACE_IOS_PUB_ID/REPLACE_REWARDED_UNIT',
  })!,
};

/** Test IDs in dev, real units in release builds. */
export const AD_UNITS = __DEV__
  ? {
      banner: TestIds.ADAPTIVE_BANNER,
      interstitial: TestIds.INTERSTITIAL,
      rewarded: TestIds.REWARDED,
    }
  : PROD;

/** Placement rules (monetization spec §1.1). */
export const AD_RULES = {
  /** Interstitial fires on every Nth win — never mid-puzzle, never on fail/restart. */
  interstitialEveryNWins: 3,
  /** Minimum gap between two interstitials. */
  interstitialCooldownMs: 90_000,
  /** Rewarded "+30s" bonus on the fail overlay. */
  rewardedBonusSeconds: 30,
} as const;
