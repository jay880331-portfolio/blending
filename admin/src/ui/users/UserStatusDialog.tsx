"use client";

import type { AdminUserStatus } from "@blending/admin-contracts";
import { useState } from "react";
import { ConfirmDialog } from "../shared/ConfirmDialog";

export function UserStatusDialog({
  open,
  status,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  status: AdminUserStatus;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  return (
    <ConfirmDialog
      open={open}
      title="사용자 상태 변경"
      onCancel={onCancel}
      confirmDisabled={!reason.trim()}
      validationError={!reason.trim() ? "사유를 입력해주세요." : undefined}
      onConfirm={() => onConfirm(reason.trim())}
    >
      <p>상태를 {status}(으)로 변경합니다.</p>
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
