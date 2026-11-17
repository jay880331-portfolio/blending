export type DataColumn<T> = {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
};
export function DataTable<T>({
  columns,
  rows,
  caption = "데이터 목록",
  sort,
  onSort,
}: {
  columns: DataColumn<T>[];
  rows: T[];
  caption?: string;
  sort?: string;
  onSort?: (key: string) => void;
}) {
  return (
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} aria-sort={sort === c.key ? "ascending" : "none"}>
              {c.sortable ? (
                <button onClick={() => onSort?.(c.key)}>{c.label}</button>
              ) : (
                c.label
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={Math.max(1, columns.length)}>
              표시할 항목이 없습니다.
            </td>
          </tr>
        ) : (
          rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key}>
                  {c.render
                    ? c.render(r)
                    : String((r as Record<string, unknown>)[c.key] ?? "")}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
