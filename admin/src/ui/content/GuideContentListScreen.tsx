"use client";

import type {
  GuideContentDto,
  GuideContentKind,
} from "@blending/admin-contracts";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchGuideContents } from "../../adapters/http/guideContentApi";
import { AsyncState } from "../shared/AsyncState";
import { DataTable, type DataColumn } from "../shared/DataTable";
import { ListFilterForm } from "../shared/ListFilterForm";
import { Pagination } from "../shared/Pagination";
import { StatusBadge } from "../shared/StatusBadge";
import styles from "./content.module.css";

export const GUIDE_CONTENT_LABELS: Record<GuideContentKind, string> = {
  notice: "공지",
  faq: "FAQ",
  policy: "운영 정책",
};

const routes: Record<GuideContentKind, string> = {
  notice: "notices",
  faq: "faqs",
  policy: "policies",
};

export function guideContentRoute(kind: GuideContentKind, suffix = "") {
  return `/content/${routes[kind]}${suffix}`;
}

export function GuideContentListScreen({ kind }: { kind: GuideContentKind }) {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.toString();
  const [data, setData] =
    useState<Awaited<ReturnType<typeof fetchGuideContents>>>();
  const [error, setError] = useState("");

  useEffect(() => {
    fetchGuideContents(kind, query)
      .then((next) => {
        setData(next);
        setError("");
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "조회 실패"),
      );
  }, [kind, query]);

  const columns: DataColumn<GuideContentDto>[] = [
    {
      key: "title",
      label: "제목",
      render: (item) => (
        <Link href={guideContentRoute(kind, `/${item.id}`)}>
          {guideContentTitle(item)}
        </Link>
      ),
    },
    {
      key: "status",
      label: "발행 상태",
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: "publishedAt",
      label: "발행 시각",
      render: (item) => formatDate(item.publishedAt),
    },
    {
      key: "deletedAt",
      label: "삭제",
      render: (item) => (item.deletedAt ? "삭제됨" : "정상"),
    },
    {
      key: "updatedAt",
      label: "수정일",
      render: (item) => formatDate(item.updatedAt),
    },
  ];

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>{GUIDE_CONTENT_LABELS[kind]} 관리</h1>
          <p>발행 상태와 삭제 여부를 관리합니다.</p>
        </div>
        <Link
          className={styles.primaryAction}
          href={guideContentRoute(kind, "/new")}
        >
          새 {GUIDE_CONTENT_LABELS[kind]}
        </Link>
      </header>
      <GuideContentNav kind={kind} />
      <ListFilterForm
        onSubmit={(event) => {
          event.preventDefault();
          const next = new URLSearchParams(
            new FormData(event.currentTarget) as never,
          );
          next.set("page", "1");
          router.push(`${guideContentRoute(kind)}?${next}`);
        }}
      >
        <input
          name="q"
          aria-label="검색어"
          placeholder="제목 또는 본문 검색"
          defaultValue={params.get("q") ?? ""}
        />
        <select
          name="status"
          aria-label="발행 상태"
          defaultValue={params.get("status") ?? ""}
        >
          <option value="">전체 상태</option>
          <option value="draft">초안</option>
          <option value="published">발행</option>
        </select>
        <select
          name="deleted"
          aria-label="삭제 상태"
          defaultValue={params.get("deleted") ?? "false"}
        >
          <option value="false">정상</option>
          <option value="true">삭제됨</option>
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
              caption={`${GUIDE_CONTENT_LABELS[kind]} 목록`}
              rows={data.items}
              columns={columns}
            />
            {data.items.length === 0 && (
              <p className={styles.empty}>조건에 맞는 콘텐츠가 없습니다.</p>
            )}
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

export function GuideContentNav({ kind }: { kind: GuideContentKind }) {
  return (
    <nav className={styles.kindNav} aria-label="가이드 콘텐츠 종류">
      <Link href="/content/community_event">서비스 콘텐츠</Link>
      {(Object.keys(GUIDE_CONTENT_LABELS) as GuideContentKind[]).map(
        (value) => (
          <Link
            key={value}
            aria-current={value === kind ? "page" : undefined}
            href={guideContentRoute(value)}
          >
            {GUIDE_CONTENT_LABELS[value]}
          </Link>
        ),
      )}
    </nav>
  );
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString("ko-KR") : "-";
}

function guideContentTitle(item: GuideContentDto) {
  return "question" in item.data ? item.data.question : item.data.title;
}
