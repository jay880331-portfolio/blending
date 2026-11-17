"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchAuditLog } from "../../adapters/http/auditLogApi";
import { AsyncState } from "../shared/AsyncState";
import styles from "../content/content.module.css";

export function AuditLogDetailScreen({ id }: { id: string }) {
  const [log, setLog] = useState<Awaited<ReturnType<typeof fetchAuditLog>>>();
  const [error, setError] = useState("");
  useEffect(() => {
    fetchAuditLog(id)
      .then(setLog)
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "조회 실패"),
      );
  }, [id]);

  return (
    <main className={styles.formPage}>
      <AsyncState loading={!log && !error} error={error}>
        {log && (
          <>
            <header className={styles.pageHeader}>
              <div>
                <h1>감사 로그 상세</h1>
                <p>{new Date(log.createdAt).toLocaleString("ko-KR")}</p>
              </div>
            </header>
            <section className={styles.detailSection}>
              <h2>작업 정보</h2>
              <dl className={styles.details}>
                <Item
                  label="관리자"
                  value={`${log.actorName}${log.actorId ? ` (${log.actorId})` : ""}`}
                />
                <Item label="작업" value={log.action} />
                <Item
                  label="리소스"
                  value={
                    <ResourceLink type={log.resourceType} id={log.resourceId} />
                  }
                />
                <Item label="사유" value={log.reason || "-"} />
                <Item
                  label="변경 필드"
                  value={log.changedFields.join(", ") || "-"}
                />
                <Item label="요청 ID" value={log.requestId} />
                <Item label="IP" value={log.ip} />
                <Item label="User-Agent" value={log.userAgent} />
              </dl>
            </section>
          </>
        )}
      </AsyncState>
    </main>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ResourceLink({ type, id }: { type: string; id: string }) {
  const href = resourceHref(type, id);
  return href ? (
    <Link href={href}>
      {type} · {id}
    </Link>
  ) : (
    <>
      {type} · {id}
    </>
  );
}

function resourceHref(type: string, id: string) {
  if (type === "user") return `/users/${encodeURIComponent(id)}`;
  if (type === "report") return `/reports/${encodeURIComponent(id)}`;
  if (type === "event_request")
    return `/content/event-requests/${encodeURIComponent(id)}`;
  if (
    [
      "community_event",
      "community_review",
      "community_b_talk",
      "community_qa",
      "partner_promotion",
      "partner_review",
      "partner_banner",
    ].includes(type)
  )
    return `/content/${type}/${encodeURIComponent(id)}`;
  if (type === "search_index") return "/operations/search-index";
  if (type === "profile_badge")
    return `/settings/profile-badges/${encodeURIComponent(id)}/edit`;
  return null;
}
