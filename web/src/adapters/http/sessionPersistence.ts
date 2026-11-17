const STORAGE_KEY = "blending:session";

type WebStorage = Pick<Storage, "removeItem">;

function browserStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function forgetSessionToken(
  storage: WebStorage | null = browserStorage(),
) {
  storage?.removeItem(STORAGE_KEY);
}
