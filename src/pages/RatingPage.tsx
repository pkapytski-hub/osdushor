import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Trophy, X } from "lucide-react";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/site/PageHero";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/site/primitives";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { cn } from "@/lib/utils";

export default function RatingPage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const rating = useAsync((signal) => api.public.rating({ q: query, year }, signal), [query, year]);
  const items = rating.data?.items ?? [];

  return (
    <>
      <Seo
        title="Рейтинг спортсменов — Гродненская ОСДЮШОР им. Ю. К. Культиясова"
        description="Текущий рейтинг воспитанников школы настольного тенниса в Гродно. Рейтинг пересчитывается после каждого турнира по результатам встреч."
        path="/reyting"
      />
      <PageHero
        label="Спортсмены"
        title="Рейтинг школы"
        description="Рейтинг обновляется после подведения итогов турнира. В расчёт идёт каждая встреча: чем сильнее соперник, тем больше очков можно получить за победу."
        crumbs={[{ label: "Соревнования", to: "/turniry" }, { label: "Рейтинг" }]}
        compact
      >
        <Link to="/turniry" className="btn btn-light">
          Турниры и архив <Trophy size={15} aria-hidden="true" />
        </Link>
      </PageHero>

      <section className="section bg-white">
        <div className="container-site">
          <div className="flex flex-col gap-5 border-b border-navy-100 pb-6">
            <form
              className="flex max-w-xl gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setQuery(search.trim());
              }}
              role="search"
            >
              <label htmlFor="rating-search" className="sr-only">Поиск спортсмена</label>
              <div className="relative flex-1">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-graphite-400" aria-hidden="true" />
                <input
                  id="rating-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Фамилия или имя"
                  className="field-input pl-10"
                />
                {search && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-graphite-400 hover:text-navy-900"
                    onClick={() => setSearch("")}
                    aria-label="Очистить поиск"
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
            </form>
            {(rating.data?.years.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-2">
                <button type="button" className={cn("chip", !year && "chip-active")} onClick={() => setYear("")}>
                  Все годы рождения
                </button>
                {rating.data?.years.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={cn("chip", year === String(value) && "chip-active")}
                    onClick={() => setYear(String(value))}
                  >
                    {value}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8">
            {rating.loading && <LoadingBlock rows={5} />}
            {rating.error && <ErrorState message={rating.error} onRetry={rating.reload} />}
            {!rating.loading && !rating.error && items.length === 0 && (
              <EmptyState
                icon={<Trophy size={22} aria-hidden="true" />}
                title="Рейтинг пока не сформирован"
                text="Таблица появится, когда администрация добавит спортсменов и проведёт первый турнир."
                action={<Link to="/turniry" className="btn btn-outline btn-sm">Перейти к турнирам</Link>}
              />
            )}
            {items.length > 0 && (
              <>
                <div className="hidden overflow-x-auto border border-navy-100 md:block">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-mist text-[10px] uppercase tracking-[0.14em] text-graphite-500">
                      <tr>
                        <th scope="col" className="w-20 px-4 py-3 font-medium">Место</th>
                        <th scope="col" className="px-4 py-3 font-medium">Спортсмен</th>
                        <th scope="col" className="px-4 py-3 font-medium">Лига</th>
                        <th scope="col" className="px-4 py-3 font-medium">Год рождения</th>
                        <th scope="col" className="px-4 py-3 text-right font-medium">Рейтинг</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-100">
                      {items.map((item) => (
                        <tr key={item.id} className={cn("hover:bg-mist/50", item.place <= 3 && "bg-mist/40")}>
                          <td className="px-4 py-3">
                            <span className={cn("font-display text-lg", item.place === 1 ? "text-accent-600" : "text-navy-900")}>
                              {item.place}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-navy-900">{item.full_name}</td>
                          <td className="px-4 py-3 text-graphite-600">{item.league} лига</td>
                          <td className="px-4 py-3 text-graphite-600">{item.birth_year ?? "—"}</td>
                          <td className="px-4 py-3 text-right font-display text-base text-navy-900">
                            {item.rating.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="divide-y divide-navy-100 border border-navy-100 md:hidden">
                  {items.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 p-4">
                      <span className={cn("w-8 shrink-0 font-display text-lg", item.place <= 3 ? "text-accent-600" : "text-graphite-500")}>
                        {item.place}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-navy-900">{item.full_name}</p>
                        <p className="text-xs text-graphite-500">
                          {item.league} лига · {item.birth_year ?? "год не указан"}
                        </p>
                      </div>
                      <span className="font-display text-base text-navy-900">{item.rating.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 border-l-2 border-navy-300 bg-mist px-4 py-3 text-xs leading-relaxed text-graphite-600">
                  <p className="font-medium text-navy-900">Как считается рейтинг</p>
                  <p className="mt-1">
                    Разница считается как «рейтинг победителя − рейтинг проигравшего» на начало турнира.
                    Победа: (100 − разница) / 10 × коэффициент турнира. Поражение: (100 − разница) / 20 × коэффициент.
                    Если разница 100 и больше, встреча рейтинг не меняет. Итог — сумма по всем встречам, округлённая до 0,1.
                  </p>
                  <p className="mt-2">
                    На турнирах спортсмены делятся на лиги по месту в этом рейтинге: 1 лига — места 1–50,
                    2 лига — 51–70, 3 лига — с 71-го и ниже. Лига определяет только время игры:
                    1 лига обычно играет в 9:00, 2 и 3 — в 12:00. Группы на турнире набираются подряд
                    по рейтингу, без «змейки» и без разделения по лигам, поэтому спортсмены разных лиг
                    могут встретиться в одной группе.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
