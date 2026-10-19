import { Link } from "react-router-dom";
import { ArrowRight, FileText, Trophy } from "lucide-react";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/site/PageHero";
import { api, fileUrl } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { EmptyState, ErrorState, LoadingBlock, Reveal } from "@/components/site/primitives";
import { formatDateRange, parseDate } from "@/lib/format";
import type { Competition } from "@/lib/types";

export default function ResultsPage() {
  const results = useAsync((signal) => api.public.results(signal), []);
  const groups = new Map<string, Competition[]>();
  if (results.data) {
    for (const item of results.data.items) {
      const year = String(parseDate(item.starts_on)?.getFullYear() ?? "Без года");
      const list = groups.get(year) ?? [];
      list.push(item);
      groups.set(year, list);
    }
  }
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
          {!results.loading && !results.error && results.data && results.data.items.length === 0 && (
            <EmptyState
              icon={<Trophy size={22} aria-hidden="true" />}
              title="Результаты готовятся к публикации"
              text="Здесь появятся итоги завершённых турниров и ссылки на протоколы. Мы не публикуем неподтверждённые места и фамилии."
              action={<Link to="/kalendar" className="btn btn-outline btn-sm">Перейти в календарь</Link>}
            />
          )}
          {results.data && results.data.items.length > 0 && (
            <div className="space-y-12">
              {[...groups.entries()].map(([year, items]) => (
                <section key={year}>
                  <div className="flex items-center gap-4">
                    <h2 className="font-display text-3xl text-navy-900">{year}</h2>
                    <span className="h-px flex-1 bg-navy-100" aria-hidden="true" />
                    <span className="text-xs uppercase tracking-[0.14em] text-graphite-400">
                      {items.length} {items.length === 1 ? "турнир" : items.length < 5 ? "турнира" : "турниров"}
                    </span>
                  </div>
                  <div className="mt-5 space-y-4">
                    {items.map((item, index) => {
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
        </div>
      </section>
    </>
  );
}
