# Slyde Puzzles: Ads & Ad-Free Monetization Guide

**Version:** 1.0 | **Platform:** React Native (Expo managed, dev builds) | **Scope:** AdMob ads, "Remove Ads" in-app purchase, and a Settings switch for ad-free users

---

## 1. Overview

Slyde stays **local-only** (no accounts, no backend). Monetization is added with two pieces:

| Piece | Tool | Purpose |
|---|---|---|
| Ads | Google AdMob via `react-native-google-mobile-ads` | Banner, interstitial, rewarded |
| Ad-free purchase | RevenueCat via `react-native-purchases` | One-time "Remove Ads" IAP, restore, entitlement check |

### 1.1 Ad placements

| Format | Where | Rule |
|---|---|---|
| Banner | Level map screen only | Never on the puzzle screen (mis-taps while dragging) |
| Interstitial | Win overlay | Every 3rd win, minimum 90 seconds between ads, never mid-puzzle |
| Rewarded | Fail overlay | "Watch an ad for +30s" once per attempt |

### 1.2 The ad-free switch (core requirement)

Two separate pieces of state drive everything:

- `adsRemoved` (boolean): **Purchased entitlement.** Comes from RevenueCat. The user cannot edit it.
- `adFreeEnabled` (boolean): **User switch in Settings.** Defaults to `true` after purchase. Only usable when `adsRemoved` is `true`.

```
adsActive = !(adsRemoved && adFreeEnabled)
```

| adsRemoved | adFreeEnabled | Result |
|---|---|---|
| false | n/a | Ads shown. Settings shows a **Remove Ads** purchase button |
| true | true | **No banners or interstitials.** Rewarded stays optional |
| true | false | Ads shown again (the user switched ads back on) |

> Why a switch? A paying user may want to switch ads back on to earn rewarded perks, or to support the game. The purchase is never lost: toggling off does not revoke it.

---

## 2. Prerequisites

