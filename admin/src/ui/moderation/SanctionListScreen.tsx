"use client";
import type { AdminSanctionDto } from "@blending/admin-contracts";
import { useEffect, useState } from "react";
import {
  fetchSanctions,
  revokeSanction,
} from "../../adapters/http/moderationApi";
import { AsyncState } from "../shared/AsyncState";
import { DataTable, type DataColumn } from "../shared/DataTable";
import styles from "../content/content.module.css";
export function SanctionListScreen() {
  const [data, setData] =
      useState<Awaited<ReturnType<typeof fetchSanctions>>>(),
    [error, setError] = useState("");
  const load = () =>
    fetchSanctions("")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "조회 실패"));
  useEffect(() => {
    void load();
  }, []);
  const columns: DataColumn<AdminSanctionDto>[] = [
    { key: "userId", label: "사용자" },
    { key: "type", label: "유형" },
    { key: "reason", label: "사유" },
    {
      key: "createdAt",
      label: "적용일",
      render: (r) => new Date(r.createdAt).toLocaleString("ko-KR"),
    },
    {
      key: "action",
      label: "관리",
      render: (r) =>
        r.revokedAt ? (
          "해제됨"
        ) : (
          <button
            onClick={() => {
              const reason = prompt("해제 사유");
              if (reason) void revokeSanction(r.id, reason).then(load);
            }}
          >
            해제
          </button>
        ),
    },
  ];
  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>사용자 제재</h1>
          <p>제재 이력을 조회하고 활성 제재를 해제합니다.</p>
        </div>
      </header>
      <AsyncState loading={!data && !error} error={error}>
        {data && (
          <DataTable caption="제재 목록" rows={data.items} columns={columns} />
        )}
      </AsyncState>
    </main>
  );
}
