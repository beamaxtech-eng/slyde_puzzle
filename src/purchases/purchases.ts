// SLYDE — RevenueCat service (slyde-ads-monetization.md §8): the one-time
// "Remove Ads" purchase. Anonymous users are fine (local-only game): RC mints
// an anonymous app-user ID, and "Restore Purchases" recovers the entitlement
// on a new device through the store account. The entitlement is cached into
// the SQLite settings table so the app starts correctly offline; RevenueCat
// overwrites it on every launch.

import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type CustomerInfo } from 'react-native-purchases';
import { useAppStore } from '../store/app';

// TODO(release): paste the real RevenueCat public SDK keys
// (dashboard → Project settings → Apps → API keys).
const RC_KEY = Platform.select({
  android: 'goog_REPLACE_WITH_ANDROID_SDK_KEY',
  ios: 'appl_REPLACE_WITH_IOS_SDK_KEY',
})!;

/** Entitlement that carries the "Remove Ads" purchase (dashboard name). */
const ENTITLEMENT = 'ad_free';

function applyCustomerInfo(info: CustomerInfo) {
  const active = !!info.entitlements.active[ENTITLEMENT];
  void useAppStore.getState().setAdsRemoved(active);
}

let initialized = false;

/**
 * Configure RevenueCat and resolve the entitlement. App calls this BEFORE
 * initAds() so a paying user never even loads an ad. Offline / store
 * unavailable: the cached entitlement from SQLite stays in force.
 */
export async function initPurchases() {
  if (initialized) return;
  initialized = true;
  try {
    await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: RC_KEY });
    Purchases.addCustomerInfoUpdateListener(applyCustomerInfo);
    applyCustomerInfo(await Purchases.getCustomerInfo());
  } catch {
    // Offline: keep the cached value from SQLite.
  }
}

export async function buyRemoveAds(): Promise<'ok' | 'cancelled' | 'error'> {
  try {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages[0];
    if (!pkg) return 'error';
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    applyCustomerInfo(customerInfo);
    return 'ok';
  } catch (e: any) {
    return e?.userCancelled ? 'cancelled' : 'error';
  }
}

export async function restorePurchases(): Promise<boolean> {
  try {
    const info = await Purchases.restorePurchases();
    applyCustomerInfo(info);
    return !!info.entitlements.active[ENTITLEMENT];
  } catch {
    return false;
  }
}