- Expo SDK 50 or newer, managed workflow with EAS Build
- Apple Developer account and Google Play Console account
- An AdMob account (https://admob.google.com)
- A RevenueCat account (https://www.revenuecat.com)
- Existing stack from the main spec: Zustand, `expo-sqlite`, React Navigation

> **Expo Go will NOT work.** Both libraries contain native code. Use a development build (`eas build --profile development`).

---

## 3. Step 1: Set up AdMob

1. Sign in to AdMob and click **Apps > Add app**. Add Android and iOS separately.
2. Copy each **App ID** (format `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`).
3. Create these **ad units** per platform:
   - Banner: `slyde_map_banner`
   - Interstitial: `slyde_win_interstitial`
   - Rewarded: `slyde_fail_rewarded`
4. Copy each **Ad Unit ID** (format `ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ`).
5. **Never use real ad units while developing.** Use Google's test IDs (built into the library as `TestIds`). Clicking your own live ads can get your account banned.

---

## 4. Step 2: Install and configure

### 4.1 Install

```bash
npx expo install react-native-google-mobile-ads react-native-purchases expo-build-properties
```

### 4.2 `app.json`

```json
{
  "expo": {
    "name": "Slyde Puzzles",
    "plugins": [
      [
        "react-native-google-mobile-ads",
        {
          "androidAppId": "ca-app-pub-XXXXXXXXXXXXXXXX~ANDROID_APP",
          "iosAppId": "ca-app-pub-XXXXXXXXXXXXXXXX~IOS_APP",
          "userTrackingPermission": "This identifier will be used to deliver personalized ads to you."
        }
      ],
      "expo-build-properties"
    ]
  }
}
```

### 4.3 Build a dev client

```bash
eas build --profile development --platform android
eas build --profile development --platform ios
```

Install the build on a device or emulator, then run `npx expo start --dev-client`.

---

## 5. Step 3: Central ad configuration

Create `src/ads/adConfig.ts`. This is the single place that decides between test and real IDs.

```ts
import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

const PROD = {
  banner: Platform.select({
    android: 'ca-app-pub-XXXXXXXXXXXXXXXX/ANDROID_BANNER',
    ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/IOS_BANNER',
  })!,
  interstitial: Platform.select({
    android: 'ca-app-pub-XXXXXXXXXXXXXXXX/ANDROID_INTER',
    ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/IOS_INTER',
  })!,
  rewarded: Platform.select({
    android: 'ca-app-pub-XXXXXXXXXXXXXXXX/ANDROID_REWARD',
    ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/IOS_REWARD',
  })!,
};

export const AD_UNITS = __DEV__
  ? {
      banner: TestIds.ADAPTIVE_BANNER,
      interstitial: TestIds.INTERSTITIAL,
      rewarded: TestIds.REWARDED,
    }
  : PROD;

export const AD_RULES = {
  interstitialEveryNWins: 3,
  interstitialCooldownMs: 90_000,
  rewardedBonusSeconds: 30,
  rewardedPerAttempt: 1,
};
```

---

## 6. Step 4: Persist settings (SQLite key-value)

Add a tiny key-value table so the switch survives restarts. Create `src/db/kv.ts`:

```ts
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('slyde.db');

db.execSync(`CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);`);

export function kvGet(key: string, fallback: string): string {
  const row = db.getFirstSync<{ value: string }>(
    'SELECT value FROM kv WHERE key = ?', [key]
  );
  return row?.value ?? fallback;
}

export function kvSet(key: string, value: string) {
  db.runSync(
    'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}
```

> If your project already uses a settings table, reuse it and skip this step.

---

## 7. Step 5: Monetization store (Zustand)

Create `src/store/monetizationStore.ts`. It holds both flags and exposes the derived `adsActive`.

```ts
import { create } from 'zustand';
import { kvGet, kvSet } from '../db/kv';

type MonetizationState = {
  adsRemoved: boolean;      // from RevenueCat (source of truth)
  adFreeEnabled: boolean;   // user switch (only meaningful if adsRemoved)
  setAdsRemoved: (v: boolean) => void;
  setAdFreeEnabled: (v: boolean) => void;
  adsActive: () => boolean;
};

export const useMonetization = create<MonetizationState>((set, get) => ({
  adsRemoved: kvGet('adsRemoved', '0') === '1',          // cached for offline start
  adFreeEnabled: kvGet('adFreeEnabled', '1') === '1',    // default ON after purchase

  setAdsRemoved: (v) => {
    kvSet('adsRemoved', v ? '1' : '0');
    set({ adsRemoved: v });
  },

  setAdFreeEnabled: (v) => {
    // Ignore the switch if the user has not purchased
    if (!get().adsRemoved) return;
    kvSet('adFreeEnabled', v ? '1' : '0');
    set({ adFreeEnabled: v });
  },

  adsActive: () => !(get().adsRemoved && get().adFreeEnabled),
}));
```

Notes:
- `adsRemoved` is cached locally so the app starts correctly offline, but **RevenueCat overwrites it** on every launch (Step 6).
- `setAdFreeEnabled` refuses changes when nothing is purchased, so the switch cannot be abused.

---

## 8. Step 6: Purchases with RevenueCat

### 8.1 Create the product

1. **App Store Connect:** create a **Non-Consumable** IAP, product ID `slyde_remove_ads`.
2. **Play Console:** create a **One-time product** (in-app product), ID `slyde_remove_ads`.
3. **RevenueCat dashboard:**
   - Add both apps and paste each store's API credentials as RevenueCat instructs.
   - Create an **Entitlement** named `ad_free`.
   - Add the products and attach them to `ad_free`.
   - Create an **Offering** `default` with a package containing the product.
4. Copy the public SDK keys (one for Android, one for iOS).

### 8.2 Service module

Create `src/purchases/purchases.ts`:

```ts
import { Platform } from 'react-native';
import Purchases, { CustomerInfo } from 'react-native-purchases';
import { useMonetization } from '../store/monetizationStore';

const RC_KEY = Platform.select({
  android: 'goog_XXXXXXXXXXXXXXXX',
  ios: 'appl_XXXXXXXXXXXXXXXX',
})!;

const ENTITLEMENT = 'ad_free';

function applyCustomerInfo(info: CustomerInfo) {
  const active = !!info.entitlements.active[ENTITLEMENT];
  useMonetization.getState().setAdsRemoved(active);
}

export async function initPurchases() {
  Purchases.configure({ apiKey: RC_KEY });
  Purchases.addCustomerInfoUpdateListener(applyCustomerInfo);
  try {
    applyCustomerInfo(await Purchases.getCustomerInfo());
  } catch {
    // Offline: keep the cached value from SQLite
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
```

> **Anonymous users are fine.** RevenueCat creates an anonymous ID. "Restore Purchases" recovers the entitlement on a new device through the store account.

---

## 9. Step 7: Ads service (init, consent, loading)

Create `src/ads/adsService.ts`:

```ts
import mobileAds, {
  AdsConsent,
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
} from 'react-native-google-mobile-ads';
import { AD_UNITS, AD_RULES } from './adConfig';
import { useMonetization } from '../store/monetizationStore';

let interstitial = InterstitialAd.createForAdRequest(AD_UNITS.interstitial);
let rewarded = RewardedAd.createForAdRequest(AD_UNITS.rewarded);
let interstitialReady = false;
let rewardedReady = false;
let winsSinceAd = 0;
let lastInterstitialAt = 0;

export async function initAds() {
  // 1. Consent (GDPR/UK). Must complete before ad requests.
  try {
    await AdsConsent.gatherConsent();
  } catch {}

  // 2. SDK init
  await mobileAds().initialize();

  // 3. Preload
  loadInterstitial();
  loadRewarded();
}

function loadInterstitial() {
  interstitialReady = false;
  interstitial = InterstitialAd.createForAdRequest(AD_UNITS.interstitial);
  interstitial.addAdEventListener(AdEventType.LOADED, () => (interstitialReady = true));
  interstitial.addAdEventListener(AdEventType.ERROR, () => (interstitialReady = false));
  interstitial.load();
}

function loadRewarded() {
  rewardedReady = false;
  rewarded = RewardedAd.createForAdRequest(AD_UNITS.rewarded);
  rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => (rewardedReady = true));
  rewarded.addAdEventListener(AdEventType.ERROR, () => (rewardedReady = false));
  rewarded.load();
}

/** Call after every win. Resolves when the ad is closed (or immediately if none shown). */
export function maybeShowInterstitial(): Promise<void> {
  return new Promise((resolve) => {
    if (!useMonetization.getState().adsActive()) return resolve();

    winsSinceAd += 1;
    const cooledDown = Date.now() - lastInterstitialAt > AD_RULES.interstitialCooldownMs;
    const due = winsSinceAd >= AD_RULES.interstitialEveryNWins;

    if (!(due && cooledDown && interstitialReady)) return resolve();

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

export function isRewardedReady() {
  return rewardedReady;
}

/** Resolves true only if the user earned the reward. */
export function showRewarded(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!rewardedReady) return resolve(false);
    let earned = false;

    const u1 = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      earned = true;
    });
    const u2 = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      u1(); u2();
      loadRewarded();
      resolve(earned);
    });
    rewarded.show().catch(() => resolve(false));
  });
}
```

Key points:
- `maybeShowInterstitial()` checks `adsActive()` first, so **ad-free mode silences it automatically**.
- `showRewarded()` does not check `adsActive()`. It is always **user-initiated**, so it stays available in ad-free mode.
- Always preload the next ad inside the `CLOSED` handler.

---

## 10. Step 8: App startup wiring

In `App.tsx` (or your root layout):

```tsx
import { useEffect } from 'react';
import { initAds } from './src/ads/adsService';
import { initPurchases } from './src/purchases/purchases';

export default function App() {
  useEffect(() => {
    (async () => {
      await initPurchases(); // resolve entitlement first
      await initAds();       // then consent + SDK
    })();
  }, []);

  // ...navigation tree
}
```

Order matters: resolving the entitlement first avoids briefly loading ads for a paying user.

---

## 11. Step 9: Banner component (map screen only)

Create `src/ads/MapBanner.tsx`:

```tsx
import React from 'react';
import { View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { AD_UNITS } from './adConfig';
import { useMonetization } from '../store/monetizationStore';

export default function MapBanner() {
  // Subscribe to BOTH flags so the banner disappears instantly when toggled
  const adsRemoved = useMonetization((s) => s.adsRemoved);
  const adFreeEnabled = useMonetization((s) => s.adFreeEnabled);
  const show = !(adsRemoved && adFreeEnabled);

  if (!show) return null;

  return (
    <View style={{ alignItems: 'center' }}>
      <BannerAd
        unitId={AD_UNITS.banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
      />
    </View>
  );
}
```

Place it at the **bottom of the level map screen**, below the scrollable path, so it never covers level nodes.

---

## 12. Step 10: Integrate into gameplay

### 12.1 Win overlay (interstitial)

The auto-chain flow must not be interrupted. Run the ad **before** the auto-advance timer starts:

```tsx
async function onWin() {
  showWinOverlay();                 // show the reveal / stats first
  await maybeShowInterstitial();    // resolves immediately if ad-free or not due
  startAutoAdvanceTimer();          // then continue the slideshow flow
}
```

Rules:
- Cancel any pending auto-advance timer while the ad is open.
- Never show an interstitial on a **restart** or **fail**.

### 12.2 Fail overlay (rewarded "+30s")

```tsx
const [usedReward, setUsedReward] = useState(false); // reset on every new attempt

async function onWatchAd() {
  const earned = await showRewarded();
  if (earned) {
    setUsedReward(true);
    addSeconds(AD_RULES.rewardedBonusSeconds);  // extend timer
    resumePuzzle();                              // continue same board state
  }
}

// In the fail overlay JSX:
{!usedReward && isRewardedReady() && (
  <BrassButton label="Watch ad: +30s" onPress={onWatchAd} />
)}
```

Rules:
- Show the button only once per attempt (`usedReward`).
- Cancel the 5-second idle fade-to-map timer while the ad is playing.
- A continued attempt still counts as **not a first-attempt solve** for streak purposes. Decide this in your spec and keep it consistent.

---

## 13. Step 11: Settings page with the ad-free switch

Add an **Ads** section to Settings.

```tsx
import React, { useState } from 'react';
import { View, Text, Switch, Alert } from 'react-native';
import { useMonetization } from '../store/monetizationStore';
import { buyRemoveAds, restorePurchases } from '../purchases/purchases';

export default function AdsSettingsSection() {
  const adsRemoved = useMonetization((s) => s.adsRemoved);
  const adFreeEnabled = useMonetization((s) => s.adFreeEnabled);
  const setAdFreeEnabled = useMonetization((s) => s.setAdFreeEnabled);
  const [busy, setBusy] = useState(false);

  async function onBuy() {
    setBusy(true);
    const r = await buyRemoveAds();
    setBusy(false);
    if (r === 'error') Alert.alert('Purchase failed', 'Please try again later.');
  }

  async function onRestore() {
    setBusy(true);
    const ok = await restorePurchases();
    setBusy(false);
    Alert.alert(ok ? 'Restored' : 'Nothing to restore',
      ok ? 'Ad-free is active again.' : 'No previous purchase was found.');
  }

  return (
    <View>
      <Text>Ads</Text>

      {adsRemoved ? (
        // PAID USERS: the switch
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text>Ad-free mode</Text>
            <Text>
              {adFreeEnabled
                ? 'Banners and video ads are off.'
                : 'Ads are back on. Switch on to hide them again.'}
            </Text>
          </View>
          <Switch value={adFreeEnabled} onValueChange={setAdFreeEnabled} />
        </View>
      ) : (
        // FREE USERS: purchase button
        <BrassButton label="Remove Ads" onPress={onBuy} disabled={busy} />
      )}

      <BrassButton label="Restore Purchases" onPress={onRestore} disabled={busy} />
    </View>
  );
}
```

Behavior summary:

| User state | What Settings shows |
|---|---|
| Never purchased | **Remove Ads** button + Restore Purchases |
| Purchased, switch ON | Ad-free mode switch (ON) |
| Purchased, switch OFF | Ad-free mode switch (OFF), with ads active |

Style the switch and buttons to match the wood and brass theme (brass thumb, carved track).

---

## 14. Step 12: Testing checklist

**Ads (with test IDs)**
- [ ] Banner appears on the map screen only
- [ ] Interstitial shows on the 3rd win and not before
- [ ] Interstitial does not repeat within 90 seconds
- [ ] Auto-advance waits for the interstitial to close
- [ ] Rewarded button appears on fail, once per attempt
- [ ] Closing the rewarded ad early gives no bonus time
- [ ] Airplane mode: game works fully and no crash or blank space where the banner was

**Purchases (sandbox)**
- [ ] iOS: sandbox tester account. Android: license tester account added in Play Console
- [ ] Buying `slyde_remove_ads` flips `adsRemoved` to true and hides the banner instantly
- [ ] Reinstall the app, then **Restore Purchases** restores ad-free
- [ ] Cancelling the purchase sheet leaves state unchanged

**The switch**
- [ ] Hidden for unpaid users (Remove Ads button shown instead)
- [ ] Toggling OFF re-enables the banner and interstitials immediately
- [ ] Toggling ON hides them immediately
- [ ] The setting survives an app restart
- [ ] The setting survives going offline

---

## 15. Step 13: Release checklist

1. Replace test IDs with production IDs (the `__DEV__` switch in `adConfig.ts` handles this in release builds, but verify).
2. Add the AdMob App IDs for both platforms.
3. **Consent:** configure the GDPR message in AdMob (**Privacy & messaging**).
4. **Google Play:** complete the **Data safety** form (advertising ID, purchases) and declare ads in the listing.
5. **App Store:** answer the privacy "nutrition label" (advertising data, purchases). If you request tracking permission, the ATT prompt text must be accurate.
6. Publish a **privacy policy URL** and link it inside the app (Settings > About).
7. Add a **Restore Purchases** control (Apple requires it).
8. Link the AdMob app to its store listing after publishing so ad revenue and `app-ads.txt` verification work.
9. Roll out gradually (Play staged rollout) and watch crash reports for the first two days.

---

## 16. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Ads never load | Using Expo Go (switch to a dev build); no internet; brand-new ad units can take up to a few hours to start filling |
| "No fill" errors in production | Normal at low volume. Always handle `ERROR` gracefully and never block gameplay on an ad |
| Banner leaves a blank gap | Collapse the container when the ad fails (`onAdFailedToLoad` > hide the view) |
| Purchase succeeds but ads still show | Entitlement name mismatch (`ad_free` in code vs dashboard) or product not attached to the entitlement |
| Switch does nothing | `adsRemoved` is false, so the setter is ignored by design. Check RevenueCat sync |
| Rewarded gives no bonus | Reward was granted only after the user closed early. Grant on `EARNED_REWARD`, not on `CLOSED` |
| Account flagged for invalid traffic | You clicked live ads in development. Always use `TestIds` in `__DEV__` |

---

## 17. Folder structure

```
src/
  ads/
    adConfig.ts
    adsService.ts
    MapBanner.tsx
  purchases/
    purchases.ts
  store/
    monetizationStore.ts
  db/
    kv.ts
  screens/
    SettingsScreen.tsx      (renders AdsSettingsSection)
    LevelMapScreen.tsx      (renders MapBanner)
    PuzzleScreen.tsx        (win + fail overlay hooks)
```

---

## 18. Decision log

| Decision | Reason |
|---|---|
| AdMob over other networks | Largest fill, best Expo support, built-in consent tooling |
| RevenueCat over raw store billing | Handles receipts, restore, and entitlements with no backend, matching the local-only design |
| Two flags (`adsRemoved` + `adFreeEnabled`) | Keeps the paid entitlement separate from the user's preference, so toggling never loses the purchase |
| Rewarded ads allowed in ad-free mode | They are user-initiated, never intrusive, and give paid users an optional perk |
| Banner on map only | Puzzle screen uses drag gestures; a banner there causes mis-taps |
| Interstitial on win overlay, awaited before auto-advance | Keeps the slideshow flow intact and never interrupts active play |
| Entitlement resolved before ad init | Prevents ads loading for paying users |
| Cached `adsRemoved` in SQLite | Correct behavior when launched offline |
