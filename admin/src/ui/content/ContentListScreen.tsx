"use client";

import type {
  AdminContentDto,
  AdminContentKind,
} from "@blending/admin-contracts";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fetchContents } from "../../adapters/http/contentApi";
import { AsyncState } from "../shared/AsyncState";
import { DataTable, type DataColumn } from "../shared/DataTable";
import { ListFilterForm } from "../shared/ListFilterForm";
import { Pagination } from "../shared/Pagination";
import { StatusBadge } from "../shared/StatusBadge";
import { CONTENT_KIND_LABELS } from "./contentForm";
import styles from "./content.module.css";

export function ContentListScreen({ kind }: { kind: AdminContentKind }) {
  const params = useSearchParams();
  const router = useRouter();
  const query = useMemo(() => {
    const next = new URLSearchParams(params.toString());
    next.set("kind", kind);
    return next.toString();
  }, [kind, params]);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchContents>>>();
  const [error, setError] = useState("");

  useEffect(() => {
    fetchContents(query)
      .then((next) => {
        setData(next);
        setError("");
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "조회 실패"),
      );
  }, [query]);

  const pushQuery = (next: URLSearchParams) =>
    router.push(`/content/${kind}?${next}`);
  const submit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    const next = new URLSearchParams(
      new FormData(event.currentTarget) as never,
    );
    next.delete("kind");
    next.set("page", "1");
    pushQuery(next);
  };
  const sort = (field: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("sort", field);
    next.set(
      "direction",
      params.get("sort") === field && params.get("direction") === "desc"
        ? "asc"
        : "desc",
    );
    next.set("page", "1");
    pushQuery(next);
  };

  const columns: DataColumn<AdminContentDto>[] = [
    {
      key: "title",
      label: "제목",
      sortable: true,
      render: (content) => (
        <Link href={`/content/${kind}/${content.id}`}>{content.title}</Link>
      ),
    },
    {
      key: "state",
      label: "상태",
      render: (content) => <StatusBadge status={content.state} />,
    },
    {
      key: "searchVisible",
      label: "검색",
      render: (content) => (content.searchVisible ? "노출" : "제외"),
    },
    { key: "views", label: "조회", sortable: true },
    { key: "likes", label: "반응", sortable: true },
    {
      key: "updatedAt",
      label: "수정일",
      sortable: true,
      render: (content) => formatDate(content.updatedAt ?? content.createdAt),
    },
  ];

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>{CONTENT_KIND_LABELS[kind]} 관리</h1>
          <p>검색 노출과 운영 상태를 함께 관리합니다.</p>
        </div>
        <Link className={styles.primaryAction} href={`/content/${kind}/new`}>
          새 콘텐츠
        </Link>
      </header>
      <nav className={styles.kindNav} aria-label="콘텐츠 종류">
        {Object.entries(CONTENT_KIND_LABELS).map(([value, label]) => (
          <Link
            key={value}
            aria-current={value === kind ? "page" : undefined}
            href={`/content/${value}`}
          >
            {label}
          </Link>
        ))}
        <Link href="/content/event-requests">이벤트 요청</Link>
        <Link href="/content/notices">공지</Link>
        <Link href="/content/faqs">FAQ</Link>
        <Link href="/content/policies">운영 정책</Link>
      </nav>
      <ListFilterForm onSubmit={submit}>
        <input
          name="q"
          aria-label="검색어"
          placeholder="제목 검색"
          defaultValue={params.get("q") ?? ""}
        />
        <select
          name="state"
          aria-label="운영 상태"
          defaultValue={params.get("state") ?? ""}
        >
          <option value="">전체 상태</option>
          <option value="active">활성</option>
          <option value="hidden">숨김</option>
          <option value="deleted">삭제</option>
        </select>
        <input
          name="authorId"
          aria-label="작성자 ID"
          placeholder="작성자 ID"
          defaultValue={params.get("authorId") ?? ""}
        />
        <input
          type="date"
          name="from"
          aria-label="시작일"
          defaultValue={params.get("from") ?? ""}
        />
        <input
          type="date"
          name="to"
          aria-label="종료일"
          defaultValue={params.get("to") ?? ""}
        />
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
              caption={`${CONTENT_KIND_LABELS[kind]} 목록`}
              rows={data.items}
              columns={columns}
              sort={params.get("sort") ?? undefined}
              onSort={sort}
            />
            <Pagination
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              query={params.toString()}
            />
          </>
        ) : null}
      </AsyncState>
    </main>
  );
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString("ko-KR") : "-";
}
