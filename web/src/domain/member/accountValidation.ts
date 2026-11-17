const ACCOUNT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeAccountEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validateAccountEmail(email: string) {
  const normalized = normalizeAccountEmail(email);
  if (!normalized) return "이메일을 입력해주세요.";
  if (!ACCOUNT_EMAIL_PATTERN.test(normalized))
    return "올바른 이메일 형식으로 입력해주세요.";
  return null;
}

export function normalizeAccountPhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export function validateAccountPhone(phone: string) {
  const normalized = normalizeAccountPhone(phone);
  if (!normalized) return "휴대폰 번호를 입력해주세요.";
  if (normalized.length < 10 || normalized.length > 11)
    return "휴대폰 번호를 정확히 입력해주세요.";
  return null;
}
