"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, LockKeyhole, Smartphone } from "lucide-react";
import {
  fetchRecentLoginMethod,
  loginWithPhone,
  confirmPhoneVerification,
  requestPhoneVerification,
  resetPasswordWithPhone,
  type LoginMethod,
} from "@/adapters/http/authApi";
import { forgetSessionToken } from "@/adapters/http/sessionPersistence";
import { validatePasswordResetDraft } from "@/domain/member/passwordResetValidation";
import type { PublicMemberRole } from "@/domain/member/types";
import type { NativeAppleFullName } from "@blending/bridge";
import {
  startGlobalLoading,
  stopGlobalLoading,
} from "@/ui/shared/GlobalLoadingBar";
import { isNativeBridgeAvailable, nativeBridge } from "@/bridge/nativeBridge";
import { TermsConsentCheckbox } from "@/ui/shared/TermsConsentCheckbox";
import { Button } from "@/ui/shared/Button";
import { Input } from "@/ui/shared/Input";
import { FieldLabel } from "@/ui/shared/Field";

type LoginAppProps = {
  view: string[];
};

type SocialProvider = {
  id: "kakao" | "naver" | "apple";
  label: string;
  mark: ReactNode;
  className: string;
};

type NativeSocialLoginResponse = {
  message?: string;
  method?: LoginMethod;
  nextPath?: string;
};

const PRIVACY_POLICY_URL = "https://blending-homepage.ridge-it.site/privacy";

const socialProviders: SocialProvider[] = [
  {
    id: "kakao",
    label: "카카오로 시작하기",
    mark: <KakaoTalkIcon className="h-9 w-9" />,
    className: "bg-[var(--warn)] text-[var(--fg)]",
  },
  {
    id: "naver",
    label: "네이버로 시작하기",
    mark: <NaverTextMark className="text-[30px]" />,
    className: "bg-[#2DBE26] text-white",
  },
  {
    id: "apple",
    label: "Apple로 시작하기",
    mark: null,
    className: "bg-[var(--fg-strong)] text-[var(--surface)]",
  },
];

const RECENT_LOGIN_STORAGE_KEY = "blending:recent-login-method";
function isSocialProviderId(
  value: string | undefined,
): value is SocialProvider["id"] {
  return value === "kakao" || value === "naver" || value === "apple";
}

const signupRoleOptions = [
  {
    role: "barista" as const,
    title: "바리스타",
    description: "커피 전문 지식을 공유하고 커리어를 관리하고 싶다면",
    imageSrc:
      "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=900&q=80",
    imageAlt: "에스프레소 머신 앞에서 커피를 준비하는 바리스타",
  },
  {
    role: "enthusiast" as const,
    title: "커피애호가",
    description: "다양한 카페 정보를 탐색하고 커피 문화를 즐기고 싶다면",
    imageSrc:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",
    imageAlt: "테이블 위에 놓인 커피잔과 카페 장면",
  },
  {
    role: "partner" as const,
    title: "파트너",
    description: "장비, 원두, 서비스 제안을 바리스타에게 소개하고 싶다면",
    imageSrc:
      "https://images.unsplash.com/photo-1517231925375-bf2cb42917a5?auto=format&fit=crop&w=900&q=80",
    imageAlt: "카페 바에서 비즈니스 상담을 나누는 사람들",
  },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function isLoginMethod(value: string | null): value is LoginMethod {
  return (
    value === "phone" ||
    value === "kakao" ||
    value === "naver" ||
    value === "apple"
  );
}

function KakaoTalkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label="카카오"
      className={className}
    >
      <path
        fill="currentColor"
        d="M24 10.3c-9.4 0-17 5.9-17 13.1 0 4.6 3.2 8.7 7.9 11l-1.1 5.7c-.1.7.6 1.1 1.2.7l6.4-4.3c.8.1 1.7.1 2.6.1 9.4 0 17-5.9 17-13.2 0-7.2-7.6-13.1-17-13.1Z"
      />
      <text
        x="24"
        y="26.1"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="7.2"
        fontWeight="900"
        letterSpacing="-0.25"
        fill="#F2B600"
      >
        TALK
      </text>
    </svg>
  );
}

function NaverTextMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "font-sans font-black leading-none tracking-0 text-white",
        className,
      )}
    >
      N
    </span>
  );
}

function AppleLogo() {
  return (
    <Image
      src="https://appleid.cdn-apple.com/appleid/button/logo?color=black&border=false&border_radius=50&scale=2&size=48"
      alt=""
      aria-hidden="true"
      width={48}
      height={48}
      unoptimized
      className="h-12 w-12"
    />
  );
}

function cachedRecentLoginMethod() {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(RECENT_LOGIN_STORAGE_KEY);
    return isLoginMethod(value) ? value : null;
  } catch {
    return null;
  }
}

function rememberRecentLoginMethod(method: LoginMethod) {
  try {
    window.localStorage.setItem(RECENT_LOGIN_STORAGE_KEY, method);
  } catch {
    // DB fallback still records the method, so cache failures are non-blocking.
  }
}

export function resolveRecentLoginMethod(
  cachedMethod: LoginMethod | null,
  serverMethod: LoginMethod | null,
) {
  return serverMethod ?? cachedMethod;
}

function useRecentLoginMethod() {
  const [method, setMethod] = useState<LoginMethod | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cachedMethod = cachedRecentLoginMethod();
    void fetchRecentLoginMethod().then((serverMethod) => {
      if (cancelled) return;
      const recentMethod = resolveRecentLoginMethod(cachedMethod, serverMethod);
      if (!recentMethod) return;
      setMethod(recentMethod);
      if (serverMethod) rememberRecentLoginMethod(serverMethod);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return method;
}

function useNativeIos() {
  const [isNativeIos, setIsNativeIos] = useState(false);

  useEffect(() => {
    if (!isNativeBridgeAvailable()) return;

    let cancelled = false;
    void nativeBridge
      .getAppInfo()
      .then(({ platform }) => {
        if (!cancelled) setIsNativeIos(platform === "ios");
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  return isNativeIos;
}

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function LoginApp({ view }: LoginAppProps) {
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const root = view[0];
  const provider = view[1];

  useEffect(() => {
    forgetSessionToken();
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    stopGlobalLoading();
  }, [view]);

  const showToast = (message: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  };

  return (
    <LoginShell>
      {root === "phone" ? (
        <PhoneLoginScreen showToast={showToast} />
      ) : root === "terms" ? (
        <TermsScreen />
      ) : root === "consent" ? (
        <TermsConsentScreen showToast={showToast} />
      ) : root === "privacy" ? (
        <PrivacyScreen />
      ) : root === "password" ? (
        <PasswordFindScreen showToast={showToast} />
      ) : root === "social" && isSocialProviderId(provider) ? (
        <SocialRoleScreen providerId={provider} showToast={showToast} />
      ) : (
        <LoginChoiceScreen showToast={showToast} />
      )}
      {toast ? <Toast message={toast} /> : null}
    </LoginShell>
  );
}

function LoginShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--surface-alt)]">
      <div className="relative mx-auto min-h-screen max-w-[var(--app-shell-max-width)] overflow-x-hidden bg-[var(--bg)] shadow-[0_0_0_1px_var(--border)]">
        {children}
      </div>
    </div>
  );
}

function TermsScreen() {
  return (
    <div className="member-slide-page min-h-screen bg-[var(--bg)]">
      <LoginHeader title="서비스 이용약관" back />
      <main className="space-y-8 px-6 pb-12 pt-10 text-[14px] leading-7 text-[var(--fg-muted)]">
        <section>
          <p className="ds-label">시행일 2026. 7. 31.</p>
          <h2 className="ds-display-m mt-3">
            안전한 커피 커뮤니티를 위한 약속
          </h2>
          <p className="mt-4">
            BLENDING은 커피 정보를 나누고 서로를 존중하는 커뮤니티입니다.
            서비스를 이용하면 본 약관과 커뮤니티 운영정책에 동의하는 것으로
            봅니다.
          </p>
        </section>
        <section>
          <h3 className="ds-h2">금지 콘텐츠</h3>
          <p className="mt-3">
            불쾌감을 주는 내용, 위협·혐오 표현, 성적 콘텐츠, 불법 콘텐츠는
            무관용 원칙으로 허용하지 않습니다. 이용자는 자신이 게시하거나
            전송하는 모든 콘텐츠와 활동에 책임을 집니다.
          </p>
        </section>
        <section id="community-rules">
          <h3 className="ds-h2">신고·차단과 운영 조치</h3>
          <p className="mt-3">
            이용자는 문제 콘텐츠나 이용자를 신고하거나 차단할 수 있습니다.
            운영자는 신고를 24시간 안에 검토하며, 위반 콘텐츠를 삭제하고 경고,
            이용 제한 또는 계정 제재를 할 수 있습니다.
          </p>
        </section>
        <section>
          <h3 className="ds-h2">개인정보와 정책</h3>
          <p className="mt-3">
            개인정보 처리와 이용자의 권리는 개인정보 처리방침을 따릅니다. 본
            약관은 관련 법령과 서비스 운영상 필요한 범위에서 고지 후 변경될 수
            있습니다.
          </p>
          <Link
            prefetch={false}
            href="/login/privacy"
            className="ds-inline-link mt-3 inline-block"
          >
            개인정보 처리방침 보기
          </Link>
        </section>
      </main>
    </div>
  );
}

function TermsConsentScreen({
  showToast,
}: {
  showToast: (message: string) => void;
}) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const acceptTerms = async () => {
    if (submitting || !termsAccepted) return;

    setSubmitting(true);
    startGlobalLoading();
    try {
      const response = await fetch("/api/auth/terms/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termsAccepted }),
      });
      const data = (await response.json()) as {
        message?: string;
        method?: LoginMethod;
      };
      if (!response.ok)
        throw new Error(data.message ?? "약관 동의 처리에 실패했습니다.");

      if (data.method) rememberRecentLoginMethod(data.method);
      window.location.assign("/home");
    } catch (error) {
      stopGlobalLoading();
      showToast(
        error instanceof Error
          ? error.message
          : "약관 동의 처리에 실패했습니다.",
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="member-slide-page flex min-h-screen flex-col bg-[var(--bg)]">
      <LoginHeader title="서비스 이용약관" back />
      <main className="px-6 pt-10">
        <h1 className="ds-display-m">
          서비스 이용을 계속하려면 동의가 필요해요
        </h1>
        <p className="ds-body-l ds-muted mt-4">
          안전한 커피 커뮤니티를 위해 서비스 이용약관과 커뮤니티 운영정책을
          확인해주세요.
        </p>
      </main>
      <div className="mt-auto border-t border-[var(--border)] bg-[var(--surface)] px-6 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4">
        <TermsConsentCheckbox
          checked={termsAccepted}
          onChange={setTermsAccepted}
          className="mb-4"
        />
        <Button
          type="button"
          onClick={acceptTerms}
          disabled={submitting || !termsAccepted}
        >
          {submitting ? "처리 중..." : "동의하고 계속하기"}
        </Button>
      </div>
    </div>
  );
}

function PrivacyScreen() {
  useEffect(() => {
    window.location.replace(PRIVACY_POLICY_URL);
  }, []);

  return (
    <div className="member-slide-page min-h-screen bg-[var(--bg)]">
      <LoginHeader title="개인정보 처리방침" back />
      <main className="space-y-5 px-6 pb-12 pt-10 text-[14px] leading-7 text-[var(--fg-muted)]">
        <p>정식 개인정보 처리방침으로 이동하고 있습니다.</p>
        <Link
          prefetch={false}
          href={PRIVACY_POLICY_URL}
          className="ds-inline-link inline-block"
        >
          개인정보 처리방침 열기
        </Link>
      </main>
    </div>
  );
}

function LoginHeader({
  title,
  back = false,
}: {
  title: string;
  back?: boolean;
}) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="grid h-16 grid-cols-[72px_1fr_72px] items-center px-2">
        {back ? (
          <button
            type="button"
            aria-label="뒤로가기"
            onClick={() => router.back()}
            className="flex h-11 w-11 items-center justify-center text-[var(--fg)]"
          >
            <ArrowLeft size={25} strokeWidth={2.2} />
          </button>
        ) : (
          <div />
        )}
        <h1 className="ds-h1 text-center">{title}</h1>
        <div />
      </div>
    </header>
  );
}

