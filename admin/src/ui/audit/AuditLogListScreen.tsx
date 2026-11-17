"use client";
import type { AdminAuditLogDto } from "@blending/admin-contracts";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchAuditLogs } from "../../adapters/http/auditLogApi";
import { AsyncState } from "../shared/AsyncState";
import { DataTable, type DataColumn } from "../shared/DataTable";
import { ListFilterForm } from "../shared/ListFilterForm";
import { Pagination } from "../shared/Pagination";
import styles from "../content/content.module.css";

export function AuditLogListScreen() {
  const params = useSearchParams();
  const query = params.toString();
  const [data, setData] =
    useState<Awaited<ReturnType<typeof fetchAuditLogs>>>();
  const [error, setError] = useState("");
  useEffect(() => {
    fetchAuditLogs(query)
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "조회 실패"),
      );
  }, [query]);

  const columns: DataColumn<AdminAuditLogDto>[] = [
    {
      key: "createdAt",
      label: "일시",
      render: (row) => (
        <Link href={`/audit-logs/${row.id}`}>
          {new Date(row.createdAt).toLocaleString("ko-KR")}
        </Link>
      ),
    },
    { key: "actorName", label: "관리자" },
    { key: "action", label: "작업" },
    {
      key: "resourceId",
      label: "리소스",
      render: (row) => `${row.resourceType} · ${row.resourceId}`,
    },
    { key: "reason", label: "사유" },
  ];

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>감사 로그</h1>
          <p>
            관리자 작업 이력을 조회합니다. 로그는 수정하거나 삭제할 수 없습니다.
          </p>
        </div>
      </header>
      <ListFilterForm>
        <input
          aria-label="관리자 ID"
          defaultValue={params.get("actorId") ?? ""}
          name="actorId"
          placeholder="관리자 ID"
        />
        <input
          aria-label="작업"
          defaultValue={params.get("action") ?? ""}
          name="action"
          placeholder="예: user.update"
        />
        <input
          aria-label="리소스 유형"
          defaultValue={params.get("resourceType") ?? ""}
          name="resourceType"
          placeholder="리소스 유형"
        />
        <input
          aria-label="리소스 ID"
          defaultValue={params.get("resourceId") ?? ""}
          name="resourceId"
          placeholder="리소스 ID"
        />
        <input
          aria-label="시작일"
          defaultValue={params.get("from") ?? ""}
          name="from"
          type="date"
        />
        <input
          aria-label="종료일"
          defaultValue={params.get("to") ?? ""}
          name="to"
          type="date"
        />
        <select
          aria-label="페이지 크기"
          defaultValue={params.get("pageSize") ?? "20"}
          name="pageSize"
        >
          <option value="20">20개</option>
          <option value="50">50개</option>
          <option value="100">100개</option>
        </select>
      </ListFilterForm>
      <AsyncState loading={!data && !error} error={error}>
        {data && (
          <>
            <DataTable
              caption="감사 로그 목록"
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
