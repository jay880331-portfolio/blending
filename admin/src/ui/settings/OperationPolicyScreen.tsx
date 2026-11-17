"use client";

import type {
  OperationPolicy,
  OperationPolicyUpdate,
} from "@blending/admin-contracts";
import axios from "axios";
import { useEffect, useState } from "react";
import {
  fetchOperationPolicy,
  updateOperationPolicy,
} from "../../adapters/http/settingsApi";
import { FormField } from "../shared/FormField";
import { FormSection } from "../shared/FormSection";
import { PageHeader } from "../shared/PageHeader";
import styles from "./settings.module.css";

type Draft = Omit<OperationPolicyUpdate, "expectedRevision">;
const switches = [
  ["signupEnabled", "회원가입"],
  ["communityWriteEnabled", "커뮤니티 작성"],
  ["partnerWriteEnabled", "파트너 작성"],
  ["reportingEnabled", "신고 접수"],
] as const;

export function OperationPolicyScreen() {
  const [policy, setPolicy] = useState<OperationPolicy>();
  const [draft, setDraft] = useState<Draft>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async (replaceDraft = true) => {
    const next = await fetchOperationPolicy();
    setPolicy(next);
    if (replaceDraft) setDraft(toDraft(next));
  };

  useEffect(() => {
    fetchOperationPolicy()
      .then((next) => {
        setPolicy(next);
        setDraft(toDraft(next));
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "조회 실패"),
      );
  }, []);

  if (!policy || !draft) return <p>{error || "불러오는 중…"}</p>;
  return (
    <main className={styles.page}>
      <PageHeader
        title="운영 정책"
        description={`revision ${policy.revision} · 마지막 변경 ${policy.updatedBy ?? "없음"} ${policy.updatedAt ?? ""}`}
      />
      <form
        className={styles.form}
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          setError("");
          try {
            const next = await updateOperationPolicy({
              ...draft,
              expectedRevision: policy.revision,
            });
            setPolicy(next);
            setDraft(toDraft(next));
          } catch (cause) {
            const message = axios.isAxiosError(cause)
              ? String(cause.response?.data?.message ?? cause.message)
              : "저장 실패";
            if (axios.isAxiosError(cause) && cause.response?.status === 409) {
              try {
                await load(false);
              } catch {
                setError(`${message} 최신 설정도 불러오지 못했습니다.`);
                return;
              }
            }
            setError(message);
          } finally {
            setSaving(false);
          }
        }}
      >
        <FormSection title="기능 스위치">
          {switches.map(([key, label]) => (
            <label className={styles.switch} key={key}>
              <input
                type="checkbox"
                checked={draft[key]}
                onChange={(event) =>
                  setDraft({ ...draft, [key]: event.target.checked })
                }
              />
              {label}
            </label>
          ))}
        </FormSection>
        <FormSection title="중단 안내">
          <FormField label="운영 메시지">
            <textarea
              value={draft.maintenanceMessage ?? ""}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  maintenanceMessage: event.target.value || null,
                })
              }
            />
          </FormField>
        </FormSection>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={saving}>
          {saving ? "저장 중…" : "저장"}
        </button>
      </form>
    </main>
  );
}

function toDraft(policy: OperationPolicy): Draft {
  return {
    signupEnabled: policy.signupEnabled,
    communityWriteEnabled: policy.communityWriteEnabled,
    partnerWriteEnabled: policy.partnerWriteEnabled,
    reportingEnabled: policy.reportingEnabled,
    maintenanceMessage: policy.maintenanceMessage,
  };
}
