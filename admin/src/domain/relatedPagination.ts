export function clampRelatedPage(page: number, totalPages: number) {
  return Math.min(page, Math.max(1, totalPages));
}
