"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { passportQrValue } from "@/domain/passport/passportQr";
import type { PassportScanConfirmResult } from "@/domain/passport/types";
import { readCouponResponse as readJson } from "@/adapters/http/showroomApi";
import { Button } from "@/ui/shared/Button";
import { QrCode } from "@/ui/shared/QrCode";

export type PassportPresentationRequest =
  | { purpose: "STAMP" }
  | {
      purpose: "REDEEM";
      storeId: string;
      storeName: string;
      menuId: string;
      menuName: string;
      points: number;
    };

export function PassportPresentation({
  request,
  onCompleted,
  onClose,
}: {
  request: PassportPresentationRequest;
  onCompleted: (result: PassportScanConfirmResult) => void;
  onClose: () => void;
}) {
  const [presentation, setPresentation] = useState<{
    presentationId: string;
    token: string;
    expiresAt: string;
  } | null>(null);
  const [completed, setCompleted] = useState<PassportScanConfirmResult | null>(
    null,
  );
  const [now, setNow] = useState(Date.now);
  const [error, setError] = useState("");
  const callbackRef = useRef(onCompleted);

  useEffect(() => {
    callbackRef.current = onCompleted;
  }, [onCompleted]);

  useEffect(() => {
    let canceled = false;
    let busy = false;
    let presentationId = "";
    let token = "";
    let expires = 0;
    let used = false;

    const tick = async () => {
      if (busy || canceled || used) return;
      busy = true;
      try {
        if (presentationId) {
          const statusRes = await readJson<{
            presentation: {
              status: "OPEN" | "USED" | "CANCELLED";
              result?: PassportScanConfirmResult;
            };
          }>(
            await fetch(
              `/api/passport/presentation/${encodeURIComponent(presentationId)}`,
              { cache: "no-store" },
            ),
          );
          if (canceled) return;
          if (
            statusRes.presentation.status === "USED" &&
            statusRes.presentation.result
          ) {
            used = true;
            setCompleted(statusRes.presentation.result);
            callbackRef.current(statusRes.presentation.result);
            return;
          }
        }

        if (Date.now() >= expires) {
          const next = await readJson<{
            presentationId: string;
            token: string;
            expiresAt: string;
          }>(
            await fetch("/api/passport/presentation", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                request.purpose === "REDEEM"
                  ? {
                      purpose: "REDEEM",
                      storeId: request.storeId,
                      menuId: request.menuId,
                    }
                  : { purpose: "STAMP" },
              ),
            }),
          );
          presentationId = next.presentationId;
          token = next.token;
          expires = Date.parse(next.expiresAt);
          if (canceled) {
            void fetch("/api/passport/presentation", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token }),
              keepalive: true,
            }).catch(() => {});
            return;
          }
          setPresentation(next);
        }
        setError("");
      } catch (failure) {
        if (!canceled) {
          setError(
            failure instanceof Error
              ? failure.message
              : "연결을 확인해 주세요.",
          );
        }
      } finally {
        busy = false;
      }
    };

    void tick();
    const poll = window.setInterval(() => void tick(), 2000);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);

    return () => {
      canceled = true;
      window.clearInterval(poll);
      window.clearInterval(clock);
      if (token && !used) {
        void fetch("/api/passport/presentation", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, [request]);

  if (completed) {
    return (
      <section aria-label="여권 처리 완료" className="space-y-5 px-6 py-8">
        <CheckCircle2
          size={40}
          className="text-[var(--success)]"
          aria-hidden="true"
        />
        <h2 className="ds-display-m">
          {completed.purpose === "STAMP"
            ? "스탬프 적립 완료"
            : "음료 교환 완료"}
        </h2>
        <p className="ds-h2">
          {completed.purpose === "STAMP"
            ? `${completed.storeName} · +${completed.points}P`
            : `${completed.storeName} · ${completed.menuName} (-${completed.points.toLocaleString("ko-KR")}P)`}
        </p>
        <p className="ds-body-s text-[var(--fg-muted)]">
          사용 번호:{" "}
          {completed.purpose === "STAMP"
            ? completed.stampId
            : completed.redeemId}
        </p>
        <Button variant="primary" onClick={onClose}>
          여권으로 돌아가기
        </Button>
      </section>
    );
  }

  const remaining = presentation
    ? Math.max(0, Math.ceil((Date.parse(presentation.expiresAt) - now) / 1000))
    : 0;

  return (
    <section
      aria-label="직원에게 보여줄 여권 QR"
      className="space-y-5 px-6 py-8"
    >
      <p className="ds-label text-[var(--fg-muted)]">
        직원이 스캔하면 양쪽 화면에 결과가 표시돼요
      </p>
      <h2 className="ds-display-m">직원에게 보여주세요</h2>
      <p className="ds-h2">
        {request.purpose === "STAMP"
          ? "스탬프 적립 +100P"
          : `${request.storeName} · ${request.menuName} (-${request.points.toLocaleString("ko-KR")}P)`}
      </p>

      <div className="flex min-h-64 items-center justify-center border-y border-[var(--border-strong)] py-6">
        {presentation && remaining > 0 ? (
          <QrCode
            value={passportQrValue(presentation.token)}
            label="직원 스캔용 일회용 여권 QR"
            size={240}
          />
        ) : (
          <p role="status">QR을 준비하고 있어요…</p>
        )}
      </div>

      <p role="status" className="ds-body-s text-[var(--fg-muted)]">
        {remaining > 0
          ? `${remaining}초 후 새 QR로 바뀝니다. 직원 확인 전에는 처리되지 않아요.`
          : "인터넷 연결 후 새 QR을 표시합니다."}
      </p>

      {error ? (
        <p role="alert" className="ds-body text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <Button variant="secondary" onClick={onClose}>
        닫기
      </Button>
    </section>
  );
}
