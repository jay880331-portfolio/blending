import Link from "next/link";
import { getPageWindow, patchListQuery } from "../../domain/listQuery";
export function Pagination({
  page,
  totalPages,
  query = "",
}: {
  page: number;
  totalPages: number;
  query?: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="페이지">
      <ol>
        {getPageWindow(page, totalPages).map((p) => (
          <li key={p}>
            <Link
              aria-current={p === page ? "page" : undefined}
              href={patchListQuery(query, { page: String(p) })}
            >
              {p}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
