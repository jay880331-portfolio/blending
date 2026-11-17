"use client";

import { useEffect, useMemo, useState } from "react";
import { ShoppingBag } from "lucide-react";
import {
  BEAN_GRIND_LABELS,
  type BeanReservation,
  type ReservationStatus,
} from "@/domain/showroom/bean";
import {
  fetchStoreReservationsApi,
  transitionBeanReservationApi,
} from "@/adapters/http/beanApi";
import { TextTabBar } from "@/ui/shared/TextTabBar";

const STATUS_LABELS: Record<ReservationStatus, string> = {
  REQUESTED: "요청",
  CONFIRMED: "확정",
  REJECTED: "거절",
  PICKED_UP: "픽업 완료",
  CANCELLED: "취소",
};

export function ReservationInboxPanel({ storeId }: { storeId: string }) {
  const [reservations, setReservations] = useState<BeanReservation[]>([]);
  const [tab, setTab] = useState<"all" | "REQUESTED" | "CONFIRMED" | "DONE">(
    "all",
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStoreReservationsApi(storeId)
      .then((list) => {
        if (!cancelled) setReservations(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const filtered = useMemo(() => {
    if (tab === "all") return reservations;
    if (tab === "DONE") {
      return reservations.filter((r) =>
        ["REJECTED", "PICKED_UP", "CANCELLED"].includes(r.status),
      );
    }
    return reservations.filter((r) => r.status === tab);
  }, [reservations, tab]);

  const handleTransition = async (
    reservationId: string,
    nextStatus: ReservationStatus,
  ) => {
    if (busyId) return;
    let rejectReason: string | undefined;
    if (nextStatus === "REJECTED") {
      rejectReason = window.prompt("거절 사유 (선택)") ?? undefined;
    }
    setBusyId(reservationId);
    try {
      const updated = await transitionBeanReservationApi(
        reservationId,
        nextStatus,
        rejectReason,
      );
      setReservations((prev) =>
        prev.map((item) =>
          item.id === reservationId ? { ...item, ...updated } : item,
        ),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "상태 변경에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section id="reservations" className="mt-8 px-5">
      <h3 className="mb-2 flex items-center gap-1.5 text-[16px] font-bold text-[var(--fg-strong)]">
        <ShoppingBag size={18} />
        원두·드립백 예약함
      </h3>

      <div className="-mx-5 border-b border-[var(--border)] bg-[var(--surface)]">
        <TextTabBar
          ariaLabel="예약 상태 필터"
          items={[
            { value: "all", label: "전체", count: reservations.length },
            {
              value: "REQUESTED",
              label: "요청",
              count: reservations.filter((r) => r.status === "REQUESTED")
                .length,
            },
            {
              value: "CONFIRMED",
              label: "확정",
              count: reservations.filter((r) => r.status === "CONFIRMED")
                .length,
            },
            { value: "DONE", label: "완료·취소" },
          ]}
          activeValue={tab}
          onChange={(value) =>
            setTab(value as "all" | "REQUESTED" | "CONFIRMED" | "DONE")
          }
        />
      </div>

      <div className="mt-3 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-[13px] text-[var(--fg-muted)]">
            해당 상태의 예약이 없습니다.
          </div>
        ) : (
          filtered.map((resv) => (
            <div
              key={resv.id}
              className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-[var(--fg-strong)]">
                    {resv.beanSnapshot.name} · {resv.quantity}개
                  </p>
                  <p className="mt-0.5 text-[12px] text-[var(--fg-muted)]">
                    {resv.customerName || "회원"} · 픽업 {resv.pickupDate}
                    {resv.grind ? ` · ${BEAN_GRIND_LABELS[resv.grind]}` : ""}
                  </p>
                  {resv.note ? (
                    <p className="mt-1 text-[12px] text-[var(--fg)]">
                      메모: {resv.note}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 rounded-[var(--radius-sm)] bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-bold text-[var(--fg-strong)]">
                  {STATUS_LABELS[resv.status]}
                </span>
              </div>

              {resv.status === "REQUESTED" ? (
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={busyId === resv.id}
                    onClick={() => void handleTransition(resv.id, "REJECTED")}
                    className="rounded-[var(--radius-md)] border border-[var(--border-strong)] px-3 py-1.5 text-[12px] font-bold text-[var(--danger)]"
                  >
                    거절
                  </button>
                  <button
                    type="button"
                    disabled={busyId === resv.id}
                    onClick={() => void handleTransition(resv.id, "CONFIRMED")}
                    className="rounded-[var(--radius-md)] bg-[var(--fg)] px-3 py-1.5 text-[12px] font-bold text-[var(--surface)]"
                  >
                    예약 확정
                  </button>
                </div>
              ) : resv.status === "CONFIRMED" ? (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    disabled={busyId === resv.id}
                    onClick={() => void handleTransition(resv.id, "PICKED_UP")}
                    className="rounded-[var(--radius-md)] bg-[var(--fg)] px-3 py-1.5 text-[12px] font-bold text-[var(--surface)]"
                  >
                    픽업 완료
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
