export type DaumPostcodeData = {
  readonly zonecode: string;
  readonly address: string;
  readonly roadAddress: string;
  readonly jibunAddress: string;
  readonly autoRoadAddress: string;
  readonly autoJibunAddress: string;
  readonly buildingName: string;
  readonly userSelectedType: "R" | "J";
};

type DaumPostcodeInstance = {
  readonly embed: (element: HTMLElement) => void;
};

export type DaumPostcodeWindow = Window &
  typeof globalThis & {
    readonly daum?: {
      readonly Postcode: new (options: {
        readonly oncomplete: (data: DaumPostcodeData) => void;
        readonly onsearch?: () => void;
        readonly submitMode?: boolean;
        readonly width?: string;
        readonly height?: string;
      }) => DaumPostcodeInstance;
    };
  };

let daumPostcodeScriptPromise: Promise<void> | null = null;

export function loadDaumPostcodeScript() {
  const postcodeWindow: DaumPostcodeWindow = window;
  if (postcodeWindow.daum?.Postcode) return Promise.resolve();
  if (daumPostcodeScriptPromise) return daumPostcodeScriptPromise;

  daumPostcodeScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("우편번호 검색을 불러오지 못했습니다."));
    document.head.appendChild(script);
  });

  return daumPostcodeScriptPromise;
}

export function selectedPostcodeAddress(data: DaumPostcodeData) {
  if (data.userSelectedType === "J")
    return data.jibunAddress || data.autoJibunAddress || data.address;
  return data.roadAddress || data.autoRoadAddress || data.address;
}