function LoginChoiceScreen({
  showToast,
}: {
  showToast: (message: string) => void;
}) {
  const recentLoginMethod = useRecentLoginMethod();
  const isNativeIos = useNativeIos();

  const completeNativeSocialLogin = async (
    provider: Extract<SocialProvider["id"], "kakao" | "naver">,
    accessToken: string,
  ) => {
    const response = await fetch("/api/auth/social/native", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, accessToken }),
    });
    const data = (await response.json()) as NativeSocialLoginResponse;
    if (!response.ok) {
      throw new Error(data.message ?? "앱 소셜 로그인에 실패했습니다.");
    }

    if (data.method) rememberRecentLoginMethod(data.method);
    window.location.assign(data.nextPath ?? "/home");
  };

  const completeNativeAppleLogin = async (input: {
    identityToken: string;
    authorizationCode: string | null;
    user: string;
    email: string | null;
    fullName: NativeAppleFullName | null;
    nonce: string;
    state: string;
    credentialState: string | null;
  }) => {
    const response = await fetch("/api/auth/social/native", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "apple", ...input }),
    });
    const data = (await response.json()) as NativeSocialLoginResponse;
    if (!response.ok) {
      throw new Error(data.message ?? "Apple 로그인에 실패했습니다.");
    }

    if (data.method) rememberRecentLoginMethod(data.method);
    window.location.assign(data.nextPath ?? "/home");
  };

  const startNativeAppleLogin = async () => {
    const challengeResponse = await fetch(
      "/api/auth/social/native/apple-challenge",
    );
    const challenge = (await challengeResponse.json()) as {
      nonce?: string;
      state?: string;
      message?: string;
    };
    if (!challengeResponse.ok || !challenge.nonce || !challenge.state) {
      throw new Error(
        challenge.message ?? "Apple 로그인 요청을 시작하지 못했습니다.",
      );
    }

    const result = await nativeBridge.loginWithApple({
      nonce: challenge.nonce,
      state: challenge.state,
    });
    if (!result.success) {
      if (result.cancelled) return false;
      throw new Error(result.message ?? "Apple 로그인에 실패했습니다.");
    }
    if (result.state !== challenge.state) {
      throw new Error("Apple 로그인 요청을 확인할 수 없습니다.");
    }

    await completeNativeAppleLogin({
      identityToken: result.identityToken,
      authorizationCode: result.authorizationCode,
      user: result.user,
      email: result.email,
      fullName: result.fullName,
      nonce: challenge.nonce,
      state: challenge.state,
      credentialState: result.state,
    });
    return true;
  };

  const startWebSocialLogin = (provider: SocialProvider["id"]) => {
    window.location.assign(`/api/auth/social/${provider}`);
  };

  const startSocialLogin = async (provider: SocialProvider) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      showToast("네트워크 연결을 확인해주세요");
      return;
    }

    startGlobalLoading();
    if (
      isNativeBridgeAvailable() &&
      (provider.id === "kakao" || provider.id === "naver")
    ) {
      try {
        const result =
          provider.id === "kakao"
            ? await nativeBridge.loginWithKakao()
            : await nativeBridge.loginWithNaver();

        if (!result.success) {
          if (result.cancelled) stopGlobalLoading();
          else startWebSocialLogin(provider.id);
          return;
        }

        await completeNativeSocialLogin(provider.id, result.accessToken);
        return;
      } catch {
        startWebSocialLogin(provider.id);
        return;
      }
    }

    if (provider.id === "apple" && isNativeIos) {
      try {
        if (!(await startNativeAppleLogin())) stopGlobalLoading();
      } catch (error) {
        stopGlobalLoading();
        showToast(
          error instanceof Error
            ? error.message
            : "Apple 로그인에 실패했습니다.",
        );
      }
      return;
    }

    startWebSocialLogin(provider.id);
  };

  return (
    <div className="member-slide-page flex min-h-screen flex-col bg-[var(--bg)]">
      <main className="flex min-h-screen flex-col px-6 pb-[calc(env(safe-area-inset-bottom)+44px)] pt-[env(safe-area-inset-top)]">
        <section className="flex min-h-[53.8vh] items-end justify-center pb-[20.7vh] text-center">
          <p className="logo-wordmark text-[31px] font-bold text-[var(--fg-strong)]">
            BLENDING
          </p>
        </section>

        <section className="pb-4">
          <div className="relative">
            <RecentLoginIndicator
              method={recentLoginMethod}
              target="phone"
              className="absolute -top-[76px] left-1/2 -translate-x-1/2"
            />
            <Link
              prefetch={false}
              href="/login/phone"
              className="relative flex min-h-[56px] w-full items-center justify-center rounded-[var(--radius-pill)] bg-[var(--accent)] px-7 text-[16px] font-bold leading-[1.2] text-white transition-transform active:scale-[0.98]"
            >
              <Smartphone
                className="absolute left-8 h-7 w-7"
                strokeWidth={2.1}
              />
              <span>휴대폰으로 로그인</span>
            </Link>
          </div>

          <div className="my-[45px] grid grid-cols-[1fr_auto_1fr] items-center gap-[43px] text-[16px] font-light leading-none text-[var(--fg-faint)]">
            <span className="h-px bg-[var(--border)]" />
            <span>또는</span>
            <span className="h-px bg-[var(--border)]" />
          </div>

          <div className="flex items-center justify-center gap-6">
            <div className="relative">
              <button
                type="button"
                aria-label="카카오로 계속하기"
                onClick={() => startSocialLogin(socialProviders[0])}
                className="relative flex h-12 w-12 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--dot-yellow)] text-[var(--fg)] transition-transform active:scale-[0.98]"
              >
                <KakaoTalkIcon className="h-7 w-7" />
              </button>
              <RecentLoginIndicator
                method={recentLoginMethod}
                target="kakao"
                placement="below"
                className="absolute left-1/2 top-16 -translate-x-1/2"
              />
            </div>
            <div className="relative">
              <button
                type="button"
                aria-label="네이버로 계속하기"
                onClick={() => startSocialLogin(socialProviders[1])}
                className="relative flex h-12 w-12 items-center justify-center rounded-[var(--radius-pill)] bg-[#2DBE26] text-white transition-transform active:scale-[0.98]"
              >
                <NaverTextMark className="text-[29px]" />
              </button>
              <RecentLoginIndicator
                method={recentLoginMethod}
                target="naver"
                placement="below"
                className="absolute left-1/2 top-16 -translate-x-1/2"
              />
            </div>
            {isNativeIos ? (
              <div className="relative">
                <button
                  type="button"
                  aria-label="Apple로 계속하기"
                  title="Apple로 계속하기"
                  onClick={() => startSocialLogin(socialProviders[2])}
                  className="relative flex h-12 w-12 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--fg-strong)] text-[var(--surface)] transition-transform active:scale-[0.98]"
                >
                  <AppleLogo />
                </button>
                <RecentLoginIndicator
                  method={recentLoginMethod}
                  target="apple"
                  placement="below"
                  className="absolute left-1/2 top-16 -translate-x-1/2"
                />
              </div>
            ) : null}
          </div>
        </section>

        <LoginHelpNotice className="mt-auto pt-20" showToast={showToast} />
      </main>
    </div>
  );
}

