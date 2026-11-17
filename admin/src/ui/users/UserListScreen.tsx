"use client";

import type { AdminUserDto } from "@blending/admin-contracts";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchUsers } from "../../adapters/http/usersApi";
import { adminRoleLabel } from "../../domain/displayLabels";
import { AsyncState } from "../shared/AsyncState";
import { DataTable } from "../shared/DataTable";
import { ListFilterForm } from "../shared/ListFilterForm";
import { PageHeader } from "../shared/PageHeader";
import { Pagination } from "../shared/Pagination";
import { StatusBadge } from "../shared/StatusBadge";
import { UserCreateDialog } from "./UserCreateDialog";

export function UserListScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.toString();
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchUsers>>>();
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    fetchUsers(query)
      .then((next) => {
        setData(next);
        setError("");
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "조회 실패"),
      );
  }, [query]);
  const submit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    const next = new URLSearchParams(
      new FormData(event.currentTarget) as never,
    );
    next.set("page", "1");
    router.push(`/users?${next}`);
  };
  const sort = (field: string) => {
    const next = new URLSearchParams(query);
    next.set("sort", field);
    next.set(
      "direction",
      params.get("sort") === field && params.get("direction") !== "asc"
        ? "asc"
        : "desc",
    );
    router.push(`/users?${next}`);
  };
  return (
    <main className="page">
      <PageHeader
        title="사용자 관리"
        actions={
          <button
            className="primary-action"
            type="button"
            onClick={() => setCreating(true)}
          >
            사용자 생성
          </button>
        }
      />
      <ListFilterForm onSubmit={submit}>
        <input
          name="q"
          aria-label="검색어"
          placeholder="이름, 연락처"
          defaultValue={params.get("q") ?? ""}
        />
        <select
          name="role"
          aria-label="역할"
          defaultValue={params.get("role") ?? ""}
        >
          <option value="">전체 역할</option>
          <option value="barista">바리스타</option>
          <option value="enthusiast">애호가</option>
          <option value="partner">파트너</option>
          <option value="admin">관리자</option>
        </select>
        <select
          name="status"
          aria-label="상태"
          defaultValue={params.get("status") ?? ""}
        >
          <option value="">전체 상태</option>
          <option value="active">활성</option>
          <option value="suspended">정지</option>
          <option value="deleted">삭제</option>
        </select>
        <select
          name="loginMethod"
          aria-label="로그인 방식"
          defaultValue={params.get("loginMethod") ?? ""}
        >
          <option value="">전체 로그인</option>
          <option value="phone">휴대전화</option>
          <option value="kakao">카카오</option>
          <option value="naver">네이버</option>
          <option value="apple">애플</option>
        </select>
        <input
          type="date"
          name="from"
          aria-label="시작일"
          defaultValue={params.get("from") ?? ""}
        />
        <input
          type="date"
          name="to"
          aria-label="종료일"
          defaultValue={params.get("to") ?? ""}
        />
        <input
          type="hidden"
          name="pageSize"
          value={params.get("pageSize") ?? "20"}
        />
      </ListFilterForm>
      <AsyncState loading={!data && !error} error={error}>
        {data ? (
          <>
            <DataTable
              rows={data.items}
              sort={params.get("sort") ?? undefined}
              onSort={sort}
              columns={columns}
            />
            <Pagination
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              query={query}
            />
          </>
        ) : null}
      </AsyncState>
      {creating && (
        <UserCreateDialog
          open
          onCancel={() => setCreating(false)}
          onCreated={(user) => router.push(`/users/${user.id}`)}
        />
      )}
    </main>
  );
}

const columns = [
  {
    key: "name",
    label: "이름",
    sortable: true,
    render: (user: AdminUserDto) => (
      <Link href={`/users/${user.id}`}>{user.name}</Link>
    ),
  },
  { key: "phone", label: "연락처" },
  {
    key: "role",
    label: "역할",
    render: (user: AdminUserDto) => adminRoleLabel(user.role),
  },
  {
    key: "accountStatus",
    label: "상태",
    render: (user: AdminUserDto) => <StatusBadge status={user.accountStatus} />,
  },
  {
    key: "createdAt",
    label: "가입일",
    sortable: true,
    render: (user: AdminUserDto) =>
      new Date(user.createdAt).toLocaleDateString("ko-KR"),
  },
];
