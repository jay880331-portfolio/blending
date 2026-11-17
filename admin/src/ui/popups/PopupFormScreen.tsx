"use client";

import {
  APP_POPUP_PLACEMENTS,
  type AdminAppPopupDto,
  type AppPopupPlacement,
} from "@blending/admin-contracts";
import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  createAppPopup,
  fetchAppPopup,
  updateAppPopup,
} from "../../adapters/http/appPopupApi";
import { AsyncState } from "../shared/AsyncState";
import { AdminImageUpload } from "../shared/AdminImageUpload";
import { FormField } from "../shared/FormField";
import { FormSection } from "../shared/FormSection";
import { PageHeader } from "../shared/PageHeader";
import { parsePopupForm, toKstDateTimeLocal } from "./popupForm";
import styles from "./popups.module.css";

const PLACEMENT_LABELS: Record<AppPopupPlacement, string> = {
  map: "지도",
  community: "커뮤니티",
  home: "홈",
  partner: "파트너",
  mypage: "프로필",
};

export function PopupFormScreen({ id }: { id?: string }) {
  const router = useRouter();
  const [popup, setPopup] = useState<AdminAppPopupDto>();
  const [imageUrl, setImageUrl] = useState("");
  const [placements, setPlacements] = useState<AppPopupPlacement[]>([]);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchAppPopup(id)
      .then((next) => {
        setPopup(next);
        setImageUrl(next.imageUrl);
        setPlacements(next.placements);
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
        title={`팝업 ${id ? "수정" : "등록"}`}
        actions={<Link href="/popups">목록으로</Link>}
      />
      <AsyncState
        loading={Boolean(id) && !popup && !loadError}
        error={loadError}
      >
        {!id || popup ? (
          <form
            className={styles.form}
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              setSubmitError("");
              try {
                const input = parsePopupForm(
                  Object.fromEntries(new FormData(event.currentTarget)),
                );
                if (id) {
                  await updateAppPopup(id, input);
                } else {
                  await createAppPopup(input);
                }
                router.push("/popups");
              } catch (cause) {
                setSubmitError(
                  axios.isAxiosError(cause)
                    ? String(cause.response?.data?.message ?? cause.message)
                    : "저장 실패",
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            <FormSection title="기본 정보">
              <FormField label="관리 제목">
                <input
                  name="adminTitle"
                  defaultValue={popup?.adminTitle}
                  required
                />
              </FormField>
              <FormField label="이미지 URL">
                <input
                  name="imageUrl"
                  type="url"
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                  required
                />
              </FormField>
              <FormField label="이미지 대체 텍스트">
                <input
                  name="imageAlt"
                  defaultValue={popup?.imageAlt}
                  required
                />
              </FormField>
              <FormField label="이동 URL">
                <input
                  name="href"
                  type="url"
                  defaultValue={popup?.href ?? ""}
                />
              </FormField>
              <div className={styles.upload}>
                <AdminImageUpload
                  onUploaded={(urls) => setImageUrl(urls[0] ?? imageUrl)}
                />
                {imageUrl && (
                  <img
                    className={styles.formPreview}
                    src={imageUrl}
                    alt="업로드 이미지 미리보기"
                  />
                )}
              </div>
            </FormSection>
            <FormSection title="노출 설정">
              <div className={styles.placements}>
                <label className={styles.checkbox}>
                  <input
                    name="allPlacements"
                    type="checkbox"
                    checked={placements.length === APP_POPUP_PLACEMENTS.length}
                    onChange={(event) =>
                      setPlacements(
                        event.target.checked ? [...APP_POPUP_PLACEMENTS] : [],
                      )
                    }
                  />
                  전체 구좌
                </label>
                {APP_POPUP_PLACEMENTS.map((placement) => (
                  <label className={styles.checkbox} key={placement}>
                    <input
                      name={`placement:${placement}`}
                      type="checkbox"
                      checked={placements.includes(placement)}
                      onChange={(event) =>
                        setPlacements((current) =>
                          event.target.checked
                            ? [...current, placement]
                            : current.filter((item) => item !== placement),
                        )
                      }
                    />
                    {PLACEMENT_LABELS[placement]}
                  </label>
                ))}
              </div>
              <FormField label="우선순위">
                <input
                  name="priority"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={popup?.priority ?? 0}
                  required
                />
              </FormField>
              <FormField label="시작 시각 (KST)">
                <input
                  name="startsAt"
                  type="datetime-local"
                  defaultValue={
                    popup ? toKstDateTimeLocal(popup.startsAt) : undefined
                  }
                  required
                />
              </FormField>
              <FormField label="종료 시각 (KST)">
                <input
                  name="endsAt"
                  type="datetime-local"
                  defaultValue={
                    popup ? toKstDateTimeLocal(popup.endsAt) : undefined
                  }
                  required
                />
              </FormField>
              <label className={styles.checkbox}>
                <input
                  name="enabled"
                  type="checkbox"
                  defaultChecked={popup?.enabled ?? false}
                />
                활성
              </label>
            </FormSection>
            {submitError && <p role="alert">{submitError}</p>}
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={saving}
            >
              {saving ? "저장 중…" : id ? "수정" : "등록"}
            </button>
          </form>
        ) : null}
      </AsyncState>
    </main>
  );
}
