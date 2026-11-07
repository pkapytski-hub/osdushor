import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FileText, Trophy } from "lucide-react";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/site/PageHero";
import { api, fileUrl } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { EmptyState, ErrorState, LoadingBlock, Reveal } from "@/components/site/primitives";
import { formatDateRange, parseDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Competition } from "@/lib/types";

export default function ResultsPage() {
  const results = useAsync((signal) => api.public.results(signal), []);
  const archive = useAsync((signal) => api.public.archive(signal), []);

  const items = results.data?.items ?? [];
  const archiveItems = archive.data?.items ?? [];
  const [resultsYear, setResultsYear] = useState("");
  const [archiveYear, setArchiveYear] = useState("");

  const archiveYears = [
    ...new Set(
      archiveItems
        .map((item) => parseDate(item.starts_on)?.getFullYear())
        .filter((year): year is number => typeof year === "number"),
    ),
  ].sort((a, b) => b - a);
  const visibleArchive = archiveYear
    ? archiveItems.filter(
        (item) => String(parseDate(item.starts_on)?.getFullYear() ?? "") === archiveYear,
      )
    : archiveItems;

  const groups = new Map<string, Competition[]>();
  for (const item of items) {
    const year = String(parseDate(item.starts_on)?.getFullYear() ?? "Без года");
    const list = groups.get(year) ?? [];
    list.push(item);
    groups.set(year, list);
  }
  const resultsYears = [...groups.keys()]
    .filter((year) => /^\d{4}$/.test(year))
    .map(Number)
    .sort((a, b) => b - a);
  const visibleGroups = resultsYear
    ? [...groups.entries()].filter(([year]) => year === resultsYear)
    : [...groups.entries()];
  const nothingYet = !results.loading && !results.error && !archive.loading && items.length === 0;

  return (
    <>
      <Seo
        title="Результаты соревнований — настольный теннис, Гродно"
        description="Результаты соревнований по настольному теннису и достижения воспитанников Гродненской ОСДЮШОР им. Ю. К. Культиясова. Опубликованные протоколы и итоги турниров."
        path="/rezultaty"
        image="/images/awards.jpg"
      />
      <PageHero
        label="Результаты"
        title="Итоги соревнований"
        description="Только подтверждённые результаты и прикреплённые протоколы. Итоги публикуются после завершения турнира и проверки данных."
        crumbs={[{ label: "Соревнования", to: "/kalendar" }, { label: "Результаты" }]}
        compact
      >
        <Link to="/kalendar" className="btn btn-light">
          Календарь соревнований <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </PageHero>

      <section className="section bg-white">
        <div className="container-site">
          {results.loading && <LoadingBlock rows={3} />}
          {results.error && <ErrorState message={results.error} onRetry={results.reload} />}
          {nothingYet && (
            <EmptyState
              icon={<Trophy size={22} aria-hidden="true" />}
              title="Результаты готовятся к публикации"
              text="Здесь появятся итоги завершённых турниров и ссылки на протоколы. Мы не публикуем неподтверждённые места и фамилии."
              action={<Link to="/kalendar" className="btn btn-outline btn-sm">Перейти в календарь</Link>}
            />
          )}
          {groups.size > 0 && resultsYears.length > 1 && (
            <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Фильтр результатов по году">
              <button
                type="button"
                className={cn("chip", !resultsYear && "chip-active")}
                aria-pressed={!resultsYear}
                onClick={() => setResultsYear("")}
              >
                Все годы
              </button>
              {resultsYears.map((year) => (
                <button
                  key={year}
                  type="button"
                  className={cn("chip", resultsYear === String(year) && "chip-active")}
                  aria-pressed={resultsYear === String(year)}
                  onClick={() => setResultsYear(String(year))}
                >
                  {year}
                </button>
              ))}
            </div>
          )}
          {groups.size > 0 && (
            <div className="space-y-12">
              {visibleGroups.map(([year, yearItems]) => (
                <section key={year}>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <h2 className="font-display text-3xl text-navy-900">{year}</h2>
                    <span className="h-px flex-1 bg-navy-100" aria-hidden="true" />
                    <span className="text-xs uppercase tracking-[0.14em] text-graphite-400">
                      {yearItems.length} {yearItems.length === 1 ? "турнир" : yearItems.length < 5 ? "турнира" : "турниров"}
                    </span>
                  </div>
                  <div className="mt-5 space-y-4">
                    {yearItems.map((item, index) => {
                      const href = fileUrl(item.results_path);
                      return (
                        <Reveal key={item.id} delay={index * 40}>
                          <article className="border border-navy-100 bg-white p-5 sm:p-6">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-graphite-500">{formatDateRange(item.starts_on, item.ends_on)}</p>
                                <h3 className="mt-1 text-xl">
                                  <Link to={`/kalendar/${item.slug}`} className="transition-colors hover:text-accent-600">{item.title}</Link>
                                </h3>
                                <p className="mt-1 text-sm text-graphite-600">{item.location}</p>
                                {item.results_text && (
                                  <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-graphite-700">{item.results_text}</p>
                                )}
                              </div>
                              <div className="flex shrink-0 flex-wrap gap-2">
                                {href && (
                                  <a href={href} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                                    <FileText size={15} aria-hidden="true" /> Протокол
                                  </a>
                                )}
                                <Link to={`/kalendar/${item.slug}`} className="btn btn-primary btn-sm">
                                  Подробнее <ArrowRight size={14} aria-hidden="true" />
                                </Link>
                              </div>
                            </div>
                            {item.is_demo && (
                              <p className="mt-4 border-l-2 border-accent-600 pl-3 text-xs text-accent-700">
                                Демонстрационный результат. Не является официальным итогом турнира.
                              </p>
                            )}
                          </article>
                        </Reveal>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}

          {archive.loading && items.length > 0 && <LoadingBlock rows={2} />}
          {archiveItems.length > 0 && (
            <div className="mt-16">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <h2 className="font-display text-3xl text-navy-900">Архив выступлений</h2>
                <span className="h-px flex-1 bg-navy-100" aria-hidden="true" />
                <span className="text-xs uppercase tracking-[0.14em] text-graphite-400">
                  {visibleArchive.length} {visibleArchive.length === 1 ? "соревнование" : visibleArchive.length < 5 ? "соревнования" : "соревнований"}
                </span>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-graphite-600">
                Места воспитанников на соревнованиях календаря: слева место, справа имя. Имя ведёт в карточку спортсмена.
              </p>
              {archiveYears.length > 1 && (
                <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Фильтр архива по году">
                  <button
                    type="button"
                    className={cn("chip", !archiveYear && "chip-active")}
                    aria-pressed={!archiveYear}
                    onClick={() => setArchiveYear("")}
                  >
                    Все годы
                  </button>
                  {archiveYears.map((year) => (
                    <button
                      key={year}
                      type="button"
                      className={cn("chip", archiveYear === String(year) && "chip-active")}
                      aria-pressed={archiveYear === String(year)}
                      onClick={() => setArchiveYear(String(year))}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              )}
              <ul className="mt-6 divide-y divide-navy-100 border-y border-navy-100">
                {visibleArchive.map((item) => (
                  <li key={item.id} className="py-4">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-[11px] uppercase tracking-[0.16em] text-graphite-500">
                        {formatDateRange(item.starts_on, item.ends_on)}
                      </span>
                      <h3 className="text-base text-navy-900">
                        {item.slug ? (
                          <Link to={`/kalendar/${item.slug}`} className="transition-colors hover:text-accent-600">
                            {item.title}
                          </Link>
                        ) : (
                          item.title
                        )}
                      </h3>
                      {item.age_categories.length > 0 && (
                        <span className="text-xs text-graphite-500">{item.age_categories.join(", ")}</span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-graphite-700">
                      {item.results.map((row, index) => (
                        <span key={row.id} className="inline-block whitespace-nowrap">
                          {index > 0 && (
                            <span className="px-1.5 text-navy-200" aria-hidden="true">
                              ·
                            </span>
                          )}
                          {row.place != null && (
                            <>
                              <span className={cn("font-display", row.place === 1 ? "text-accent-600" : "text-navy-900")}>
                                {row.place}
                              </span>
                              <span className="text-graphite-400"> — </span>
                            </>
                          )}
                          <Link
                            to={`/sportsmeny/${row.athlete_id}`}
                            className="text-navy-900 transition-colors hover:text-accent-600"
                          >
                            {row.full_name}
                          </Link>
                        </span>
                      ))}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {archive.error && archiveItems.length === 0 && items.length > 0 && (
            <p className="mt-12 text-sm text-graphite-500">Архив выступлений временно недоступен.</p>
          )}
        </div>
      </section>
    </>
  );
}
