import type { ConfigContext, ExpoConfig } from "expo/config";
import {
  withDangerousMod,
  withAndroidManifest,
  withAppDelegate,
  withMainActivity,
  withProjectBuildGradle,
} from "expo/config-plugins";
import appJson from "./app.json";
import fs from "node:fs/promises";
import path from "node:path";
import {
  insertAndroidCookieFlush,
  insertIosCookieSync,
} from "./src/sessionCookieFlush";

type ExpoPlugins = NonNullable<ExpoConfig["plugins"]>;
type AndroidManifestQuery = Record<string, unknown>;

const naverUrlScheme =
  process.env.EXPO_PUBLIC_NAVER_URL_SCHEME ?? "blendingnaver";
const kakaoMavenRepository =
  "maven { url 'https://devrepo.kakao.com/nexus/content/groups/public/' }";
const kakaoTalkPackageQuery = {
  package: [{ $: { "android:name": "com.kakao.talk" } }],
};
const kakaoAuthIntentQuery = {
  intent: [
    {
      action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
      data: [{ $: { "android:scheme": "kakaokompassauth" } }],
    },
  ],
};
const naverMapPackageQuery = {
  package: [{ $: { "android:name": "com.nhn.android.nmap" } }],
};
const naverMapIntentQuery = {
  intent: [
    {
      action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
      category: [
        { $: { "android:name": "android.intent.category.BROWSABLE" } },
      ],
      data: [{ $: { "android:scheme": "nmap" } }],
    },
  ],
};

function hasQuery(queries: AndroidManifestQuery[], needle: string): boolean {
  return queries.some((query) => JSON.stringify(query).includes(needle));
}

function withKakaoMavenRepository(config: ExpoConfig): ExpoConfig {
  return withProjectBuildGradle(config, (buildGradleConfig) => {
    if (buildGradleConfig.modResults.contents.includes(kakaoMavenRepository)) {
      return buildGradleConfig;
    }

    buildGradleConfig.modResults.contents =
      buildGradleConfig.modResults.contents.replace(
        "mavenCentral()\n    maven { url 'https://www.jitpack.io' }",
        `mavenCentral()\n    ${kakaoMavenRepository}\n    maven { url 'https://www.jitpack.io' }`,
      );

    return buildGradleConfig;
  });
}

function withExternalAppVisibility(config: ExpoConfig): ExpoConfig {
  return withAndroidManifest(config, (manifestConfig) => {
    const manifest = manifestConfig.modResults.manifest as {
      queries?: AndroidManifestQuery[];
    };
    const queries = manifest.queries ?? [];

    if (!hasQuery(queries, "com.kakao.talk")) {
      queries.push(kakaoTalkPackageQuery);
    }

    if (!hasQuery(queries, "kakaokompassauth")) {
      queries.push(kakaoAuthIntentQuery);
    }

    if (!hasQuery(queries, "com.nhn.android.nmap")) {
      queries.push(naverMapPackageQuery);
    }

    if (!hasQuery(queries, '"nmap"')) {
      queries.push(naverMapIntentQuery);
    }

    manifest.queries = queries;
    return manifestConfig;
  });
}

function withSessionCookieFlush(config: ExpoConfig): ExpoConfig {
  return withAppDelegate(
    withMainActivity(config, (activity) => {
      if (activity.modResults.language !== "kt") {
        throw new Error("Session cookie flush expects a Kotlin MainActivity");
      }
      activity.modResults.contents = insertAndroidCookieFlush(
        activity.modResults.contents,
      );
      return activity;
    }),
    (delegate) => {
      if (delegate.modResults.language !== "swift") {
        throw new Error("Session cookie flush expects a Swift AppDelegate");
      }
      delegate.modResults.contents = insertIosCookieSync(
        delegate.modResults.contents,
      );
      return delegate;
    },
  );
}

function withBlankAndroidSplashIcon(config: ExpoConfig): ExpoConfig {
  return withDangerousMod(config, [
    "android",
    async (modConfig) => {
      const drawableDirectory = path.join(
        modConfig.modRequest.platformProjectRoot,
        "app/src/main/res/drawable",
      );
      await fs.mkdir(drawableDirectory, { recursive: true });
      await fs.writeFile(
        path.join(drawableDirectory, "splashscreen_logo.xml"),
        '<shape xmlns:android="http://schemas.android.com/apk/res/android"><solid android:color="@android:color/transparent" /></shape>\n',
      );
      return modConfig;
    },
  ]);
}

export default function appConfig({ config }: ConfigContext): ExpoConfig {
  const kakaoNativeAppKey = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY;
  const expo = appJson.expo as ExpoConfig;
  const plugins: ExpoPlugins = [
    ...((expo.plugins ?? []) as ExpoPlugins),
    ...(kakaoNativeAppKey
      ? ([
          [
            "@react-native-kakao/core",
            {
              nativeAppKey: kakaoNativeAppKey,
              android: {
                authCodeHandlerActivity: true,
              },
              ios: {
                handleKakaoOpenUrl: true,
              },
            },
          ],
        ] as ExpoPlugins)
      : []),
    [
      "@react-native-seoul/naver-login",
      {
        urlScheme: naverUrlScheme,
      },
    ],
  ];

  return withSessionCookieFlush(
    withBlankAndroidSplashIcon(
      withExternalAppVisibility(
        withKakaoMavenRepository({
          ...config,
          ...expo,
          plugins,
        }),
      ),
    ),
  );
}