export function RecentLoginIndicator({
  method,
  target,
  className,
  placement = "above",
}: {
  method: LoginMethod | null;
  target: LoginMethod;
  className?: string;
  placement?: "above" | "below";
}) {
  return method === target ? (
    <RecentLoginBubble className={className} placement={placement} />
  ) : null;
}

function RecentLoginBubble({
  className,
  placement,
}: {
  className?: string;
  placement: "above" | "below";
}) {
  return (
    <span
      className={cn(
        "pointer-events-none z-10 whitespace-nowrap rounded-[var(--radius-pill)] bg-[var(--surface)] px-6 py-[14px] text-[15px] font-medium leading-none text-[var(--fg)] shadow-[0_14px_34px_rgba(0,0,0,0.14)]",
        className,
      )}
    >
      최근에 로그인했어요
      <span
        className={cn(
          "absolute left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-[var(--surface)]",
          placement === "above" ? "bottom-[-8px]" : "top-[-8px]",
        )}
      />
    </span>
  );
}

function SocialRoleScreen({
  providerId,
  showToast,
}: {
  providerId: SocialProvider["id"];
  showToast: (message: string) => void;
}) {
  const provider = socialProviders.find((item) => item.id === providerId);
  const [role, setRole] = useState<PublicMemberRole>("barista");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!provider) return null;

  const completeSignup = async () => {
    if (submitting || !termsAccepted) return;

    setSubmitting(true);
    startGlobalLoading();
    try {
      const response = await fetch("/api/auth/social/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, termsAccepted }),
      });
      const data = (await response.json()) as {
        message?: string;
        method?: LoginMethod;
        nextPath?: string;
      };
      if (!response.ok) throw new Error(data.message ?? "가입에 실패했습니다.");

      if (data.method) rememberRecentLoginMethod(data.method);
      window.location.assign(data.nextPath ?? "/home");
    } catch (error) {
      stopGlobalLoading();
      showToast(
        error instanceof Error ? error.message : "가입에 실패했습니다.",
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="member-slide-page min-h-screen bg-[var(--bg)]">
      <SignupLikeHeader />
      <main className="px-6 pb-56 pt-10">
        <h1 className="ds-display-m text-center">
          어떤 유형으로 가입하시겠어요?
        </h1>
        <p className="ds-body-l ds-muted mt-4 text-center">
          회원 유형에 따라 맞춤화된 기능을 제공합니다.
        </p>

        <div className="mt-8 space-y-4">
          {signupRoleOptions.map((option) => (
            <SocialRoleCard
              key={option.role}
              selected={role === option.role}
              title={option.title}
              description={option.description}
              imageSrc={option.imageSrc}
              imageAlt={option.imageAlt}
              onClick={() => setRole(option.role)}
            />
          ))}
        </div>
      </main>
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[var(--app-shell-max-width)] border-t border-[var(--border)] bg-[var(--surface)] px-6 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4">
        <TermsConsentCheckbox
          checked={termsAccepted}
          onChange={setTermsAccepted}
          className="mb-4"
        />
        <Button
          type="button"
          onClick={completeSignup}
          disabled={submitting || !termsAccepted}
        >
          {provider.mark}
          {submitting
            ? "가입 중..."
            : `${provider.label.replace("시작하기", "가입 완료")}`}
        </Button>
      </div>
    </div>
  );
}

