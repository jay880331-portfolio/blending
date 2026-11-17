"use client";
import type { AdminReportDto } from "@blending/admin-contracts";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchReports } from "../../adapters/http/moderationApi";
import { AsyncState } from "../shared/AsyncState";
import { DataTable, type DataColumn } from "../shared/DataTable";
import { Pagination } from "../shared/Pagination";
import { StatusBadge } from "../shared/StatusBadge";
import styles from "../content/content.module.css";
export function ReportListScreen() {
  const params = useSearchParams(),
    query = params.toString();
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchReports>>>(),
    [error, setError] = useState("");
  useEffect(() => {
    fetchReports(query)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "조회 실패"));
  }, [query]);
  const columns: DataColumn<AdminReportDto>[] = [
    {
      key: "targetId",
      label: "대상",
      render: (row) => (
        <Link href={`/reports/${row.id}`}>
          {row.targetType} · {row.targetId}
        </Link>
      ),
    },
    { key: "reason", label: "사유" },
    { key: "reporterId", label: "신고자" },
    {
      key: "status",
      label: "상태",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "createdAt",
      label: "접수일",
      render: (row) => new Date(row.createdAt).toLocaleString("ko-KR"),
    },
    {
      key: "actionDueAt",
      label: "24시간 조치",
      render: (row) =>
        row.actionDueAt
          ? row.actionOverdue
            ? "지연"
            : `기한 ${new Date(row.actionDueAt).toLocaleString("ko-KR")}`
          : "-",
    },
  ];
  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>신고 관리</h1>
          <p>접수된 신고를 검토하고 조치합니다.</p>
        </div>
        <Link href="/sanctions">제재 이력</Link>
      </header>
      <AsyncState loading={!data && !error} error={error}>
        {data && (
          <>
            <DataTable
              caption="신고 목록"
              rows={data.items}
              columns={columns}
            />
            <Pagination
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              query={query}
            />
          </>
        )}
      </AsyncState>
    </main>
  );
}
