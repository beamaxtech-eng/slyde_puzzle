// SLYDE — ads service (slyde-ads-monetization.md §9): consent + SDK init,
// interstitial preloading with the win-count/cooldown rules, rewarded
// preloading.
//
// Rewarded ads are user-initiated (the fail-overlay "+30s" button), so they
// stay available even in ad-free mode; the interstitial checks adsActive()
// first, which silences it automatically for ad-free users.

import mobileAds, {
  AdsConsent,
  AdEventType,
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType,
} from 'react-native-google-mobile-ads';
import { AD_UNITS, AD_RULES } from './adConfig';
import { useAppStore } from '../store/app';

let interstitial: InterstitialAd = InterstitialAd.createForAdRequest(AD_UNITS.interstitial);
let rewarded: RewardedAd = RewardedAd.createForAdRequest(AD_UNITS.rewarded);
let interstitialReady = false;
let rewardedReady = false;
let winsSinceAd = 0;
let lastInterstitialAt = 0;

// Rewarded readiness pub/sub — the fail overlay's "+30s" button must appear
// (or vanish) when an ad finishes (or fails) loading, not on the next render.
const rewardedListeners = new Set<(ready: boolean) => void>();

function setRewardedReady(ready: boolean) {
  rewardedReady = ready;
  for (const l of rewardedListeners) l(ready);
}

export async function initAds() {
  // 1. GDPR/UK consent — must complete before any ad request.
  try {
    await AdsConsent.gatherConsent();
  } catch {
    // No form configured / offline: proceed; the SDK falls back per its own rules.
  }

  // 2. SDK init.
  try {
    await mobileAds().initialize();
  } catch {
    // Offline: the game must never depend on ads.
  }

  // 3. Preload. Rewarded always (user-initiated, available even in ad-free
  //    mode); the interstitial only while ads are active — App resolves the
  //    purchase entitlement BEFORE calling initAds(), so a paying user never
  //    even loads one.
  loadRewarded();
  if (useAppStore.getState().adsActive()) loadInterstitial();
}

function loadInterstitial() {
  interstitialReady = false;
  interstitial = InterstitialAd.createForAdRequest(AD_UNITS.interstitial);
  interstitial.addAdEventListener(AdEventType.LOADED, () => (interstitialReady = true));
  interstitial.addAdEventListener(AdEventType.ERROR, () => (interstitialReady = false));
  interstitial.load();
}

function loadRewarded() {
  setRewardedReady(false);
  rewarded = RewardedAd.createForAdRequest(AD_UNITS.rewarded);
  rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => setRewardedReady(true));
  rewarded.addAdEventListener(AdEventType.ERROR, () => setRewardedReady(false));
  rewarded.load();
}

/**
 * Call after every win. Resolves when the ad (if any) is closed — or
 * immediately when ad-free, not yet due, or nothing is loaded. PuzzleScreen
 * awaits this BEFORE arming the auto-advance timer, so the ★ flow never
 * ticks behind an open ad. Never call on a restart or a fail.
 */
export function maybeShowInterstitial(): Promise<void> {
  return new Promise((resolve) => {
    if (!useAppStore.getState().adsActive()) return resolve();

    winsSinceAd += 1;
    const cooledDown = Date.now() - lastInterstitialAt > AD_RULES.interstitialCooldownMs;
    const due = winsSinceAd >= AD_RULES.interstitialEveryNWins;

    if (!(due && cooledDown)) return resolve();
    if (!interstitialReady) {
      // Not preloaded (e.g. ads were toggled back on after init): kick a
      // background load so the next due win can show one.
      loadInterstitial();
      return resolve();
    }

    const unsub = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      unsub();
      winsSinceAd = 0;
      lastInterstitialAt = Date.now();
      loadInterstitial();
      resolve();
    });
    interstitial.show().catch(() => resolve());
  });
}

/** Current rewarded readiness (for one-shot render checks). */
export function isRewardedReady() {
  return rewardedReady;
}

/** Subscribe to rewarded readiness changes. Returns an unsubscribe function. */
export function onRewardedReadyChange(listener: (ready: boolean) => void) {
  rewardedListeners.add(listener);
  listener(rewardedReady);
  return () => {
    rewardedListeners.delete(listener);
  };
}

/**
 * Show the rewarded ad (fail overlay "+30s"). Resolves true only if the user
 * actually earned the reward — closing early gives no bonus time. Does NOT
 * check adsActive(): it is always user-initiated, so it stays available in
 * ad-free mode.
 */
export function showRewarded(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!rewardedReady) return resolve(false);
    let earned = false;

    const u1 = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      earned = true;
    });
    const u2 = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      u1();
      u2();
      loadRewarded();
      resolve(earned);
    });
    rewarded.show().catch(() => resolve(false));
  });
}