function SocialRoleCard({
  selected,
  title,
  description,
  imageSrc,
  imageAlt,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "w-full overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--surface)] text-center transition-colors",
        selected ? "border-[var(--fg)]" : "border-[var(--border)]",
      )}
    >
      <div className="aspect-[16/9] w-full overflow-hidden bg-[var(--surface-alt)]">
        <Image
          src={imageSrc}
          alt={imageAlt}
          width={900}
          height={506}
          sizes="(max-width: 480px) 100vw, 480px"
          className="h-full w-full object-cover"
        />
      </div>
      <div className="p-5">
        <h2 className="ds-h2">{title}</h2>
        <p className="ds-body ds-muted mt-3">{description}</p>
      </div>
    </button>
  );
}

function SignupLikeHeader() {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)] pt-[env(safe-area-inset-top)]">
      <div className="flex h-16 items-center justify-between px-4">
        <button
          type="button"
          aria-label="뒤로가기"
          onClick={() => router.back()}
          className="flex h-11 w-11 items-center justify-center text-[var(--fg)]"
        >
          <ArrowLeft size={25} strokeWidth={2.2} />
        </button>
        <Link
          prefetch={false}
          href="/login"
          className="logo-wordmark text-[25px] font-bold text-[var(--fg-strong)]"
        >
          BLENDING
        </Link>
        <span className="h-11 w-11" aria-hidden />
      </div>
    </header>
  );
}

