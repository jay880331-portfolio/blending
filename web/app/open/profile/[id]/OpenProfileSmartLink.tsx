"use client";

import { useEffect } from "react";
import {
  androidProfileIntent,
  appStoreUrl,
  profileDeepLink,
  profileWebHref,
} from "./openProfileLink";

const iosFallbackDelayMs = 1200;

export function OpenProfileSmartLink({ profileId }: { profileId: string }) {
  const webHref = profileWebHref(profileId);

  useEffect(() => {
    const userAgent = navigator.userAgent;

    if (/Android/i.test(userAgent)) {
      window.location.href = androidProfileIntent(profileId);
      return;
    }

    if (!/iPhone|iPad|iPod/i.test(userAgent)) return;

    let fallbackTimer = window.setTimeout(() => {
      window.location.replace(appStoreUrl);
    }, iosFallbackDelayMs);
    const cancelFallback = () => {
      window.clearTimeout(fallbackTimer);
      fallbackTimer = 0;
    };
    const cancelWhenHidden = () => {
      if (document.visibilityState === "hidden") cancelFallback();
    };

    document.addEventListener("visibilitychange", cancelWhenHidden);
    window.addEventListener("pagehide", cancelFallback, { once: true });
    window.location.href = profileDeepLink(profileId);

    return () => {
      cancelFallback();
      document.removeEventListener("visibilitychange", cancelWhenHidden);
      window.removeEventListener("pagehide", cancelFallback);
    };
  }, [profileId]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-6 font-[var(--font-body)] text-[var(--fg)]">
      <section className="max-w-sm text-center">
        <h1 className="text-[20px] font-bold">Blending 프로필 열기</h1>
        <p className="mt-2 text-[14px] leading-6 text-[var(--fg-muted)]">
          Blending 앱에서 프로필을 여는 중입니다.
        </p>
        <a
          className="mt-6 inline-flex rounded-[var(--radius-lg)] border border-[var(--border-strong)] px-5 py-3 text-[16px] font-bold"
          href={webHref}
        >
          웹에서 열기
        </a>
      </section>
    </main>
  );
}
