import type {
  AdminUserCareerDto,
  SaveAdminUserCareerInput,
} from "@blending/admin-contracts";
import { useState } from "react";
import { FormField } from "../shared/FormField";

export function UserCareerForm({
  career,
  onSave,
}: {
  career?: AdminUserCareerDto;
  onSave: (input: SaveAdminUserCareerInput) => Promise<void>;
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
            id: career?.id ?? "",
            type: value.type === "award" ? "award" : "career",
            year: String(value.year),
            period: String(value.period),
            title: String(value.title),
            organization: String(value.organization),
            detail: String(value.detail),
            reason: String(value.reason),
          });
          if (!career) event.currentTarget.reset();
        } finally {
          setSaving(false);
        }
      }}
    >
      <FormField label="종류">
        <select name="type" defaultValue={career?.type ?? "career"}>
          <option value="career">경력</option>
          <option value="award">수상</option>
        </select>
      </FormField>
      <FormField label="연도">
        <input
          name="year"
          placeholder="2024 ~ 2025"
          defaultValue={career?.year}
          required
        />
      </FormField>
      <FormField label="기간">
        <input name="period" defaultValue={career?.period} required />
      </FormField>
      <FormField label="제목">
        <input name="title" defaultValue={career?.title} required />
      </FormField>
      <FormField label="기관">
        <input
          name="organization"
          defaultValue={career?.organization}
          required
        />
      </FormField>
      <FormField label="상세">
        <textarea name="detail" defaultValue={career?.detail} />
      </FormField>
      <FormField label="수정 사유">
        <input name="reason" required />
      </FormField>
      <button disabled={saving}>
        {saving ? "저장 중…" : career ? "경력 수정" : "경력 추가"}
      </button>
    </form>
  );
}
