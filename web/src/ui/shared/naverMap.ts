export type NaverMapInstance = {
  getZoom?: () => number;
  setCenter?: (coord: unknown) => void;
  setOptions?: (options: Record<string, unknown>) => void;
  setSize?: (size: unknown) => void;
  setZoom?: (zoom: number) => void;
};

export type NaverMarkerInstance = {
  setMap: (map: unknown | null) => void;
  setPosition?: (position: unknown) => void;
};

export type NaverMapsApi = {
  maps: {
    Event: {
      once: (target: unknown, eventName: string, listener: () => void) => void;
      addListener?: (
        target: unknown,
        eventName: string,
        listener: () => void,
      ) => unknown;
      removeListener?: (listener: unknown) => void;
    };
    LatLng: new (lat: number, lng: number) => unknown;
    Marker: new (options: Record<string, unknown>) => NaverMarkerInstance;
    Point: new (x: number, y: number) => unknown;
    Position: { TOP_LEFT: number };
    Size: new (width: number, height: number) => unknown;
    Map: new (
      element: HTMLElement,
      options: Record<string, unknown>,
    ) => NaverMapInstance;
  };
};

declare global {
  interface Window {
    naver?: NaverMapsApi;
    __blendingNaverMapPromise?: Promise<void>;
  }
}

export function naverLogoControlOptions(
  maps: Pick<NaverMapsApi["maps"], "Position">,
  visible: boolean,
) {
  if (!visible) return { logoControl: false };

  return {
    logoControl: true,
    logoControlOptions: {
      position: maps.Position.TOP_LEFT,
    },
  };
}

export function loadNaverMaps(keyId: string) {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.naver?.maps) return Promise.resolve();
  if (window.__blendingNaverMapPromise) return window.__blendingNaverMapPromise;

  window.__blendingNaverMapPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(
      "naver-map-sdk",
    ) as HTMLScriptElement | null;

    const succeed = () => {
      if (window.naver?.maps) resolve();
      else reject(new Error("네이버 지도를 초기화하지 못했습니다."));
    };
    const fail = () =>
      reject(new Error("네이버 지도 스크립트를 불러오지 못했습니다."));

    if (existingScript) {
      if (window.naver?.maps) {
        resolve();
        return;
      }
      existingScript.addEventListener("load", succeed, { once: true });
      existingScript.addEventListener("error", fail, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = "naver-map-sdk";
    script.async = true;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(keyId)}`;
    script.addEventListener("load", succeed, { once: true });
    script.addEventListener("error", fail, { once: true });
    document.head.appendChild(script);
  });

  return window.__blendingNaverMapPromise;
}
