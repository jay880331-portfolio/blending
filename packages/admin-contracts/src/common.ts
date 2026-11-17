export type AdminSortDirection = "asc" | "desc";

export const ADMIN_PAGE_SIZES = [20, 50, 100] as const;
export type AdminPageSize = (typeof ADMIN_PAGE_SIZES)[number];

export function isAdminPageSize(value: number): value is AdminPageSize {
  return ADMIN_PAGE_SIZES.includes(value as AdminPageSize);
}

export type AdminListQuery = {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
  sort?: string;
  direction?: AdminSortDirection;
  page?: number;
  pageSize?: AdminPageSize;
};

export type AdminPagination = {
  page: number;
  pageSize: AdminPageSize;
  total: number;
  totalPages: number;
};

export type AdminPage<T> = {
  items: T[];
  pagination: AdminPagination;
};

export type AdminApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export type AdminApiError = {
  code: AdminApiErrorCode;
  message: string;
  requestId: string;
  fieldErrors?: Record<string, string>;
};
