import {
  ADMIN_CONTENT_KINDS,
  ADMIN_CONTENT_SORTS,
  ADMIN_CONTENT_STATES,
  type AdminContentKind,
  type AdminContentListQuery,
  type AdminContentState,
} from "@blending/admin-contracts";
import { parseAdminListQuery } from "./adminListQuery";

const ALLOWED_KEYS = new Set([
  "kind",
  "q",
  "state",
  "authorId",
  "from",
  "to",
  "sort",
  "direction",
  "page",
  "pageSize",
]);

export function parseAdminContentListQuery(
  params: URLSearchParams,
): AdminContentListQuery {
  for (const key of params.keys())
    if (!ALLOWED_KEYS.has(key))
      throw new Error("지원하지 않는 조회 조건입니다.");
  const kind = params.get("kind");
  const state = params.get("state");
  if (!kind || !ADMIN_CONTENT_KINDS.includes(kind as AdminContentKind))
    throw new Error("콘텐츠 종류를 확인해주세요.");
  if (state && !ADMIN_CONTENT_STATES.includes(state as AdminContentState))
    throw new Error("콘텐츠 상태를 확인해주세요.");

  const base = parseAdminListQuery(params, ADMIN_CONTENT_SORTS);
  if ((base.from && !isDate(base.from)) || (base.to && !isDate(base.to)))
    throw new Error("날짜를 확인해주세요.");
  if (base.from && base.to && base.from > base.to)
    throw new Error("날짜 범위를 확인해주세요.");
  return {
    ...base,
    kind: kind as AdminContentKind,
    sort: base.sort as AdminContentListQuery["sort"],
    ...(state ? { state: state as AdminContentState } : {}),
    ...(params.get("authorId")?.trim()
      ? { authorId: params.get("authorId")!.trim() }
      : {}),
  };
}

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}
