export function ListFilterForm({
  children,
  onSubmit,
}: {
  children: React.ReactNode;
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
}) {
  return (
    <form className="list-filter" onSubmit={onSubmit}>
      {children}
      <button type="submit">검색</button>
    </form>
  );
}
