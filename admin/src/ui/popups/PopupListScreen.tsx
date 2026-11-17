"use client";

import type {
  AdminAppPopupDto,
  AppPopupPlacement,
} from "@blending/admin-contracts";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  deleteAppPopup,
  fetchAppPopups,
  setAppPopupEnabled,
} from "../../adapters/http/appPopupApi";
import { AsyncState } from "../shared/AsyncState";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { DataTable, type DataColumn } from "../shared/DataTable";
import { PageHeader } from "../shared/PageHeader";
import { formatKstDateTime } from "./popupForm";
import styles from "./popups.module.css";

const PLACEMENT_LABELS: Record<AppPopupPlacement, string> = {
  map: "지도",
  community: "커뮤니티",
  home: "홈",
  partner: "파트너",
  mypage: "프로필",
};

const placementLabels = (placements: AppPopupPlacement[]) =>
  placements.map((placement) => PLACEMENT_LABELS[placement]).join(", ");

const formatKstPeriod = (popup: AdminAppPopupDto) =>
  `${formatKstDateTime(popup.startsAt)} ~ ${formatKstDateTime(popup.endsAt)}`;

export function PopupListScreen() {
  const [popups, setPopups] = useState<AdminAppPopupDto[]>();
  const [error, setError] = useState("");
  const [toggleError, setToggleError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminAppPopupDto>();

  useEffect(() => {
    fetchAppPopups()
      .then((next) => {
        setPopups(next);
        setError("");
      })
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "조회에 실패했습니다.",
        ),
      );
  }, []);

  const toggle = async (popup: AdminAppPopupDto) => {
    setToggleError("");
    try {
      const updated = await setAppPopupEnabled(popup.id, !popup.enabled);
      setPopups((current) =>
        current?.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (cause) {
      setToggleError(
        cause instanceof Error
          ? cause.message
          : "활성 상태 변경에 실패했습니다.",
      );
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    const deleted = await deleteAppPopup(deleteTarget.id);
    setPopups((current) => current?.filter((popup) => popup.id !== deleted.id));
  };

  const columns: DataColumn<AdminAppPopupDto>[] = [
    {
      key: "preview",
      label: "이미지",
      render: (popup) => (
        <img className={styles.preview} src={popup.imageUrl} alt="" />
      ),
    },
    { key: "adminTitle", label: "관리 제목" },
    {
      key: "placements",
      label: "구좌",
      render: (popup) => placementLabels(popup.placements),
    },
    {
      key: "period",
      label: "노출 기간",
      render: (popup) => formatKstPeriod(popup),
    },
    { key: "priority", label: "우선순위" },
    {
      key: "actions",
      label: "",
      render: (popup) => (
        <div className={styles.rowActions}>
          <button type="button" onClick={() => toggle(popup)}>
            {popup.enabled ? "끄기" : "켜기"}
          </button>
          <Link href={`/popups/${popup.id}/edit`}>수정</Link>
          <button type="button" onClick={() => setDeleteTarget(popup)}>
            삭제
          </button>
        </div>
      ),
    },
  ];

  return (
    <main className={styles.page}>
      <PageHeader
        title="팝업"
        description="앱 구좌별 노출 팝업을 관리합니다."
        actions={
          <Link className="primary-action" href="/popups/new">
            팝업 등록
          </Link>
        }
      />
      {toggleError && <p role="alert">{toggleError}</p>}
      <AsyncState loading={!popups && !error} error={error}>
        {popups && (
          <DataTable caption="팝업 목록" rows={popups} columns={columns} />
        )}
      </AsyncState>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="팝업 삭제"
        onConfirm={remove}
        onCancel={() => setDeleteTarget(undefined)}
      >
        <p>이 팝업을 영구 삭제할까요? 삭제 후 복구할 수 없습니다.</p>
      </ConfirmDialog>
    </main>
  );
}
