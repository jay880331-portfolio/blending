export function isCleartextHttpUrl(value: string) {
  try {
    return new URL(value).protocol === "http:";
  } catch {
    return false;
  }
}

export function normalizeEventApplyUrl(value: string | undefined) {
  const text = value?.trim();
  if (!text) return undefined;
  if (/^[a-z][a-z\d+.-]*:/i.test(text) && !/^https?:/i.test(text)) return null;

  try {
    const url = new URL(/^https?:/i.test(text) ? text : `https://${text}`);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}
