const PASSPORT_QR_PREFIX = "blending:passport:v1:";

export function passportQrValue(token: string): string {
  return PASSPORT_QR_PREFIX + token;
}

export function parsePassportQr(value: string): string | null {
  if (!value.startsWith(PASSPORT_QR_PREFIX)) return null;
  const token = value.slice(PASSPORT_QR_PREFIX.length);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}
