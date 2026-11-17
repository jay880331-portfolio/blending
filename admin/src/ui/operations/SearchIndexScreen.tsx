"use client";
import type { SearchIndexHealthDto } from "@blending/admin-contracts";
import { useCallback, useEffect, useState } from "react";
import {
  fetchSearchIndexHealth,
  reconcileSearchIndex,
} from "../../adapters/http/searchIndexApi";
import { adminContentTypeLabel } from "../../domain/displayLabels";
import { startSearchIndexPolling } from "../../domain/searchIndexPolling";
import { AsyncState } from "../shared/AsyncState";
import { DataTable, type DataColumn } from "../shared/DataTable";
import { StatusBadge } from "../shared/StatusBadge";
import styles from "../content/content.module.css";

type HealthRow = SearchIndexHealthDto["byType"][number];

export function SearchIndexScreen() {
  const [health, setHealth] = useState<SearchIndexHealthDto>();
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const load = useCallback(async () => {
    try {
      const next = await fetchSearchIndexHealth();
      setHealth(next);
      setError("");
      return next;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "조회 실패");
      return undefined;
    }
  }, []);
  useEffect(() => {
    let active = true;
    void fetchSearchIndexHealth()
      .then((next) => {
        if (!active) return;
        setHealth(next);
        setError("");
      })
      .catch((cause) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "조회 실패");
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (health?.latestRun?.status !== "running") return;
    return startSearchIndexPolling(async () => {
      const next = await load();
      return next ? next.latestRun?.status === "running" : undefined;
    });
  }, [health?.latestRun?.status, load]);

  async function reconcile() {
    setRunning(true);
    setError("");
    try {
      await reconcileSearchIndex();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "작업 실패");
    } finally {
      setRunning(false);
    }
  }

  const columns: DataColumn<HealthRow>[] = [
    {
      key: "type",
      label: "문서 유형",
      render: (row) => adminContentTypeLabel(row.type),
    },
    { key: "sourceCount", label: "원본" },
    { key: "indexedCount", label: "인덱스" },
    { key: "missingCount", label: "누락" },
    { key: "orphanCount", label: "고아" },
  ];

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>검색 인덱스</h1>
          <p>공개 원본과 검색 문서의 정합성을 확인합니다.</p>
        </div>
        <button
          className={styles.primaryAction}
          disabled={running || health?.latestRun?.status === "running"}
          onClick={() => void reconcile()}
          type="button"
        >
          {running ? "실행 중…" : "정합성 복구"}
        </button>
      </header>
      <AsyncState loading={!health && !error} error={error}>
        {health && (
          <>
            <DataTable
              caption="검색 인덱스 상태"
              rows={health.byType}
              columns={columns}
            />
            <section className={styles.detailSection}>
              <h2>최근 실행</h2>
              {health.latestRun ? (
                <dl className={styles.details}>
                  <div>
                    <dt>상태</dt>
                    <dd>
                      <StatusBadge status={health.latestRun.status} />
                    </dd>
                  </div>
                  <div>
                    <dt>실행 주체</dt>
                    <dd>{health.latestRun.trigger}</dd>
                  </div>
                  <div>
                    <dt>인덱싱 / 삭제</dt>
                    <dd>
                      {health.latestRun.indexedCount} /{" "}
                      {health.latestRun.deletedCount}
                    </dd>
                  </div>
                  <div>
                    <dt>소요 시간</dt>
                    <dd>{health.latestRun.durationMs.toLocaleString()}ms</dd>
                  </div>
                </dl>
              ) : (
                <p className={styles.empty}>실행 이력이 없습니다.</p>
              )}
            </section>
          </>
        )}
      </AsyncState>
    </main>
  );
}
