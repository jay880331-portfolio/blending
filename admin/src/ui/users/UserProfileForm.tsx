import type {
  AdminUserProfileDto,
  UpdateAdminUserProfileInput,
} from "@blending/admin-contracts";
import { useState } from "react";
import { FormField } from "../shared/FormField";

export function UserProfileForm({
  profile,
  onSave,
}: {
  profile: AdminUserProfileDto;
  onSave: (input: UpdateAdminUserProfileInput) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        const value = Object.fromEntries(new FormData(event.currentTarget));
        try {
          await onSave({
            name: String(value.name),
            handle: String(value.handle),
            workplace: String(value.workplace),
            bio: String(value.bio),
            status: String(value.status) as AdminUserProfileDto["status"],
            isPortfolioPublic: value.isPortfolioPublic === "on",
            reason: String(value.reason),
          });
        } finally {
          setSaving(false);
        }
      }}
    >
      <FormField label="이름">
        <input name="name" defaultValue={profile.name} required />
      </FormField>
      <FormField label="핸들">
        <input name="handle" defaultValue={profile.handle} required />
      </FormField>
      <FormField label="직장">
        <input name="workplace" defaultValue={profile.workplace} required />
      </FormField>
      <FormField label="소개">
        <textarea name="bio" defaultValue={profile.bio} required />
      </FormField>
      <FormField label="상태">
        <select name="status" defaultValue={profile.status}>
          <option value="guest">일반</option>
          <option value="job-seeking">구직 중</option>
          <option value="focused">집중 중</option>
        </select>
      </FormField>
      <label>
        <input
          name="isPortfolioPublic"
          type="checkbox"
          defaultChecked={profile.isPortfolioPublic}
        />{" "}
        포트폴리오 공개
      </label>
      <FormField label="수정 사유">
        <input name="reason" required />
      </FormField>
      <button type="submit" disabled={saving}>
        {saving ? "저장 중…" : "프로필 저장"}
      </button>
    </form>
  );
}
