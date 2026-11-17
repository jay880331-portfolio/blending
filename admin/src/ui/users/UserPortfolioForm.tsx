import type {
  AdminUserPortfolioDto,
  SaveAdminUserPortfolioInput,
} from "@blending/admin-contracts";
import { useState } from "react";
import { FormField } from "../shared/FormField";

export function UserPortfolioForm({
  portfolio,
  onSave,
}: {
  portfolio?: AdminUserPortfolioDto;
  onSave: (input: SaveAdminUserPortfolioInput) => Promise<void>;
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
            id: portfolio?.id ?? "",
            title: String(value.title),
            summary: String(value.summary),
            createdAt: portfolio?.createdAt ?? "",
            imageUrls: String(value.imageUrls)
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean),
            reason: String(value.reason),
          });
          if (!portfolio) event.currentTarget.reset();
        } finally {
          setSaving(false);
        }
      }}
    >
      <FormField label="제목">
        <input name="title" defaultValue={portfolio?.title} required />
      </FormField>
      <FormField label="내용">
        <textarea name="summary" defaultValue={portfolio?.summary} required />
      </FormField>
      <FormField label="이미지 URL (줄바꿈 구분)">
        <textarea
          name="imageUrls"
          defaultValue={portfolio?.imageUrls.join("\n")}
        />
      </FormField>
      <FormField label="수정 사유">
        <input name="reason" required />
      </FormField>
      <button disabled={saving}>
        {saving
          ? "저장 중…"
          : portfolio
            ? "포트폴리오 수정"
            : "포트폴리오 추가"}
      </button>
    </form>
  );
}
