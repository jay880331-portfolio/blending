"use client";

import type { AdminProfileBadgeDto } from "@blending/admin-contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  createProfileBadge,
  fetchProfileBadges,
  updateProfileBadge,
} from "../../adapters/http/profileBadgeApi";
import { AsyncState } from "../shared/AsyncState";
import { FormField } from "../shared/FormField";
import { PageHeader } from "../shared/PageHeader";
import { AdminBadgeAvatarPreview } from "./AdminBadgePreview";
import styles from "./profileBadges.module.css";

export function ProfileBadgeFormScreen({ id }: { id?: string }) {
  const router = useRouter();
  const [badge, setBadge] = useState<AdminProfileBadgeDto>();
  const [name, setName] = useState("");
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchProfileBadges()
      .then((items) => {
        const next = items.find((item) => item.id === id);
        if (!next) {
          setLoadError("뱃지를 찾을 수 없습니다.");
          return;
        }
        setBadge(next);
        setName(next.name);
        setLoadError("");
      })
      .catch((cause) =>
        setLoadError(
          cause instanceof Error ? cause.message : "조회에 실패했습니다.",
        ),
      );
  }, [id]);

  return (
    <main className={styles.formPage}>
      <PageHeader
        title={`뱃지 ${id ? "수정" : "등록"}`}
        actions={<Link href="/settings/profile-badges">목록으로</Link>}
      />
      <AsyncState
        loading={Boolean(id) && !badge && !loadError}
        error={loadError}
      >
        {!id || badge ? (
          <form
            className={styles.form}
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              setSubmitError("");
              const value = Object.fromEntries(
                new FormData(event.currentTarget),
              );
              try {
                const input = {
                  name,
                  icon: badge?.icon ?? "award",
                  imageUrl: badge?.imageUrl ?? null,
                  sortOrder: Number(value.sortOrder),
                };
                if (id) await updateProfileBadge(id, input);
                else await createProfileBadge(input);
                router.push("/settings/profile-badges");
              } catch (cause) {
                setSubmitError(
                  cause instanceof Error
                    ? cause.message
                    : "저장에 실패했습니다.",
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            <p className={styles.help}>
              이름은 프로필 사진과 인물사전에 빨간 알약으로 붙습니다. 이미지는
              올리지 않아도 됩니다.
            </p>
            <FormField label="이름">
              <input
                name="name"
                value={name}
                maxLength={12}
                required
                onChange={(event) => setName(event.target.value)}
              />
            </FormField>
            <FormField label="앱 미리보기">
              <AdminBadgeAvatarPreview name={name} />
            </FormField>
            <FormField label="정렬 순서">
              <input
                name="sortOrder"
                type="number"
                min={0}
                step={1}
                defaultValue={badge?.sortOrder ?? 0}
                required
              />
            </FormField>
            {submitError ? <p role="alert">{submitError}</p> : null}
            <button type="submit" disabled={saving}>
              {saving ? "저장 중…" : "저장"}
            </button>
          </form>
        ) : null}
      </AsyncState>
    </main>
  );
}
