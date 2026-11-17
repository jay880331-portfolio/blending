export const adminNavigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/users", label: "사용자" },
  { href: "/content", label: "콘텐츠" },
  { href: "/popups", label: "팝업" },
  { href: "/reports", label: "신고·제재" },
  { href: "/statistics", label: "통계" },
  { href: "/audit-logs", label: "감사 로그" },
  { href: "/operations/search-index", label: "검색 인덱스" },
  { href: "/operations/business-verifications", label: "매장 사업자 인증" },
  { href: "/settings", label: "설정·운영" },
] as const;

export function isActiveAdminRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
