import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays, RotateCcw, Search, Trophy } from "lucide-react";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/site/PageHero";
import { CompetitionCard } from "@/components/site/cards";
import { EmptyState, ErrorState, LoadingBlock, Reveal } from "@/components/site/primitives";
import { Pagination } from "@/components/site/Pagination";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { COMPETITION_STATUSES } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 9;

export default function CompetitionsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const query = params.get("q") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const [search, setSearch] = useState(query);

  useEffect(() => setSearch(query), [query]);

  const competitions = useAsync(
    (signal) =>
      api.public.competitions(
        { status, q: query, from, to, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, sort: status === "finished" ? "date_desc" : "asc" },
        signal,
      ),
    [status, query, from, to, page],
  );

  const update = (next: Record<string, string | undefined>) => {
    const merged = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value) merged.set(key, value);
      else merged.delete(key);
    }
    setParams(merged, { replace: true });
  };

  const hasDemo = competitions.data?.items.some((item) => item.is_demo) ?? false;
  const hasFilters = Boolean(status || query || from || to);

  return (
    <>
      <Seo
        title="Календарь соревнований по настольному теннису — Гродненская область"
        description="Календарь соревнований по настольному теннису: даты, места проведения, возрастные категории, положения и результаты турниров Гродненской ОСДЮШОР."
        path="/kalendar"
        image="/images/awards.jpg"
      />
      <PageHero
        label="Календарь соревнований"
        title="Турниры и спортивный календарь"
        description="Предстоящие, текущие и завершённые соревнования. Для каждого турнира публикуются положение, возрастные категории и результаты после подведения итогов."
        crumbs={[{ label: "Соревнования", to: "/kalendar" }, { label: "Календарь" }]}
        compact
      >
        <Link to="/rezultaty" className="btn btn-light">
          <Trophy size={16} aria-hidden="true" /> Результаты соревнований
        </Link>
      </PageHero>

      <section className="section bg-white">
        <div className="container-site">
          <div className="border border-navy-100 bg-mist p-5">
            <div className="flex flex-wrap gap-2">
              <button type="button" className={cn("chip", !status && "chip-active")} onClick={() => update({ status: undefined, page: undefined })}>
                Все статусы
              </button>
              {COMPETITION_STATUSES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={cn("chip", status === item.value && "chip-active")}
                  onClick={() => update({ status: item.value, page: undefined })}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <form
              className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                update({ q: search.trim() || undefined, page: undefined });
              }}
            >
              <div>
                <label htmlFor="comp-search" className="sr-only">Поиск соревнований</label>
                <div className="relative">
                  <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-graphite-400" aria-hidden="true" />
                  <input
                    id="comp-search"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Название или место"
                    className="field-input pl-10"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="comp-from" className="sr-only">С даты</label>
                <input id="comp-from" type="date" value={from} onChange={(event) => update({ from: event.target.value || undefined, page: undefined })} className="field-input" />
              </div>
              <div>
                <label htmlFor="comp-to" className="sr-only">По дату</label>
                <input id="comp-to" type="date" value={to} onChange={(event) => update({ to: event.target.value || undefined, page: undefined })} className="field-input" />
              </div>
              <button type="submit" className="btn btn-outline">Найти</button>
            </form>
            {hasFilters && (
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-graphite-500 hover:text-accent-600"
                onClick={() => {
                  setSearch("");
                  setParams({}, { replace: true });
                }}
              >
                <RotateCcw size={13} aria-hidden="true" /> Сбросить все фильтры
              </button>
            )}
          </div>

          {hasDemo && (
            <div className="mt-6 border border-accent-600/30 bg-accent-50 px-4 py-3 text-[13px] leading-relaxed text-accent-800">
              В календаре есть демонстрационные турниры — они помечены значком «Демо» и не являются официальными событиями.
            </div>
          )}

          <div className="mt-8">
            {competitions.loading && <LoadingBlock rows={4} />}
            {competitions.error && <ErrorState message={competitions.error} onRetry={competitions.reload} />}
            {!competitions.loading && !competitions.error && competitions.data && competitions.data.items.length === 0 && (
              <EmptyState
                icon={<CalendarDays size={22} aria-hidden="true" />}
                title={hasFilters ? "Соревнования не найдены" : "Календарь формируется"}
                text={
                  hasFilters
                    ? "Измените период или статус — возможно, подходящих турниров пока нет."
                    : "Официальный календарь появится здесь после утверждения. Следите за объявлениями школы."
                }
                action={
                  hasFilters ? (
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setParams({}, { replace: true })}>
                      Сбросить фильтры
                    </button>
                  ) : (
                    <Link to="/novosti" className="btn btn-outline btn-sm">Читать новости</Link>
                  )
                }
              />
            )}
            {competitions.data && competitions.data.items.length > 0 && (
              <>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {competitions.data.items.map((item, index) => (
                    <Reveal key={item.id} delay={index * 40}>
                      <CompetitionCard item={item} detailed />
                    </Reveal>
                  ))}
                </div>
                <Pagination
                  offset={(page - 1) * PAGE_SIZE}
                  limit={PAGE_SIZE}
                  total={competitions.data.total}
                  onChange={(offset) => update({ page: String(Math.floor(offset / PAGE_SIZE) + 1) })}
                />
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
