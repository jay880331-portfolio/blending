const prefix = "blending:coupon:v1:";
export function customerQrValue(token: string): string {
  return prefix + token;
}
export function parseCustomerQr(value: string): string | null {
  if (!value.startsWith(prefix)) return null;
  const token = value.slice(prefix.length);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}
