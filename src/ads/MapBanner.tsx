// SLYDE — the Level Map banner (slyde-ads-monetization.md §11).
// Adaptive banner pinned to the bottom of the Map screen ONLY — never the
// Puzzle screen, where a banner would mis-tap drags. Subscribes to BOTH
// monetization flags so it disappears the instant the user flips the
// ad-free switch (or completes the purchase), and collapses itself while
// unloaded so a failed request never leaves a blank gap.

import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { AD_UNITS } from './adConfig';
import { useAppStore } from '../store/app';
import { C } from '../theme';

export default function MapBanner() {
  // Derived from both flags: hidden whenever (purchased && ad-free switch on).
  const adsActive = useAppStore((s) => !(s.settings.adsRemoved && s.settings.adFreeEnabled));
  const [loaded, setLoaded] = useState(false);

  if (!adsActive) return null;

  return (
    <View style={[styles.wrap, !loaded && styles.collapsed]}>
      <BannerAd
        unitId={AD_UNITS.banner}
        size={BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => setLoaded(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    backgroundColor: C.bgDeep,
  },
  collapsed: { height: 0 },
});