function PhoneLoginScreen({
  showToast,
}: {
  showToast: (message: string) => void;
}) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const digits = phone.replace(/\D/g, "");

    if (digits.length < 11 || password.length === 0) {
      setError("정보를 정확히 입력해주세요");
      return;
    }
    setError(null);
    setSubmitting(true);
    startGlobalLoading();
    try {
      const result = await loginWithPhone(phone, password);
      rememberRecentLoginMethod(result.method ?? "phone");
      window.location.assign(result.nextPath ?? "/home");
    } catch (error) {
      stopGlobalLoading();
      showToast(
        error instanceof Error ? error.message : "로그인에 실패했습니다",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="member-slide-page min-h-screen bg-[var(--bg)]">
      <LoginHeader title="휴대폰 번호로 로그인" back />
      <form
        onSubmit={handleSubmit}
        className="flex min-h-[calc(100vh_-_64px_-_env(safe-area-inset-top))] flex-col px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-10"
      >
        <section className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--fg-muted)]">
            <LockKeyhole size={34} strokeWidth={1.8} />
          </div>
        </section>

        <section className="mt-12 space-y-7">
          <label className="block">
            <FieldLabel>휴대폰 번호</FieldLabel>
            <Input
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={(event) => {
                setPhone(formatPhoneNumber(event.target.value));
                setError(null);
              }}
              placeholder="010-0000-0000"
              className="mt-3"
            />
          </label>

          <label className="block">
            <FieldLabel>비밀번호</FieldLabel>
            <Input
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError(null);
              }}
              placeholder="비밀번호를 입력하세요"
              className="mt-3"
            />
          </label>

          {error ? (
            <p className="ds-body-s ds-danger font-bold">{error}</p>
          ) : null}
        </section>

        <div className="mt-auto pt-12">
          <Button type="submit" disabled={submitting}>
            {submitting ? "로그인 중..." : "로그인"}
          </Button>
          <p className="ds-body mt-6 text-center ds-muted">
            <Link prefetch={false} href="/signup" className="ds-inline-link">
              회원가입
            </Link>
            <span className="px-3 text-[var(--fg-faint)]">|</span>
            <Link
              prefetch={false}
              href="/login/password"
              className="ds-inline-link"
            >
              비밀번호 찾기
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}

