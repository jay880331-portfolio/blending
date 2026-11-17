const YOUTUBE_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "m.youtube.com",
  "youtu.be",
]);

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export type YouTubeVideoMetadata = {
  embedUrl: string;
  canonicalWatchUrl: string;
  thumbnailUrl: string;
};

export const IOS_YOUTUBE_INLINE_MIN_BUILD = 35;

type YouTubePresentationInput = {
  isNativeBridgeAvailable: boolean;
  nativePlatform: "android" | "ios" | "web" | "unknown" | undefined;
  nativeBuildNumber?: number | null;
};

export function getYouTubeVideoMetadata(
  value: string | undefined,
): YouTubeVideoMetadata | undefined {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !YOUTUBE_HOSTS.has(url.host)) {
      return undefined;
    }

    const videoId =
      url.pathname === "/watch"
        ? url.searchParams.get("v")
        : url.host === "youtu.be"
          ? url.pathname.slice(1)
          : url.pathname.startsWith("/shorts/")
            ? url.pathname.slice("/shorts/".length)
            : undefined;

    if (!videoId || !VIDEO_ID_PATTERN.test(videoId)) return undefined;

    return {
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1`,
      canonicalWatchUrl: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  } catch {
    return undefined;
  }
}

export function getYouTubeEmbedUrl(value: string | undefined) {
  return getYouTubeVideoMetadata(value)?.embedUrl;
}

export function selectYouTubePresentation({
  isNativeBridgeAvailable,
  nativePlatform,
  nativeBuildNumber,
}: YouTubePresentationInput) {
  if (!isNativeBridgeAvailable || nativePlatform !== "ios") return "embed";
  if (
    nativeBuildNumber == null ||
    nativeBuildNumber < IOS_YOUTUBE_INLINE_MIN_BUILD
  ) {
    return "native-ios-fallback";
  }
  return "embed";
}
