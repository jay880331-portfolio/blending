"use client";

import type {
  AdminBusinessVerificationItem,
  AdminBusinessVerificationStatus,
} from "@blending/admin-contracts";
import { useCallback, useEffect, useState } from "react";
import {
  decideBusinessVerification,
  fetchBusinessVerifications,
} from "../../adapters/http/businessVerificationApi";
import { AsyncState } from "../shared/AsyncState";
import { DataTable, type DataColumn } from "../shared/DataTable";
import { StatusBadge } from "../shared/StatusBadge";
import styles from "../content/content.module.css";

function formatNumber(digits: string): string {
  if (/^\d{10}$/.test(digits)) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }
  return digits;
}

const STATUS_TABS: Array<{
  value: AdminBusinessVerificationStatus | "ALL";
  label: string;
}> = [
  { value: "PENDING", label: "심사 대기" },
  { value: "VERIFIED", label: "인증 완료" },
  { value: "REJECTED", label: "반려" },
  { value: "ALL", label: "전체" },
];

export function BusinessVerificationsScreen() {
  const [statusFilter, setStatusFilter] = useState<
    AdminBusinessVerificationStatus | "ALL"
  >("PENDING");
  const [items, setItems] = useState<AdminBusinessVerificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyStoreId, setBusyStoreId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] =
    useState<AdminBusinessVerificationItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await fetchBusinessVerifications(
        statusFilter === "ALL" ? undefined : statusFilter,
      );
      setItems(data.items);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    let active = true;
    void fetchBusinessVerifications(
      statusFilter === "ALL" ? undefined : statusFilter,
    )
      .then((data) => {
        if (!active) return;
        setItems(data.items);
        setError("");
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "목록 조회 실패");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [statusFilter]);

  const handleApprove = async (item: AdminBusinessVerificationItem) => {
    if (busyStoreId) return;
    setBusyStoreId(item.storeId);
    try {
      await decideBusinessVerification(item.storeId, {
        decision: "approve",
        number: item.businessNumber,
        submittedAt: item.submittedAt,
      });
      await load();
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "승인 처리 실패");
    } finally {
      setBusyStoreId(null);
    }
  };

  const handleReject = async (item: AdminBusinessVerificationItem) => {
    if (busyStoreId) return;
    const trimmed = rejectReason.trim();
    if (!trimmed) {
      alert("반려 사유를 입력해주세요.");
      return;
    }
    setBusyStoreId(item.storeId);
    try {
      await decideBusinessVerification(item.storeId, {
        decision: "reject",
        reason: trimmed,
        number: item.businessNumber,
        submittedAt: item.submittedAt,
      });
      setRejectTarget(null);
      setRejectReason("");
      await load();
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "반려 처리 실패");
    } finally {
      setBusyStoreId(null);
    }
  };

  const columns: DataColumn<AdminBusinessVerificationItem>[] = [
    { key: "storeName", label: "매장명", render: (r) => r.storeName },
    { key: "ownerName", label: "대표자", render: (r) => r.ownerName },
    {
      key: "businessNumber",
      label: "사업자번호",
      render: (r) => formatNumber(r.businessNumber),
    },
    {
      key: "status",
      label: "상태",
      render: (r) => (
        <StatusBadge
          status={
            r.status === "VERIFIED"
              ? "ACTIVE"
              : r.status === "REJECTED"
                ? "HIDDEN"
                : "PENDING"
          }
        />
      ),
    },
    {
      key: "submittedAt",
      label: "신청일",
      render: (r) => new Date(r.submittedAt).toLocaleString("ko-KR"),
    },
    {
      key: "rejectReason",
      label: "비고",
      render: (r) => r.rejectReason || "-",
    },
    {
      key: "actions",
      label: "처리",
      render: (r) => (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busyStoreId === r.storeId || r.status !== "PENDING"}
            onClick={() => void handleApprove(r)}
            className={styles.actionButton}
          >
            승인
          </button>
          <button
            type="button"
            disabled={busyStoreId === r.storeId || r.status !== "PENDING"}
            onClick={() => {
              setRejectTarget(r);
              setRejectReason(r.rejectReason ?? "");
            }}
            className={styles.secondaryButton}
          >
            반려
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.section}>
      <div className={styles.toolbar}>
        <h2 className={styles.heading}>매장 사업자 인증</h2>
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={
                statusFilter === tab.value
                  ? styles.actionButton
                  : styles.secondaryButton
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {rejectTarget ? (
        <div className="mb-4 rounded border border-[var(--border-strong)] bg-[var(--surface)] p-4">
          <p className="mb-2 text-sm font-semibold">
            반려 사유 입력 (최대 100자)
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={100}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="예: 사업자등록번호 확인 불가"
              className="flex-1 rounded border border-[var(--border-strong)] px-3 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => void handleReject(rejectTarget)}
              className={styles.actionButton}
            >
              반려 확정
            </button>
            <button
              type="button"
              onClick={() => {
                setRejectTarget(null);
                setRejectReason("");
              }}
              className={styles.secondaryButton}
            >
              취소
            </button>
          </div>
        </div>
      ) : null}

      <AsyncState loading={loading && items.length === 0} error={error}>
        {!loading && items.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--fg-muted)]">
            해당 상태의 사업자 인증 내역이 없습니다.
          </p>
        ) : (
          <DataTable columns={columns} rows={items} />
        )}
      </AsyncState>
    </div>
  );
}
