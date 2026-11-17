"use client";

import type { AdminUserRole } from "@blending/admin-contracts";
import { useState } from "react";
import { ConfirmDialog } from "../shared/ConfirmDialog";

export function UserRoleDialog({
  open,
  role,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  role: AdminUserRole;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  return (
    <ConfirmDialog
      open={open}
      title="사용자 역할 변경"
      onCancel={onCancel}
      confirmDisabled={!reason.trim()}
      validationError={!reason.trim() ? "사유를 입력해주세요." : undefined}
      onConfirm={() => onConfirm(reason.trim())}
    >
      <p>역할을 {role}(으)로 변경합니다.</p>
      <label>
        사유
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          required
        />
      </label>
    </ConfirmDialog>
  );
}
