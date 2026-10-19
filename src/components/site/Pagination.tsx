import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({
  offset,
  limit,
  total,
  onChange,
}: {
  offset: number;
  limit: number;
  total: number;
  onChange: (offset: number) => void;
}) {
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.ceil(total / limit);
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  return (
    <nav className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-navy-100 pt-6 sm:flex-row" aria-label="Постраничная навигация">
      <p className="text-sm text-graphite-500">
        Показано {from}–{to} из {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={page <= 1}
          onClick={() => onChange(Math.max(0, offset - limit))}
          aria-label="Предыдущая страница"
        >
          <ChevronLeft size={16} aria-hidden="true" /> Назад
        </button>
        <div className="hidden items-center gap-1 sm:flex">
          {Array.from({ length: pages }).slice(0, 9).map((_, index) => {
            const number = index + 1;
            return (
              <button
                key={number}
                type="button"
                onClick={() => onChange((number - 1) * limit)}
                className={cn(
                  "h-9 min-w-9 border px-2 font-display text-sm transition-colors",
                  page === number
                    ? "border-navy-900 bg-navy-900 text-white"
                    : "border-navy-200 bg-white text-navy-800 hover:border-navy-900",
                )}
                aria-current={page === number ? "page" : undefined}
                aria-label={`Страница ${number}`}
              >
                {number}
              </button>
            );
          })}
          {pages > 9 && <span className="px-1 text-graphite-400">…</span>}
        </div>
        <span className="text-sm text-graphite-500 sm:hidden">
          {page} / {pages}
        </span>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={page >= pages}
          onClick={() => onChange(offset + limit)}
          aria-label="Следующая страница"
        >
          Вперёд <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
