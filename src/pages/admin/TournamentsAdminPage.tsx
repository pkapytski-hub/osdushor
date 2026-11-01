import { Link } from "react-router-dom";
import { CalendarDays, Plus, Trophy } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { AdminPageHeader } from "./admin-ui";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function TournamentsAdminPage() {
  const list = useAsync((signal) => api.admin.tournaments.list(signal), []);
  const items = list.data?.items ?? [];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Соревнования"
        title="Турниры"
        description="Проведение турниров: состав, жеребьёвка, результаты встреч, итоговые места и пересчёт рейтинга."
        actions={
          <Link to="/admin/tournaments/new" className="btn btn-primary btn-sm">
            <Plus size={15} aria-hidden="true" /> Новый турнир
          </Link>
        }
      />

      <div className="border border-navy-100 bg-white">
        {list.loading && (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse bg-navy-50" />
            ))}
          </div>
        )}
        {list.error && (
          <div className="p-6 text-sm text-accent-700">
            <p>{list.error}</p>
            <button type="button" className="btn btn-outline btn-sm mt-3" onClick={list.reload}>Повторить</button>
          </div>
        )}
        {!list.loading && !list.error && items.length === 0 && (
          <div className="p-10 text-center">
            <p className="font-display text-lg uppercase text-navy-900">Турниров пока нет</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-graphite-500">
              Создайте турнир, выберите участников из списка спортсменов и проведите жеребьёвку.
            </p>
            <Link to="/admin/tournaments/new" className="btn btn-primary btn-sm mt-4">
              <Plus size={14} aria-hidden="true" /> Создать турнир
            </Link>
          </div>
        )}
        {items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-mist text-[10px] uppercase tracking-[0.14em] text-graphite-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Турнир</th>
                  <th scope="col" className="px-4 py-3 font-medium">Дата</th>
                  <th scope="col" className="px-4 py-3 font-medium">Участники</th>
                  <th scope="col" className="px-4 py-3 font-medium">Победитель</th>
                  <th scope="col" className="px-4 py-3 font-medium">Статус</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-mist/50">
                    <td className="px-4 py-3 font-medium text-navy-900">{item.title}</td>
                    <td className="px-4 py-3 text-graphite-600">{formatDate(item.held_on)}</td>
                    <td className="px-4 py-3 text-graphite-600">{item.participants ?? 0}</td>
                    <td className="px-4 py-3 text-graphite-600">
                      {item.winner ? (
                        <span className="inline-flex items-center gap-1.5 text-accent-700">
                          <Trophy size={13} aria-hidden="true" /> {item.winner}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "badge",
                          item.is_finished
                            ? "border border-emerald-600/30 bg-emerald-50 text-emerald-800"
                            : "border border-graphite-300 bg-mist text-graphite-500",
                        )}
                      >
                        {item.is_finished ? "Итоги подведены" : item.is_published ? "Опубликован" : "Черновик"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/admin/tournaments/${item.id}`} className="btn btn-outline btn-sm">
                        Открыть
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="flex items-start gap-2 border-l-2 border-navy-300 bg-white px-4 py-3 text-xs leading-relaxed text-graphite-500">
        <CalendarDays size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
        Турнир становится виден на сайте после публикации. Итоги и рейтинг применяются кнопкой «Подвести итоги» —
        после этого результаты нельзя менять без отмены итогов.
      </p>
    </div>
  );
}
