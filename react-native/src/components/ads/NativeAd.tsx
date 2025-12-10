import React, { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import {
  NativeAd,
  NativeAdView,
  NativeMediaView,
  NativeAsset,
  TestIds,
  NativeAssetType,
  NativeAdEventType,
} from 'react-native-google-mobile-ads';

const adUnitId = __DEV__
  ? TestIds.NATIVE
  : process.env.EXPO_PUBLIC_NATIVE_AD_UNIT_ID || 'YOUR_PRODUCTION_NATIVE_AD_UNIT_ID';

const NativeAdComponent = () => {
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    NativeAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    })
      .then(ad => {
        setNativeAd(ad);
        setLoading(false);
      })
      .catch(error => {
        console.error('Native ad failed to load:', error);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!nativeAd) {
      return;
    }

    const adListener = nativeAd.addAdEventListener(NativeAdEventType.CLICKED, () => {
      console.log('Native ad clicked');
    });

    // Destroy the ad when the component unmounts.
    return () => {
      adListener.remove();
      nativeAd.destroy();
    };
  }, [nativeAd]);

  if (loading || !nativeAd) {
    // You can render a skeleton loader here
    return null;
  }

  return (
    <View className="my-4 px-6">
      <NativeAdView
        nativeAd={nativeAd}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-lg shadow-slate-900/10 dark:shadow-none"
      >
        <View className="flex-row items-center mb-3">
          {nativeAd.icon?.url && (
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image
                source={{ uri: nativeAd.icon.url }}
                className="w-12 h-12 rounded-lg"
              />
            </NativeAsset>
          )}
          <View className="flex-1 ml-3">
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text className="text-base font-bold text-slate-900 dark:text-white">
                {nativeAd.headline}
              </Text>
            </NativeAsset>
            {nativeAd.advertiser && (
              <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                <Text className="text-xs text-slate-500 dark:text-slate-400">
                  {nativeAd.advertiser}
                </Text>
              </NativeAsset>
            )}
          </View>
        </View>

        {nativeAd.body && (
          <NativeAsset assetType={NativeAssetType.BODY}>
            <Text className="text-sm text-slate-600 dark:text-slate-300 mb-3">
              {nativeAd.body}
            </Text>
          </NativeAsset>
        )}

        <NativeMediaView className="w-full h-40 rounded-lg mb-3" />

        <View className="flex-row justify-between items-center">
          <Text className="text-xs text-slate-400 dark:text-slate-500">
            Sponsored
          </Text>
          {nativeAd.cta && (
            <NativeAsset assetType={NativeAssetType.CTA}>
              <View className="bg-orange-600 px-4 py-2 rounded-full">
                <Text className="text-white text-sm font-bold">
                  {nativeAd.cta}
                </Text>
              </View>
            </NativeAsset>
          )}
        </View>
      </NativeAdView>
    </View>
  );
};

export default NativeAdComponent;
