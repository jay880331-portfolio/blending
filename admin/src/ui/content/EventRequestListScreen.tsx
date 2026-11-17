"use client";

import type { AdminEventRequestDto } from "@blending/admin-contracts";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchEventRequests } from "../../adapters/http/eventRequestsApi";
import { AsyncState } from "../shared/AsyncState";
import { DataTable, type DataColumn } from "../shared/DataTable";
import { ListFilterForm } from "../shared/ListFilterForm";
import { Pagination } from "../shared/Pagination";
import { StatusBadge } from "../shared/StatusBadge";
import styles from "./content.module.css";

export function EventRequestListScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const [data, setData] =
    useState<Awaited<ReturnType<typeof fetchEventRequests>>>();
  const [error, setError] = useState("");
  const query = params.toString();
  useEffect(() => {
    fetchEventRequests(query)
      .then((value) => {
        setData(value);
        setError("");
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "조회 실패"),
      );
  }, [query]);
  const columns: DataColumn<AdminEventRequestDto>[] = [
    {
      key: "title",
      label: "제목",
      render: (row) => (
        <Link href={`/content/event-requests/${row.id}`}>{row.title}</Link>
      ),
    },
    { key: "requesterId", label: "요청자" },
    {
      key: "status",
      label: "상태",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "createdAt",
      label: "요청일",
      render: (row) => new Date(row.createdAt).toLocaleString("ko-KR"),
    },
  ];
  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>이벤트 요청</h1>
          <p>사용자 요청을 검토해 행사로 게시하거나 반려합니다.</p>
        </div>
      </header>
      <ListFilterForm
        onSubmit={(event) => {
          event.preventDefault();
          const next = new URLSearchParams(
            new FormData(event.currentTarget) as never,
          );
          next.set("page", "1");
          router.push(`/content/event-requests?${next}`);
        }}
      >
        <input
          name="q"
          aria-label="검색어"
          placeholder="제목·내용·요청자"
          defaultValue={params.get("q") ?? ""}
        />
        <select
          name="status"
          aria-label="상태"
          defaultValue={params.get("status") ?? ""}
        >
          <option value="">전체 상태</option>
          <option value="pending">대기</option>
          <option value="approved">승인</option>
          <option value="rejected">반려</option>
        </select>
        <input
          type="hidden"
          name="pageSize"
          value={params.get("pageSize") ?? "20"}
        />
      </ListFilterForm>
      <AsyncState loading={!data && !error} error={error}>
        {data ? (
          <>
            <DataTable
              caption="이벤트 요청 목록"
              rows={data.items}
              columns={columns}
            />
            <Pagination
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              query={query}
            />
          </>
        ) : null}
      </AsyncState>
    </main>
  );
}
