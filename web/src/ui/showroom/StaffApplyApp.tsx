"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import type { BaristaShowroom } from "@/domain/showroom/types";

type MyStaffRequest = {
  id: string;
  storeId: string;
  storeName?: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  createdAt: string;
};

const STATUS_LABEL: Record<MyStaffRequest["status"], string> = {
  PENDING: "승인 대기",
  APPROVED: "승인됨",
  REJECTED: "거절됨",
  CANCELLED: "취소됨",
};

export function StaffApplyApp() {
  const [stores, setStores] = useState<BaristaShowroom[]>([]);
  const [requests, setRequests] = useState<MyStaffRequest[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [showroomRes, reqRes] = await Promise.all([
      fetch("/api/showroom?sort=latest", { cache: "no-store" }),
      fetch("/api/showroom/staff-requests?scope=my", { cache: "no-store" }),
    ]);
    const showroomData = (await showroomRes.json().catch(() => null)) as {
      showrooms?: BaristaShowroom[];
    } | null;
    const reqData = (await reqRes.json().catch(() => null)) as {
      requests?: MyStaffRequest[];
    } | null;
    setStores(showroomData?.showrooms ?? []);
    setRequests(reqData?.requests ?? []);
  };

  useEffect(() => {
    let canceled = false;
    void Promise.all([
      fetch("/api/showroom?sort=latest", { cache: "no-store" }),
      fetch("/api/showroom/staff-requests?scope=my", { cache: "no-store" }),
    ])
      .then(async ([showroomRes, reqRes]) => {
        const showroomData = (await showroomRes.json().catch(() => null)) as {
          showrooms?: BaristaShowroom[];
        } | null;
        const reqData = (await reqRes.json().catch(() => null)) as {
          requests?: MyStaffRequest[];
        } | null;
        if (canceled) return;
        setStores(showroomData?.showrooms ?? []);
        setRequests(reqData?.requests ?? []);
      })
      .catch(() => {
        if (!canceled) setError("매장 목록을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, []);

  const filteredStores = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stores.slice(0, 20);
    return stores
      .filter(
        (s) =>
          s.storeName.toLowerCase().includes(q) ||
          (s.baristaName ?? "").toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [stores, query]);

  const handleApply = async (storeId: string) => {
    if (busyId) return;
    setBusyId(storeId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/showroom/staff-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(data?.error || "직원 신청에 실패했습니다.");
      }
      setMessage("매장 소유자에게 직원 가입 신청을 보냈습니다.");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "직원 신청에 실패했습니다.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    if (busyId) return;
    setBusyId(requestId);
    setError(null);
    try {
      const res = await fetch(
        `/api/showroom/staff-requests/${encodeURIComponent(requestId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cancel" }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || "신청 취소에 실패했습니다.");
      }
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "신청 취소에 실패했습니다.",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24 text-[var(--fg)]">
      <header className="flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4">
        <Link
          href="/mypage"
          aria-label="마이페이지로 돌아가기"
          className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--fg)]"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-[16px] font-bold text-[var(--fg-strong)]">
          매장 직원 신청
        </h1>
        <span className="w-10" />
      </header>

      <main className="space-y-6 px-5 py-5">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[var(--fg-subtle)]"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="매장명 또는 바리스타명 검색"
            className="w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] py-2.5 pr-3 pl-9 text-[14px] outline-none focus:border-[var(--accent)]"
          />
        </div>

        {error ? (
          <p
            role="alert"
            className="text-[13px] font-bold text-[var(--danger)]"
          >
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-[13px] font-bold text-[var(--success)]">
            {message}
          </p>
        ) : null}

        <section>
          <h2 className="mb-2.5 text-[14px] font-bold text-[var(--fg-strong)]">
            매장 목록
          </h2>
          {loading ? (
            <p className="text-[13px] text-[var(--fg-muted)]">불러오는 중...</p>
          ) : filteredStores.length === 0 ? (
            <p className="text-[13px] text-[var(--fg-muted)]">
              검색된 매장이 없습니다.
            </p>
          ) : (
            <div className="space-y-2">
              {filteredStores.map((store) => {
                const pending = requests.some(
                  (r) => r.storeId === store.id && r.status === "PENDING",
                );
                return (
                  <div
                    key={store.id}
                    className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-bold text-[var(--fg-strong)]">
                        {store.storeName}
                      </p>
                      {store.baristaName ? (
                        <p className="truncate text-[12px] text-[var(--fg-muted)]">
                          {store.baristaName}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={pending || busyId === store.id}
                      onClick={() => void handleApply(store.id)}
                      className="shrink-0 rounded-[var(--radius-md)] bg-[var(--fg)] px-3 py-1.5 text-[12px] font-bold text-[var(--surface)] disabled:opacity-50"
                    >
                      {pending ? "신청 중" : "직원 신청"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {requests.length > 0 ? (
          <section>
            <h2 className="mb-2.5 text-[14px] font-bold text-[var(--fg-strong)]">
              내 신청 내역
            </h2>
            <div className="space-y-2">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-[var(--fg-strong)]">
                      {req.storeName || "매장"}
                    </p>
                    <p className="text-[11px] text-[var(--fg-muted)]">
                      {STATUS_LABEL[req.status]} ·{" "}
                      {new Date(req.createdAt).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                  {req.status === "PENDING" ? (
                    <button
                      type="button"
                      disabled={busyId === req.id}
                      onClick={() => void handleCancel(req.id)}
                      className="shrink-0 rounded-[var(--radius-md)] border border-[var(--border-strong)] px-2.5 py-1 text-[12px] text-[var(--fg-muted)]"
                    >
                      취소
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
