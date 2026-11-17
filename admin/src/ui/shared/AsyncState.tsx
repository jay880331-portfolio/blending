export function AsyncState({
  loading,
  error,
  children,
}: {
  loading?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  if (loading) return <p role="status">불러오는 중…</p>;
  if (error) return <p role="alert">{error}</p>;
  return <>{children}</>;
}
