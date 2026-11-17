import {
  isAdminPageSize,
  type AdminListQuery,
} from "@blending/admin-contracts";

export function parseAdminListQuery(
  params: URLSearchParams,
  allowedSorts: readonly string[],
): Required<Pick<AdminListQuery, "page" | "pageSize" | "direction">> &
  AdminListQuery {
  const page = Number(params.get("page") ?? 1);
  const pageSize = Number(params.get("pageSize") ?? 20);
  const sort = params.get("sort") ?? undefined;

  if (!Number.isInteger(page) || page < 1) {
    throw new Error("페이지를 확인해주세요.");
  }
  if (!isAdminPageSize(pageSize)) {
    throw new Error("페이지 크기를 확인해주세요.");
  }
  if (sort && !allowedSorts.includes(sort)) {
    throw new Error("정렬 기준을 확인해주세요.");
  }

  return {
    page,
    pageSize,
    sort,
    direction: params.get("direction") === "asc" ? "asc" : "desc",
    q: params.get("q")?.trim() || undefined,
    status: params.get("status") || undefined,
    from: params.get("from") || undefined,
    to: params.get("to") || undefined,
  };
}
