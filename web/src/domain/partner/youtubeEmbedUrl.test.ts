import assert from "node:assert/strict";
import test from "node:test";
import {
  getYouTubeEmbedUrl,
  getYouTubeVideoMetadata,
  IOS_YOUTUBE_INLINE_MIN_BUILD,
  selectYouTubePresentation,
} from "./youtubeEmbedUrl";

test("지원하는 YouTube 주소를 privacy-enhanced embed 주소로 변환한다", () => {
  const videoId = "dQw4w9WgXcQ";

  for (const url of [
    `https://www.youtube.com/watch?v=${videoId}`,
    `https://youtube.com/watch?v=${videoId}`,
    `https://m.youtube.com/watch?v=${videoId}`,
    `https://youtu.be/${videoId}`,
    `https://www.youtube.com/shorts/${videoId}`,
  ]) {
    assert.equal(
      getYouTubeEmbedUrl(url),
      `https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1`,
    );
  }
});

test("일반 링크, 잘못된 영상 ID와 미지원 YouTube 경로는 변환하지 않는다", () => {
  for (const url of [
    undefined,
    "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    "https://youtube.com:444/watch?v=dQw4w9WgXcQ",
    "https://example.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=too-short",
    "https://www.youtube.com/live/dQw4w9WgXcQ",
    "not a url",
  ]) {
    assert.equal(getYouTubeEmbedUrl(url), undefined);
  }
});

test("지원하는 YouTube 주소에서 embed, canonical watch, 썸네일 주소를 함께 만든다", () => {
  assert.deepEqual(
    getYouTubeVideoMetadata("https://youtu.be/dQw4w9WgXcQ?si=shared"),
    {
      embedUrl:
        "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?playsinline=1",
      canonicalWatchUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    },
  );
});

test("iOS 네이티브 WebView에서 인라인 재생 빌드 미만이면 YouTube 외부 보기 폴백을 선택한다", () => {
  for (const nativeBuildNumber of [undefined, null, 34]) {
    assert.equal(
      selectYouTubePresentation({
        isNativeBridgeAvailable: true,
        nativePlatform: "ios",
        nativeBuildNumber,
      }),
      "native-ios-fallback",
    );
  }
});

test("iOS 네이티브 WebView에서 인라인 재생 빌드 이상이면 YouTube iframe을 유지한다", () => {
  for (const nativeBuildNumber of [
    IOS_YOUTUBE_INLINE_MIN_BUILD,
    IOS_YOUTUBE_INLINE_MIN_BUILD + 1,
  ]) {
    assert.equal(
      selectYouTubePresentation({
        isNativeBridgeAvailable: true,
        nativePlatform: "ios",
        nativeBuildNumber,
      }),
      "embed",
    );
  }
});

test("브리지가 없거나 iOS가 아닌 환경은 YouTube iframe을 유지한다", () => {
  for (const input of [
    { isNativeBridgeAvailable: false, nativePlatform: "ios" as const },
    {
      isNativeBridgeAvailable: true,
      nativePlatform: "android" as const,
      nativeBuildNumber: 1,
    },
    { isNativeBridgeAvailable: true, nativePlatform: "unknown" as const },
    { isNativeBridgeAvailable: true, nativePlatform: undefined },
  ]) {
    assert.equal(selectYouTubePresentation(input), "embed");
  }
});
