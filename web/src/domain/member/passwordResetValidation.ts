export function validatePasswordResetDraft({
  verificationToken,
  password,
  passwordConfirm,
}: {
  verificationToken: string;
  password: string;
  passwordConfirm: string;
}) {
  if (!verificationToken) return "휴대폰 인증을 먼저 완료해주세요.";
  if (password.length < 8) return "새 비밀번호는 8자리 이상이어야 합니다.";
  if (password !== passwordConfirm) return "새 비밀번호가 일치하지 않습니다.";
  return null;
}
