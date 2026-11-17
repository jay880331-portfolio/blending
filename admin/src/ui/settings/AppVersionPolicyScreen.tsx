"use client";

import type {
  AppVersionPolicy,
  AppVersionPolicyUpdate,
  PlatformVersionPolicy,
} from "@blending/admin-contracts";
import axios from "axios";
import { useEffect, useState } from "react";
import {
  fetchAppVersionPolicy,
  updateAppVersionPolicy,
} from "../../adapters/http/settingsApi";
import { FormField } from "../shared/FormField";
import { FormSection } from "../shared/FormSection";
import { PageHeader } from "../shared/PageHeader";
import styles from "./settings.module.css";

type Draft = Omit<AppVersionPolicyUpdate, "expectedRevision">;

export function AppVersionPolicyScreen() {
  const [policy, setPolicy] = useState<AppVersionPolicy>();
  const [draft, setDraft] = useState<Draft>();
  const [previewPlatform, setPreviewPlatform] = useState<"android" | "ios">(
    "android",
  );
  const [previewBuild, setPreviewBuild] = useState(1);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async (replaceDraft = true) => {
    const next = await fetchAppVersionPolicy();
    setPolicy(next);
    if (replaceDraft)
      setDraft({
        enabled: next.enabled,
        message: next.message,
        android: next.android,
        ios: next.ios,
      });
  };

  useEffect(() => {
    fetchAppVersionPolicy()
      .then((next) => {
        setPolicy(next);
        setDraft({
          enabled: next.enabled,
          message: next.message,
          android: next.android,
          ios: next.ios,
        });
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "조회 실패"),
      );
  }, []);

  if (!policy || !draft) return <p>{error || "불러오는 중…"}</p>;

  const setPlatform = (
    platform: "android" | "ios",
    value: PlatformVersionPolicy,
  ) => setDraft((current) => current && { ...current, [platform]: value });

  return (
    <main className={styles.page}>
      <PageHeader
        title="앱 버전 정책"
        description={`revision ${policy.revision ?? "없음"} · 마지막 변경 ${policy.updatedBy ?? "없음"}`}
      />
      <form
        className={styles.form}
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          setError("");
          try {
            const next = await updateAppVersionPolicy({
              ...draft,
              expectedRevision: policy.revision,
            });
            setPolicy(next);
            setDraft({
              enabled: next.enabled,
              message: next.message,
              android: next.android,
              ios: next.ios,
            });
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
        <FormSection title="공통 설정">
          <label className={styles.switch}>
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) =>
                setDraft({ ...draft, enabled: event.target.checked })
              }
            />
            정책 활성화
          </label>
          <FormField label="업데이트 메시지">
            <textarea
              value={draft.message}
              required
              onChange={(event) =>
                setDraft({ ...draft, message: event.target.value })
              }
            />
          </FormField>
        </FormSection>
        {(["android", "ios"] as const).map((platform) => (
          <PlatformFields
            key={platform}
            label={platform === "android" ? "Android" : "iOS"}
            value={draft[platform]}
            onChange={(value) => setPlatform(platform, value)}
          />
        ))}
        <FormSection title="결정 미리보기">
          <FormField label="플랫폼">
            <select
              value={previewPlatform}
              onChange={(event) =>
                setPreviewPlatform(event.target.value as "android" | "ios")
              }
            >
              <option value="android">Android</option>
              <option value="ios">iOS</option>
            </select>
          </FormField>
          <FormField label="현재 빌드">
            <input
              type="number"
              min="1"
              value={previewBuild}
              onChange={(event) => setPreviewBuild(Number(event.target.value))}
            />
          </FormField>
          <p>결과: {previewDecision(draft, previewPlatform, previewBuild)}</p>
        </FormSection>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={saving}>
          {saving ? "저장 중…" : "저장"}
        </button>
      </form>
    </main>
  );
}

function PlatformFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: PlatformVersionPolicy;
  onChange: (value: PlatformVersionPolicy) => void;
}) {
  const number = (raw: string) => (raw ? Number(raw) : null);
  return (
    <FormSection title={label}>
      <FormField label="최신 빌드">
        <input
          type="number"
          min="1"
          value={value.latestBuildNumber ?? ""}
          onChange={(event) =>
            onChange({
              ...value,
              latestBuildNumber: number(event.target.value),
            })
          }
        />
      </FormField>
      <FormField label="최소 빌드">
        <input
          type="number"
          min="1"
          value={value.minBuildNumber ?? ""}
          onChange={(event) =>
            onChange({ ...value, minBuildNumber: number(event.target.value) })
          }
        />
      </FormField>
      <FormField label="업데이트 URL">
        <input
          type="url"
          value={value.updateUrl ?? ""}
          onChange={(event) =>
            onChange({ ...value, updateUrl: event.target.value || null })
          }
        />
      </FormField>
    </FormSection>
  );
}

function previewDecision(
  policy: Draft,
  platform: "android" | "ios",
  build: number,
) {
  if (!policy.enabled) return "검사 안 함";
  const platformPolicy = policy[platform];
  if (
    platformPolicy.minBuildNumber !== null &&
    build < platformPolicy.minBuildNumber
  )
    return "강제 업데이트";
  if (
    platformPolicy.latestBuildNumber !== null &&
    build < platformPolicy.latestBuildNumber
  )
    return "선택 업데이트";
  return "업데이트 없음";
}
