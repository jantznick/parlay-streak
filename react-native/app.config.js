module.exports = {
  expo: {
    name: "Parlay Streak",
    slug: "parlay-streak-mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    assetBundlePatterns: ["**/*"],
    web: {
      favicon: "./assets/favicon.png",
    },
    scheme: "parlaystreak",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.parlaystreak.app",
      associatedDomains: ["applinks:parlaystreak.com"],
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: "com.parlaystreak.app",
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "https",
              host: "parlaystreak.com",
              pathPrefix: "/auth/verify",
            },
            {
              scheme: "parlaystreak",
              host: "auth",
              pathPrefix: "/verify",
            },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
    extra: {
      eas: {
        projectId: "896a72d3-d8b2-4a41-8c11-6277fa4ffc78",
      },
    },
    owner: "nickjantz",
    "react-native-google-mobile-ads": {
      ios_app_id: "ca-app-pub-3940256099942544~1458002511",
      android_app_id: "ca-app-pub-3940256099942544~3347511713",
    },
    plugins: ["expo-font", "react-native-google-mobile-ads"],
  },
};