function PasswordFindScreen({
  showToast,
}: {
  showToast: (message: string) => void;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"phone" | "code" | "password">("phone");
  const passwordMismatch =
    newPasswordConfirm.length > 0 && newPassword !== newPasswordConfirm;

  const submitPhone = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const digits = phone.replace(/\D/g, "");

    if (digits.length < 11) {
      setError("휴대폰 번호를 정확히 입력해주세요");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const result = await requestPhoneVerification(phone);
      setStep("code");
      showToast(result.message);
      if (result.code) setCode(result.code);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "인증번호 전송에 실패했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (code.replace(/\D/g, "").length !== 6) {
      setError("인증번호 6자리를 입력해주세요");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const result = await confirmPhoneVerification(phone, code);
      setVerificationToken(result.verificationToken);
      setStep("password");
      showToast("휴대폰 인증이 완료됐습니다");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "인증번호 확인에 실패했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationMessage = validatePasswordResetDraft({
      verificationToken,
      password: newPassword,
      passwordConfirm: newPasswordConfirm,
    });

    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await resetPasswordWithPhone({
        phone,
        phoneVerificationToken: verificationToken,
        newPassword,
      });
      showToast("비밀번호를 재설정했습니다");
      router.push("/login/phone");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "비밀번호 재설정에 실패했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="member-slide-page min-h-screen bg-[var(--bg)]">
      <LoginHeader title="비밀번호 찾기" back />
      <form
        onSubmit={
          step === "phone"
            ? submitPhone
            : step === "code"
              ? submitCode
              : submitPassword
        }
        className="flex min-h-[calc(100vh_-_64px_-_env(safe-area-inset-top))] flex-col px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-12"
      >
        <div>
          <h1 className="ds-display-m">계정 확인이 필요해요</h1>
          <p className="ds-body-l ds-muted mt-3">
            {step === "phone"
              ? "가입한 휴대폰 번호로 비밀번호 재설정 인증번호를 보내드립니다."
              : step === "code"
                ? "문자로 받은 인증번호를 입력해주세요."
                : "새 비밀번호를 입력하면 바로 로그인할 수 있습니다."}
          </p>
        </div>

        <section className="mt-12 space-y-7">
          <label className="block">
            <FieldLabel>휴대폰 번호</FieldLabel>
            <Input
              name="recoveryPhone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              readOnly={step !== "phone"}
              onChange={(event) => {
                setPhone(formatPhoneNumber(event.target.value));
                setError(null);
              }}
              placeholder="010-0000-0000"
              className="mt-3 read-only:bg-[var(--surface-alt)]"
            />
          </label>
          {step === "code" ? (
            <label className="block">
              <FieldLabel>인증번호</FieldLabel>
              <Input
                name="recoveryCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                  setError(null);
                }}
                placeholder="6자리 입력"
                className="mt-3"
              />
            </label>
          ) : null}
          {step === "password" ? (
            <>
              <label className="block">
                <FieldLabel>새 비밀번호</FieldLabel>
                <Input
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                    setError(null);
                  }}
                  placeholder="8자리 이상 입력하세요"
                  className="mt-3"
                />
              </label>
              <label className="block">
                <FieldLabel>새 비밀번호 확인</FieldLabel>
                <Input
                  name="newPasswordConfirm"
                  type="password"
                  autoComplete="new-password"
                  value={newPasswordConfirm}
                  onChange={(event) => {
                    setNewPasswordConfirm(event.target.value);
                    setError(null);
                  }}
                  placeholder="한 번 더 입력하세요"
                  className="mt-3"
                />
              </label>
              {passwordMismatch ? (
                <p className="ds-body-s ds-danger font-bold">
                  새 비밀번호가 일치하지 않습니다.
                </p>
              ) : null}
            </>
          ) : null}
        </section>
        {error ? (
          <p className="ds-body-s ds-danger mt-4 font-bold">{error}</p>
        ) : null}

        <div className="mt-auto pt-12">
          <Button type="submit" disabled={submitting}>
            {submitting
              ? "처리 중..."
              : step === "phone"
                ? "인증번호 전송"
                : step === "code"
                  ? "인증번호 확인"
                  : "비밀번호 재설정"}
          </Button>
          <p className="ds-body mt-6 text-center ds-muted">
            기억나셨나요?{" "}
            <Link
              prefetch={false}
              href="/login/phone"
              className="ds-inline-link"
            >
              로그인
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}

function LoginHelpNotice({
  className,
  showToast,
}: {
  className?: string;
  showToast: (message: string) => void;
}) {
  return (
    <p
      className={cn(
        "whitespace-nowrap text-center text-[13px] font-light leading-[1.5] text-[var(--fg-faint)]",
        className,
      )}
    >
      로그인, 앱 사용에 궁금한 점이 있으신가요?{" "}
      <button
        type="button"
        onClick={() => showToast("문의 채널은 준비 중입니다")}
        className="font-bold text-[var(--fg-muted)]"
      >
        1:1 문의 &gt;
      </button>
    </p>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+24px)] z-50 mx-auto flex max-w-[var(--app-shell-max-width)] justify-center px-6"
    >
      <div className="ds-body ds-inverse rounded-[var(--radius-lg)] bg-[var(--fg)] px-4 py-3 text-center font-bold shadow-[var(--shadow-modal)]">
        {message}
      </div>
    </div>
  );
}
