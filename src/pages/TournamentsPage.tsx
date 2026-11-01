import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, Trophy, Users } from "lucide-react";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/site/PageHero";
import { EmptyState, ErrorState, LoadingBlock, Reveal } from "@/components/site/primitives";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function TournamentsPage() {
  const [year, setYear] = useState("");
  const list = useAsync((signal) => api.public.tournaments({ year }, signal), [year]);
  const items = list.data?.items ?? [];
  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const key = item.held_on.slice(0, 4);
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  }

  return (
    <>
      <Seo
        title="Турниры школы — результаты и архив — Гродненская ОСДЮШОР"
        description="Турниры по настольному теннису Гродненской ОСДЮШОР: участники, группы, сетки, результаты встреч, итоговые места и изменения рейтинга."
        path="/turniry"
      />
      <PageHero
        label="Соревнования"
        title="Турниры школы"
        description="Регулярные субботние турниры воспитанников: лиги по силе, составы, таблицы групп, сетки плей-офф, результаты встреч и рейтинг. Архив сохраняется по годам."
        crumbs={[{ label: "Соревнования", to: "/turniry" }, { label: "Турниры" }]}
        compact
      >
        <Link to="/reyting" className="btn btn-light">
          Текущий рейтинг <Trophy size={15} aria-hidden="true" />
        </Link>
      </PageHero>

      <section className="section bg-white">
        <div className="container-site">
          {(list.data?.years.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2 border-b border-navy-100 pb-6">
              <button type="button" className={cn("chip", !year && "chip-active")} onClick={() => setYear("")}>
                Все годы
              </button>
              {list.data?.years.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={cn("chip", year === value && "chip-active")}
                  onClick={() => setYear(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          )}

          <div className="mt-8">
            {list.loading && <LoadingBlock rows={4} />}
            {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
            {!list.loading && !list.error && items.length === 0 && (
              <EmptyState
                icon={<CalendarDays size={22} aria-hidden="true" />}
                title="Турниров пока нет"
                text="Здесь появятся протоколы турниров: составы, таблицы, результаты и изменения рейтинга."
              />
            )}
            {items.length > 0 && (
              <div className="space-y-12">
                {[...groups.entries()].map(([groupYear, tournaments]) => (
                  <section key={groupYear}>
                    <div className="flex items-center gap-4">
                      <h2 className="font-display text-3xl text-navy-900">{groupYear}</h2>
                      <span className="h-px flex-1 bg-navy-100" aria-hidden="true" />
                      <span className="text-xs uppercase tracking-[0.14em] text-graphite-400">
                        {tournaments.length} {tournaments.length === 1 ? "турнир" : tournaments.length < 5 ? "турнира" : "турниров"}
                      </span>
                    </div>
                    <div className="mt-5 space-y-4">
                      {tournaments.map((item, index) => (
                        <Reveal key={item.id} delay={index * 40}>
                          <article className="border border-navy-100 bg-white p-5 transition-colors hover:border-navy-300 sm:p-6">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-graphite-500">
                                  {formatDate(item.held_on)}
                                </p>
                                <h3 className="mt-1 text-xl">
                                  <Link to={`/turniry/${item.id}`} className="transition-colors hover:text-accent-600">
                                    {item.title}
                                  </Link>
                                </h3>
                                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-graphite-600">
                                  <span className="inline-flex items-center gap-1.5">
                                    <Users size={14} aria-hidden="true" /> {item.participants ?? 0} участников
                                  </span>
                                  {item.winner && (
                                    <span className="inline-flex items-center gap-1.5 text-accent-700">
                                      <Trophy size={14} aria-hidden="true" /> Победитель: {item.winner}
                                    </span>
                                  )}
                                  {!item.is_finished && <span className="text-xs text-graphite-500">Итоги не подведены</span>}
                                </div>
                              </div>
                              <Link to={`/turniry/${item.id}`} className="btn btn-primary btn-sm shrink-0">
                                Результаты <ArrowRight size={14} aria-hidden="true" />
                              </Link>
                            </div>
                          </article>
                        </Reveal>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
