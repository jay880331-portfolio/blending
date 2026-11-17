"use client";

import type { AdminUserRole, AdminUserStatus } from "@blending/admin-contracts";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  changeUserRole,
  changeUserStatus,
  fetchUser,
  updateUser,
} from "../../adapters/http/usersApi";
import { useAdminSessionStore } from "../../store/adminSessionStore";
import { userAuditLogsHref } from "../../domain/userRelatedQuery";
import { AsyncState } from "../shared/AsyncState";
import { FormField } from "../shared/FormField";
import { FormSection } from "../shared/FormSection";
import { StatusBadge } from "../shared/StatusBadge";
import { UserEditForm } from "./UserEditForm";
import { UserRelatedTabs } from "./UserRelatedTabs";
import { UserRoleDialog } from "./UserRoleDialog";
import { UserStatusDialog } from "./UserStatusDialog";
import styles from "./users.module.css";

export function UserDetailScreen({ userId }: { userId: string }) {
  const actorId = useAdminSessionStore((state) => state.user?.id);
  const [user, setUser] = useState<Awaited<ReturnType<typeof fetchUser>>>();
  const [error, setError] = useState("");
  const [status, setStatus] = useState<AdminUserStatus>();
  const [role, setRole] = useState<AdminUserRole>();
  const load = useCallback(
    () =>
      fetchUser(userId)
        .then(setUser)
        .catch((cause) =>
          setError(cause instanceof Error ? cause.message : "조회 실패"),
        ),
    [userId],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const protectedAdmin = user?.id === actorId || user?.isLastActiveAdmin;
  return (
    <main className={styles.page}>
      <AsyncState loading={!user && !error} error={error}>
        {user ? (
          <>
            <header className={styles.header}>
              <h1>{user.name}</h1>
              <StatusBadge status={user.accountStatus} />
            </header>
            <UserEditForm
              user={user}
              onSave={async (input) => {
                await updateUser(user.id, input);
                await load();
              }}
            />
            <FormSection title="운영">
              <div className={styles.ops}>
                <div className={styles.opsField}>
                  <span>계정 상태</span>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      disabled={protectedAdmin}
                      onClick={() => setStatus("suspended")}
                    >
                      정지
                    </button>
                    <button type="button" onClick={() => setStatus("active")}>
                      복구
                    </button>
                    <button
                      type="button"
                      data-variant="danger"
                      disabled={protectedAdmin}
                      onClick={() => setStatus("deleted")}
                    >
                      삭제
                    </button>
                  </div>
                </div>
                <FormField label="역할">
                  <select
                    value={user.role}
                    disabled={protectedAdmin}
                    onChange={(event) =>
                      setRole(event.target.value as AdminUserRole)
                    }
                  >
                    <option value="barista">바리스타</option>
                    <option value="enthusiast">애호가</option>
                    <option value="partner">파트너</option>
                    <option value="admin">관리자</option>
                  </select>
                </FormField>
              </div>
              <Link className={styles.link} href={userAuditLogsHref(user.id)}>
                감사 로그 보기
              </Link>
            </FormSection>
            <UserRelatedTabs userId={user.id} />
            {status && (
              <UserStatusDialog
                open
                status={status}
                onCancel={() => setStatus(undefined)}
                onConfirm={async (reason) => {
                  await changeUserStatus(user.id, status, reason);
                  setStatus(undefined);
                  await load();
                }}
              />
            )}
            {role && (
              <UserRoleDialog
                open
                role={role}
                onCancel={() => setRole(undefined)}
                onConfirm={async (reason) => {
                  await changeUserRole(user.id, role, reason);
                  setRole(undefined);
                  await load();
                }}
              />
            )}
          </>
        ) : null}
      </AsyncState>
    </main>
  );
}
