"use client";

import { ArrowUpCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { isNativeBridgeAvailable, nativeBridge } from "@/bridge/nativeBridge";
import {
  evaluateVersionPolicy,
  type MobileVersionPolicy,
  type VersionPolicyDecision,
} from "@/ui/shared/appVersionPolicy";

type GateState =
  | {
      status: "idle" | "allowed" | "failed";
      decision: null;
    }
  | {
      status: "checking";
      decision: null;
    }
  | {
      status: "blocked" | "optional";
      decision: Extract<
        VersionPolicyDecision,
        { action: "force-update" | "optional-update" }
      >;
    };

export function AppVersionGate() {
  const [gateState, setGateState] = useState<GateState>(() =>
    isNativeBridgeAvailable()
      ? { status: "checking", decision: null }
      : { status: "allowed", decision: null },
  );
  const [openingStore, setOpeningStore] = useState(false);

  useEffect(() => {
    if (!isNativeBridgeAvailable()) {
      return;
    }

    let canceled = false;

    const checkVersionPolicy = async () => {
      try {
        const [appInfo, policyResponse] = await Promise.all([
          nativeBridge.getAppInfo(),
          fetch("/api/app/version-policy", {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache" },
          }),
        ]);

        if (!policyResponse.ok) throw new Error("Version policy unavailable.");

        const policy = (await policyResponse.json()) as MobileVersionPolicy;
        const decision = evaluateVersionPolicy(appInfo, policy);

        if (canceled) return;

        if (decision.action === "force-update") {
          setGateState({ status: "blocked", decision });
          return;
        }

        if (decision.action === "optional-update") {
          setGateState({ status: "optional", decision });
          return;
        }

        setGateState({ status: "allowed", decision: null });
      } catch (error) {
        console.warn("[version-policy] Version check failed open.", {
          message: error instanceof Error ? error.message : String(error),
        });
        if (!canceled) setGateState({ status: "failed", decision: null });
      }
    };

    void checkVersionPolicy();

    return () => {
      canceled = true;
    };
  }, []);

  if (
    gateState.status === "idle" ||
    gateState.status === "allowed" ||
    gateState.status === "failed"
  ) {
    return null;
  }

  if (gateState.status === "checking") {
    return null;
  }

  const forceUpdate = gateState.status === "blocked";
  const decision = gateState.decision;
  if (!decision) return null;

  const openUpdateUrl = async () => {
    if (openingStore || !decision.updateUrl) return;

    setOpeningStore(true);
    try {
      await nativeBridge.openExternalUrl({ url: decision.updateUrl });
    } finally {
      setOpeningStore(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 px-6 py-8"
      role="dialog"
      aria-modal={forceUpdate ? "true" : "false"}
      aria-label={forceUpdate ? "필수 업데이트" : "새 버전 업데이트"}
    >
      {!forceUpdate ? (
        <button
          type="button"
          aria-label="업데이트 안내 닫기"
          onClick={() => setGateState({ status: "allowed", decision: null })}
          className="absolute inset-0 cursor-default"
        />
      ) : null}
      <section className="relative z-10 w-full max-w-[360px] rounded-[var(--radius-xl)] bg-[var(--surface)] p-6 text-center shadow-[var(--shadow-modal)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--accent-soft)] text-[var(--accent)]">
          <ArrowUpCircle size={28} aria-hidden="true" />
        </div>
        <h2 className="mt-5 text-[20px] font-bold tracking-[-0.01em] text-[var(--fg-strong)]">
          {forceUpdate ? "업데이트가 필요합니다" : "새 버전이 있어요"}
        </h2>
        <p className="mt-3 whitespace-pre-line text-[14px] leading-6 text-[var(--fg-muted)]">
          {decision.message}
        </p>
        <div className={forceUpdate ? "mt-8" : "mt-8 grid grid-cols-2 gap-3"}>
          {!forceUpdate ? (
            <button
              type="button"
              onClick={() =>
                setGateState({ status: "allowed", decision: null })
              }
              className="rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] px-6 py-5 text-[18px] font-bold text-[var(--fg)] active:scale-[0.98]"
            >
              나중에
            </button>
          ) : null}
          <button
            type="button"
            onClick={openUpdateUrl}
            disabled={!decision.updateUrl || openingStore}
            className="w-full rounded-[var(--radius-lg)] bg-[var(--accent)] px-6 py-5 text-[18px] font-bold text-white shadow-[var(--shadow-card)] active:scale-[0.98] disabled:opacity-40"
          >
            {openingStore ? "이동 중" : "업데이트"}
          </button>
        </div>
      </section>
    </div>
  );
}
