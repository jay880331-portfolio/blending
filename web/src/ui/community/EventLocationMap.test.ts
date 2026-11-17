import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getEventLocationMapKey,
  getNaverMapAppSearchUrl,
  getNaverMapSearchUrl,
  getPlaceSearchUrl,
  isEventLocationMapVisible,
  openNaverMapInNativeApp,
  synchronizeEventLocationMapSize,
} from "./EventLocationMap";

test("장소와 주소를 네이버 지도 검색 URL로 안전하게 인코딩한다", () => {
  assert.equal(
    getNaverMapSearchUrl("블렌딩 카페", "서울 중구 세종대로 1"),
    "https://map.naver.com/p/search/%EB%B8%94%EB%A0%8C%EB%94%A9%20%EC%B9%B4%ED%8E%98%20%EC%84%9C%EC%9A%B8%20%EC%A4%91%EA%B5%AC%20%EC%84%B8%EC%A2%85%EB%8C%80%EB%A1%9C%201",
  );
});

test("네이티브 앱에서는 네이버지도 앱 검색 URL을 사용한다", () => {
  assert.equal(
    getNaverMapAppSearchUrl("장소 미정", "경기 수원시 권선구 세화로134번길 37"),
    "nmap://search?query=%EA%B2%BD%EA%B8%B0%20%EC%88%98%EC%9B%90%EC%8B%9C%20%EA%B6%8C%EC%84%A0%EA%B5%AC%20%EC%84%B8%ED%99%94%EB%A1%9C134%EB%B2%88%EA%B8%B8%2037&appname=com.blending.app",
  );
});

test("네이티브 앱에서는 WebView 탐색 대신 브리지로 네이버지도를 연다", async () => {
  const openedUrls: string[] = [];
  const url = getNaverMapAppSearchUrl(
    "수원메쎄",
    "경기 수원시 권선구 세화로134번길 37",
  );

  await openNaverMapInNativeApp(url, async ({ url: nextUrl }) => {
    openedUrls.push(nextUrl);
  });

  assert.deepEqual(openedUrls, [url]);
});

test("주소 검색 요청도 주소를 인코딩한다", () => {
  assert.equal(
    getPlaceSearchUrl("서울 중구 세종대로 1"),
    "/api/places/search?query=%EC%84%9C%EC%9A%B8%20%EC%A4%91%EA%B5%AC%20%EC%84%B8%EC%A2%85%EB%8C%80%EB%A1%9C%201",
  );
});

test("장소가 바뀌면 이전 장소의 지도를 숨긴다", () => {
  const loadedLocationKey = getEventLocationMapKey(
    "블렌딩 카페",
    "서울 중구 세종대로 1",
  );
  const nextLocationKey = getEventLocationMapKey(
    "다른 카페",
    "서울 종로구 율곡로 1",
  );

  assert.equal(
    isEventLocationMapVisible(loadedLocationKey, nextLocationKey),
    false,
  );
});

test("지도 컨테이너의 실제 크기로 SDK 뷰포트를 동기화한다", () => {
  const sizes: unknown[] = [];
  synchronizeEventLocationMapSize(
    { setSize: (size) => sizes.push(size) },
    { getBoundingClientRect: () => ({ width: 474, height: 176 }) },
    {
      Size: class {
        constructor(
          readonly width: number,
          readonly height: number,
        ) {}
      },
    },
  );

  assert.deepEqual(
    sizes.map((size) => {
      const { width, height } = size as { width: number; height: number };
      return { width, height };
    }),
    [{ width: 474, height: 176 }],
  );
});
