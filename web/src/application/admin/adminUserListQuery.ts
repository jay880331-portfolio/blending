import {
  ADMIN_LOGIN_METHODS,
  ADMIN_USER_ROLES,
  ADMIN_USER_SORTS,
  ADMIN_USER_STATUSES,
  type AdminLoginMethod,
  type AdminUserListQuery,
  type AdminUserRole,
  type AdminUserStatus,
} from "@blending/admin-contracts";
import { parseAdminListQuery } from "./adminListQuery";

const ALLOWED_KEYS = new Set([
  "q",
  "status",
  "role",
  "loginMethod",
  "from",
  "to",
  "sort",
  "direction",
  "page",
  "pageSize",
]);

export function parseAdminUserListQuery(
  params: URLSearchParams,
): AdminUserListQuery {
  for (const key of params.keys())
    if (!ALLOWED_KEYS.has(key))
      throw new Error("지원하지 않는 조회 조건입니다.");
  const base = parseAdminListQuery(params, ADMIN_USER_SORTS);
  const role = params.get("role");
  const loginMethod = params.get("loginMethod");
  if (role && !ADMIN_USER_ROLES.includes(role as AdminUserRole))
    throw new Error("역할을 확인해주세요.");
  if (
    base.status &&
    !ADMIN_USER_STATUSES.includes(base.status as AdminUserStatus)
  )
    throw new Error("상태를 확인해주세요.");
  if (
    loginMethod &&
    !ADMIN_LOGIN_METHODS.includes(loginMethod as AdminLoginMethod)
  )
    throw new Error("로그인 방식을 확인해주세요.");
  if ((base.from && !isDate(base.from)) || (base.to && !isDate(base.to)))
    throw new Error("날짜를 확인해주세요.");
  if (base.from && base.to && base.from > base.to)
    throw new Error("날짜 범위를 확인해주세요.");
  return {
    ...base,
    sort: base.sort as AdminUserListQuery["sort"],
    ...(role ? { role: role as AdminUserRole } : {}),
    ...(loginMethod ? { loginMethod: loginMethod as AdminLoginMethod } : {}),
  };
}

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
  );
}
