export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="px-6 py-16 text-center">
      <p className="text-[16px] font-bold text-[var(--fg-strong)]">{title}</p>
      {description ? (
        <p className="mt-2 text-[14px] text-[var(--fg-muted)]">{description}</p>
      ) : null}
    </div>
  );
}
