"use client";
import type {
  ResolveReportInput,
  SanctionType,
} from "@blending/admin-contracts";
import { useEffect, useState } from "react";
import { decideReport, fetchReport } from "../../adapters/http/moderationApi";
import { AsyncState } from "../shared/AsyncState";
import { StatusBadge } from "../shared/StatusBadge";
import styles from "../content/content.module.css";
export function ReportDetailScreen({ id }: { id: string }) {
  const [report, setReport] =
      useState<Awaited<ReturnType<typeof fetchReport>>>(),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    fetchReport(id)
      .then(setReport)
      .catch((e) => setError(e instanceof Error ? e.message : "조회 실패"));
  }, [id]);
  async function submit(form: FormData) {
    const sanction = String(form.get("sanction") || "");
    const input: ResolveReportInput = {
      status: String(form.get("status")) as ResolveReportInput["status"],
      resolution: String(form.get("resolution") || ""),
      contentAction: String(
        form.get("contentAction"),
      ) as ResolveReportInput["contentAction"],
      ...(sanction
        ? {
            sanction: {
              type: sanction as SanctionType,
              reason: String(form.get("sanctionReason") || ""),
              ...(form.get("endsAt")
                ? { endsAt: String(form.get("endsAt")) }
                : {}),
            },
          }
        : {}),
    };
    setSaving(true);
    try {
      setReport(await decideReport(id, input));
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리 실패");
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className={styles.formPage}>
      <AsyncState loading={!report && !error} error={error}>
        {report && (
          <>
            <header className={styles.pageHeader}>
              <div>
                <h1>신고 상세</h1>
                <p>
                  {report.targetType} · {report.targetId}
                </p>
              </div>
              <StatusBadge status={report.status} />
            </header>
            <section className={styles.detailSection}>
              <h2>접수 내용</h2>
              <dl className={styles.details}>
                <div>
                  <dt>신고자</dt>
                  <dd>{report.reporterId}</dd>
                </div>
                <div>
                  <dt>사유</dt>
                  <dd>{report.reason}</dd>
                </div>
                <div>
                  <dt>상세</dt>
                  <dd>{report.detail}</dd>
                </div>
                <div>
                  <dt>대상 스냅샷</dt>
                  <dd>
                    <pre>
                      {JSON.stringify(report.targetSnapshot ?? {}, null, 2)}
                    </pre>
                  </dd>
                </div>
              </dl>
            </section>
            {["open", "investigating"].includes(report.status) && (
              <form action={submit} className={styles.contentForm}>
                <label>
                  결과
                  <select name="status">
                    <option value="resolved">처리 완료</option>
                    <option value="dismissed">기각</option>
                  </select>
                </label>
                <label>
                  처리 사유
                  <textarea name="resolution" required />
                </label>
                <label>
                  콘텐츠 조치
                  <select name="contentAction">
                    <option value="none">없음</option>
                    <option value="hide">숨김</option>
                    <option value="delete">삭제</option>
                  </select>
                </label>
                <label>
                  사용자 제재
                  <select name="sanction">
                    <option value="">없음</option>
                    <option value="warning">경고</option>
                    <option value="content_write_restriction">작성 제한</option>
                    <option value="suspension">정지</option>
                    <option value="ban">영구 정지</option>
                  </select>
                </label>
                <label>
                  제재 사유
                  <input name="sanctionReason" />
                </label>
                <label>
                  종료일
                  <input name="endsAt" type="datetime-local" />
                </label>
                <button className={styles.primaryButton} disabled={saving}>
                  처리
                </button>
              </form>
            )}
          </>
        )}
      </AsyncState>
    </main>
  );
}
