export function patchListQuery(
  current: string,
  patch: Record<string, string | undefined>,
) {
  const params = new URLSearchParams(current.replace(/^\?/, ""));
  Object.entries(patch).forEach(([k, v]) =>
    v ? params.set(k, v) : params.delete(k),
  );
  if (Object.keys(patch).some((k) => k !== "page")) params.set("page", "1");
  const q = params.toString();
  return q ? `?${q}` : "";
}
export function getPageWindow(current: number, total: number) {
  const end = Math.max(1, total);
  const start = Math.max(1, Math.min(current - 2, end - 4));
  return Array.from({ length: Math.min(5, end) }, (_, i) => start + i);
}
