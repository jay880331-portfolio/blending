"use client";

import Link from "next/link";

type TermsConsentCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
};

export function TermsConsentCheckbox({
  checked,
  onChange,
  className,
}: TermsConsentCheckboxProps) {
  return (
    <label
      className={`flex items-start gap-3 text-[13px] leading-5 text-[var(--fg-muted)] ${className ?? ""}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-label="서비스 이용약관, 커뮤니티 운영정책과 개인정보 처리방침 필수 동의"
        className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded-[var(--radius-md)] border-[1.5px] border-[var(--border-strong)] accent-[var(--accent)]"
      />
      <span>
        <Link
          href="/login/terms"
          className="font-bold text-[var(--fg)] underline underline-offset-4"
          onClick={(event) => event.stopPropagation()}
        >
          서비스 이용약관 및 커뮤니티 운영정책
        </Link>
        과{" "}
        <Link
          href="/login/privacy"
          className="font-bold text-[var(--fg)] underline underline-offset-4"
          onClick={(event) => event.stopPropagation()}
        >
          개인정보 처리방침
        </Link>
        에 <span className="font-bold text-[var(--fg)]">필수 동의</span>합니다.
      </span>
    </label>
  );
}
