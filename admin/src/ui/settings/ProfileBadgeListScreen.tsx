"use client";

import type { AdminProfileBadgeDto } from "@blending/admin-contracts";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  deleteProfileBadge,
  fetchProfileBadges,
} from "../../adapters/http/profileBadgeApi";
import { AsyncState } from "../shared/AsyncState";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { DataTable, type DataColumn } from "../shared/DataTable";
import { PageHeader } from "../shared/PageHeader";
import { AdminBadgePill } from "./AdminBadgePreview";
import styles from "./profileBadges.module.css";

export function ProfileBadgeListScreen() {
  const [badges, setBadges] = useState<AdminProfileBadgeDto[]>();
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminProfileBadgeDto>();

  useEffect(() => {
    fetchProfileBadges()
      .then((next) => {
        setBadges(next);
        setError("");
      })
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "조회에 실패했습니다.",
        ),
      );
  }, []);

  const remove = async () => {
    if (!deleteTarget) return;
    const deleted = await deleteProfileBadge(deleteTarget.id);
    setBadges((current) => current?.filter((badge) => badge.id !== deleted.id));
  };

  const columns: DataColumn<AdminProfileBadgeDto>[] = [
    {
      key: "preview",
      label: "미리보기",
      render: (badge) => <AdminBadgePill name={badge.name} />,
    },
    { key: "name", label: "이름" },
    { key: "sortOrder", label: "정렬" },
    {
      key: "actions",
      label: "",
      render: (badge) => (
        <div className={styles.rowActions}>
          <Link href={`/settings/profile-badges/${badge.id}/edit`}>수정</Link>
          <button type="button" onClick={() => setDeleteTarget(badge)}>
            삭제
          </button>
        </div>
      ),
    },
  ];

  return (
    <main className={styles.page}>
      <PageHeader
        title="프로필 뱃지"
        description="뱃지 이름을 만들면 프로필 사진과 인물사전에 빨간 알약으로 표시됩니다. 부여는 사용자 상세에서 합니다."
        actions={
          <Link className="primary-action" href="/settings/profile-badges/new">
            뱃지 등록
          </Link>
        }
      />
      <AsyncState loading={!badges && !error} error={error}>
        {badges && (
          <DataTable caption="뱃지 목록" rows={badges} columns={columns} />
        )}
      </AsyncState>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="뱃지 삭제"
        onConfirm={remove}
        onCancel={() => setDeleteTarget(undefined)}
      >
        <p>
          이 뱃지를 삭제할까요? 부여된 사용자에게서도 함께 사라지며 복구할 수
          없습니다.
        </p>
      </ConfirmDialog>
    </main>
  );
}
