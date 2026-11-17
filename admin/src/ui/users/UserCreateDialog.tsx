"use client";

import type {
  AdminUserDto,
  AdminUserRole,
  CreateAdminManagedUserInput,
} from "@blending/admin-contracts";
import { useState } from "react";
import { createUser } from "../../adapters/http/usersApi";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { FormField } from "../shared/FormField";

const initialInput: CreateAdminManagedUserInput = {
  phone: "",
  password: "",
  name: "",
  handle: "",
  role: "enthusiast",
};

export function UserCreateDialog({
  open,
  onCancel,
  onCreated,
}: {
  open: boolean;
  onCancel: () => void;
  onCreated: (user: AdminUserDto) => void;
}) {
  const [input, setInput] = useState(initialInput);
  const validationError =
    !input.phone.trim() || !input.name.trim() || !input.handle.trim()
      ? "필수 항목을 입력해주세요."
      : input.password.length < 8
        ? "비밀번호는 8자리 이상이어야 합니다."
        : undefined;
  const change = (key: keyof CreateAdminManagedUserInput, value: string) =>
    setInput((current) => ({ ...current, [key]: value }));

  return (
    <ConfirmDialog
      open={open}
      title="사용자 생성"
      onCancel={onCancel}
      confirmDisabled={Boolean(validationError)}
      validationError={validationError}
      onConfirm={async () => onCreated(await createUser(input))}
    >
      <FormField label="이름">
        <input
          value={input.name}
          onChange={(event) => change("name", event.target.value)}
          required
        />
      </FormField>
      <FormField label="핸들">
        <input
          value={input.handle}
          onChange={(event) => change("handle", event.target.value)}
          required
        />
      </FormField>
      <FormField label="휴대전화">
        <input
          value={input.phone}
          onChange={(event) => change("phone", event.target.value)}
          required
        />
      </FormField>
      <FormField label="이메일">
        <input
          type="email"
          value={input.email ?? ""}
          onChange={(event) => change("email", event.target.value)}
        />
      </FormField>
      <FormField label="비밀번호">
        <input
          type="password"
          value={input.password}
          onChange={(event) => change("password", event.target.value)}
          required
          minLength={8}
        />
      </FormField>
      <FormField label="역할">
        <select
          value={input.role}
          onChange={(event) =>
            change("role", event.target.value as AdminUserRole)
          }
        >
          <option value="barista">바리스타</option>
          <option value="enthusiast">애호가</option>
          <option value="partner">파트너</option>
          <option value="admin">관리자</option>
        </select>
      </FormField>
    </ConfirmDialog>
  );
}
