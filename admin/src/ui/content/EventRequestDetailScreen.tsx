"use client";

import type { DecideEventRequestInput } from "@blending/admin-contracts";
import { useEffect, useState } from "react";
import {
  decideEventRequest,
  fetchEventRequest,
} from "../../adapters/http/eventRequestsApi";
import { AsyncState } from "../shared/AsyncState";
import { FormField } from "../shared/FormField";
import { StatusBadge } from "../shared/StatusBadge";
import styles from "./content.module.css";

export function EventRequestDetailScreen({ id }: { id: string }) {
  const [request, setRequest] =
    useState<Awaited<ReturnType<typeof fetchEventRequest>>>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    fetchEventRequest(id)
      .then(setRequest)
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "조회 실패"),
      );
  }, [id]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const decision = (event.nativeEvent as SubmitEvent).submitter?.getAttribute(
      "value",
    );
    const reason = String(form.get("reason") ?? "");
    const input: DecideEventRequestInput =
      decision === "reject"
        ? { decision: "reject", reason }
        : {
            decision: "approve",
            reason,
            event: {
              title: String(form.get("title") ?? ""),
              category: String(form.get("category")) as
                | "official"
                | "seminar"
                | "meetup",
              startsAt: new Date(String(form.get("startsAt"))).toISOString(),
              ...(form.get("endsAt")
                ? { endsAt: new Date(String(form.get("endsAt"))).toISOString() }
                : {}),
              location: String(form.get("location") ?? ""),
              address: String(form.get("address") ?? ""),
              description: String(form.get("description") ?? ""),
              ...(request?.imageUrl
                ? { imageUrl: request.imageUrl, posterUrl: request.imageUrl }
                : {}),
              ...(form.get("applyUrl")
                ? { applyUrl: String(form.get("applyUrl")) }
                : {}),
            },
          };
    setSaving(true);
    setError("");
    try {
      setRequest(await decideEventRequest(id, input));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "처리 실패");
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className={styles.formPage}>
      <AsyncState loading={!request && !error} error={request ? "" : error}>
        {request ? (
          <>
            {error && <p role="alert">{error}</p>}
            <header className={styles.pageHeader}>
              <div>
                <h1>{request.title}</h1>
                <p>요청자 {request.requesterId}</p>
              </div>
              <StatusBadge status={request.status} />
            </header>
            <section>
              <h2>요청 원문</h2>
              <p>{request.body}</p>
              {request.imageUrl && (
                <a href={request.imageUrl} target="_blank" rel="noreferrer">
                  첨부 이미지
                </a>
              )}
              <dl>
                <dt>일정</dt>
                <dd>{request.schedule || "-"}</dd>
                <dt>시간</dt>
                <dd>{request.time || "-"}</dd>
              </dl>
            </section>
            {request.status === "pending" ? (
              <form className={styles.contentForm} onSubmit={submit}>
                <FormField label="행사 제목">
                  <input name="title" defaultValue={request.title} required />
                </FormField>
                <FormField label="분류">
                  <select
                    name="category"
                    defaultValue={request.category ?? "official"}
                  >
                    <option value="official">공식</option>
                    <option value="seminar">세미나</option>
                    <option value="meetup">모임</option>
                  </select>
                </FormField>
                <FormField label="시작">
                  <input type="datetime-local" name="startsAt" required />
                </FormField>
                <FormField label="종료">
                  <input type="datetime-local" name="endsAt" />
                </FormField>
                <FormField label="장소">
                  <input
                    name="location"
                    defaultValue={request.location}
                    required
                  />
                </FormField>
                <FormField label="주소">
                  <input
                    name="address"
                    defaultValue={request.address}
                    required
                  />
                </FormField>
                <FormField label="설명">
                  <textarea
                    name="description"
                    defaultValue={request.body}
                    required
                  />
                </FormField>
                <FormField label="신청 URL">
                  <input
                    name="applyUrl"
                    type="url"
                    defaultValue={request.applyUrl}
                  />
                </FormField>
                <FormField label="처리 사유">
                  <textarea name="reason" required />
                </FormField>
                <div className={styles.actions}>
                  <button name="decision" value="approve" disabled={saving}>
                    승인
                  </button>
                  <button
                    name="decision"
                    value="reject"
                    formNoValidate
                    disabled={saving}
                  >
                    반려
                  </button>
                </div>
              </form>
            ) : (
              <p>처리 사유: {request.decisionReason}</p>
            )}
          </>
        ) : null}
      </AsyncState>
    </main>
  );
}
