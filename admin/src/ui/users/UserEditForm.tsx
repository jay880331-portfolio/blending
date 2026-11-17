"use client";

import type { AdminUserDetailDto } from "@blending/admin-contracts";
import { useState } from "react";
import { FormField } from "../shared/FormField";
import { FormSection } from "../shared/FormSection";

export function UserEditForm({
  user,
  onSave,
}: {
  user: AdminUserDetailDto;
  onSave: (input: {
    name: string;
    handle: string;
    phone: string;
    email?: string;
    reason: string;
  }) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        const values = Object.fromEntries(new FormData(event.currentTarget));
        try {
          await onSave({
            name: String(values.name),
            handle: String(values.handle),
            phone: String(values.phone),
            ...(values.email ? { email: String(values.email) } : {}),
            reason: String(values.reason),
          });
        } finally {
          setSaving(false);
        }
      }}
    >
      <FormSection title="기본 정보">
        <FormField label="이름">
          <input name="name" defaultValue={user.name} required />
        </FormField>
        <FormField label="핸들">
          <input name="handle" defaultValue={user.handle} required />
        </FormField>
        <FormField label="휴대전화">
          <input name="phone" defaultValue={user.phone} required />
        </FormField>
        <FormField label="이메일">
          <input name="email" type="email" defaultValue={user.email} />
        </FormField>
        <FormField label="수정 사유">
          <input name="reason" required />
        </FormField>
        <button type="submit" disabled={saving}>
          {saving ? "저장 중…" : "기본정보 저장"}
        </button>
      </FormSection>
    </form>
  );
}
