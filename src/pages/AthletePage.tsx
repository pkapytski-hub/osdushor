import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Trophy, UserRound } from "lucide-react";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/site/PageHero";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/site/primitives";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { formatDateRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AthleteProfileMatch } from "@/lib/types";

/** Фильтры по столбцам таблицы встреч: подстрока без учёта регистра. */
type MatchFilters = {
  held_on: string;
  competition: string;
  opponent_name: string;
  opponent_city: string;
  opponent_birth_year: string;
  opponent_rank: string;
  result: string;
};

const EMPTY_FILTERS: MatchFilters = {
  held_on: "",
  competition: "",
  opponent_name: "",
  opponent_city: "",
  opponent_birth_year: "",
  opponent_rank: "",
  result: "",
};

const hasText = (value: string | number | null | undefined, query: string) =>
  !query || String(value ?? "").toLowerCase().includes(query.trim().toLowerCase());

const matchesFilters = (match: AthleteProfileMatch, filters: MatchFilters) =>
  hasText(match.held_on, filters.held_on) &&
  hasText(match.competition_title ?? match.source_title, filters.competition) &&
  hasText(match.opponent_name, filters.opponent_name) &&
  hasText(match.opponent_city, filters.opponent_city) &&
  hasText(match.opponent_birth_year, filters.opponent_birth_year) &&
  hasText(match.opponent_rank, filters.opponent_rank) &&
  (!filters.result || match.result === filters.result);

export default function AthletePage() {
  const { id = "" } = useParams();
  const athlete = useAsync((signal) => api.public.athlete(id, signal), [id]);
  const item = athlete.data?.item;
  const history = item?.results ?? [];
  const matches = item?.matches ?? [];
  const [filters, setFilters] = useState<MatchFilters>(EMPTY_FILTERS);
  const shownMatches = useMemo(() => matches.filter((match) => matchesFilters(match, filters)), [matches, filters]);
  const filterActive = Object.values(filters).some(Boolean);

  const facts = item
    ? [
        { label: "Год рождения", value: item.birth_year ? String(item.birth_year) : "" },
        { label: "Разряд", value: item.sport_rank ?? "" },
      ].filter((fact) => fact.value)
    : [];

  return (
    <>
      <Seo
        title={item ? `${item.full_name} — спортсмен школы` : "Спортсмен — Гродненская ОСДЮШОР"}
        description={
          item
            ? `${item.full_name}: спортсмен Гродненской ОСДЮШОР им. Ю. К. Культиясова, настольный теннис, результаты выступлений.`
            : "Карточка спортсмена Гродненской ОСДЮШОР им. Ю. К. Культиясова: год рождения, разряд и история выступлений."
        }
        path={`/sportsmeny/${id}`}
      />
      <PageHero
        label="Спортсмен"
        title={item?.full_name ?? "Карточка спортсмена"}
        description="Год рождения, спортивный разряд, история мест и личные встречи на соревнованиях."
        crumbs={[{ label: "Спортсмены", to: "/sportsmeny" }, { label: item?.full_name ?? "Карточка" }]}
        compact
      >
        <Link to="/sportsmeny" className="btn btn-light">
          <ArrowLeft size={16} aria-hidden="true" /> Все спортсмены
        </Link>
      </PageHero>

      <section className="section bg-white">
        <div className="container-site">
          {athlete.loading && <LoadingBlock rows={3} />}
          {athlete.error && <ErrorState message={athlete.error} onRetry={athlete.reload} />}
          {item && (
            <div className="space-y-10">
              {facts.length > 0 && (
                <dl className="grid gap-4 border border-navy-100 bg-mist/40 p-5 sm:grid-cols-2">
                  {facts.map((fact) => (
                    <div key={fact.label}>
                      <dt className="text-[10px] uppercase tracking-[0.14em] text-graphite-500">{fact.label}</dt>
                      <dd className="mt-1 text-sm font-medium text-navy-900">{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {matches.length > 0 && (
                <section>
                  <div className="flex items-center gap-4">
                    <h2 className="font-display text-2xl text-navy-900">Личные встречи</h2>
                    <span className="h-px flex-1 bg-navy-100" aria-hidden="true" />
                    <span className="text-xs uppercase tracking-[0.14em] text-graphite-400">
                      {shownMatches.length === matches.length
                        ? `${matches.length} ${matches.length === 1 ? "встреча" : matches.length < 5 ? "встречи" : "встреч"}`
                        : `${shownMatches.length} из ${matches.length}`}
                    </span>
                  </div>

                  <div className="mt-6 overflow-x-auto border border-navy-100">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead className="bg-mist text-[10px] uppercase tracking-[0.14em] text-graphite-500">
                        <tr>
                          <th scope="col" className="whitespace-nowrap px-4 py-3 font-medium">Дата</th>
                          <th scope="col" className="px-4 py-3 font-medium">Соревнование</th>
                          <th scope="col" className="px-4 py-3 font-medium">Соперник</th>
                          <th scope="col" className="px-4 py-3 font-medium">Город</th>
                          <th scope="col" className="px-4 py-3 font-medium">Год рожд.</th>
                          <th scope="col" className="px-4 py-3 font-medium">Разряд</th>
                          <th scope="col" className="px-4 py-3 text-right font-medium">Результат</th>
                        </tr>
                        <tr className="bg-white normal-case tracking-normal">
                          {[
                            { key: "held_on", label: "2026", align: "" },
                            { key: "competition", label: "Название", align: "" },
                            { key: "opponent_name", label: "Фамилия", align: "" },
                            { key: "opponent_city", label: "Город", align: "" },
                            { key: "opponent_birth_year", label: "Год", align: "" },
                            { key: "opponent_rank", label: "Разряд", align: "" },
                          ].map((column) => (
                            <th key={column.key} className="px-2 py-2 font-normal">
                              <label className="sr-only" htmlFor={`match-${column.key}`}>
                                Фильтр: {column.label}
                              </label>
                              <input
                                id={`match-${column.key}`}
                                type="search"
                                value={filters[column.key as keyof MatchFilters]}
                                onChange={(event) =>
                                  setFilters((current) => ({ ...current, [column.key]: event.target.value }))
                                }
                                placeholder={column.label}
                                className="field-input px-2 py-1.5 text-xs normal-case tracking-normal"
                              />
                            </th>
                          ))}
                          <th className="px-2 py-2 font-normal">
                            <label className="sr-only" htmlFor="match-result">
                              Фильтр: результат
                            </label>
                            <select
                              id="match-result"
                              value={filters.result}
                              onChange={(event) => setFilters((current) => ({ ...current, result: event.target.value }))}
                              className="field-input px-2 py-1.5 text-xs normal-case tracking-normal"
                            >
                              <option value="">Все</option>
                              <option value="win">Победа</option>
                              <option value="loss">Поражение</option>
                            </select>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-navy-100">
                        {shownMatches.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-4 py-6 text-center text-sm text-graphite-500">
                              Под фильтры ничего не подошло.
                            </td>
                          </tr>
                        )}
                        {shownMatches.map((match) => (
                          <tr key={match.id} className="hover:bg-mist/50">
                            <td className="whitespace-nowrap px-4 py-3 text-graphite-600">
                              {match.held_on ? formatDateRange(match.held_on, null) : "—"}
                            </td>
                            <td className="px-4 py-3">
                              {match.competition_slug ? (
                                <Link
                                  to={`/kalendar/${match.competition_slug}`}
                                  className="text-graphite-600 transition-colors hover:text-accent-600"
                                >
                                  {match.competition_title ?? match.source_title}
                                </Link>
                              ) : (
                                <span className="text-graphite-600">{match.competition_title ?? match.source_title}</span>
                              )}
                              {match.stage && <p className="text-xs text-graphite-500">{match.stage}</p>}
                            </td>
                            <td className="px-4 py-3 font-medium text-navy-900">{match.opponent_name}</td>
                            <td className="px-4 py-3 text-graphite-600">{match.opponent_city ?? "—"}</td>
                            <td className="px-4 py-3 text-graphite-600">{match.opponent_birth_year ?? "—"}</td>
                            <td className="px-4 py-3 text-graphite-600">{match.opponent_rank ?? "—"}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">
                              <span
                                className={cn(
                                  "font-medium",
                                  match.result === "win" ? "text-navy-900" : "text-graphite-500",
                                )}
                              >
                                {match.result === "win" ? "Победа" : match.result === "loss" ? "Поражение" : "—"}
                              </span>
                              {match.score && (
                                <span className="ml-2 font-display text-base text-navy-900">{match.score}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filterActive && (
                    <button
                      type="button"
                      onClick={() => setFilters(EMPTY_FILTERS)}
                      className="mt-3 text-sm font-medium text-navy-900 transition-colors hover:text-accent-600"
                    >
                      Сбросить фильтры
                    </button>
                  )}
                </section>
              )}

              <section>
                <div className="flex items-center gap-4">
                  <h2 className="font-display text-2xl text-navy-900">История выступлений</h2>
                  <span className="h-px flex-1 bg-navy-100" aria-hidden="true" />
                  <span className="text-xs uppercase tracking-[0.14em] text-graphite-400">
                    {history.length} {history.length === 1 ? "соревнование" : history.length < 5 ? "соревнования" : "соревнований"}
                  </span>
                </div>

                {history.length === 0 ? (
                  <div className="mt-6">
                    <EmptyState
                      icon={<Trophy size={22} aria-hidden="true" />}
                      title="История выступлений пока пуста"
                      text="Места на соревнованиях появятся после загрузки архива результатов."
                      action={<Link to="/rezultaty" className="btn btn-outline btn-sm">Результаты соревнований</Link>}
                    />
                  </div>
                ) : (
                  <ul className="mt-5 divide-y divide-navy-100 border-y border-navy-100">
                    {history.map((row) => {
                      const date = row.held_on || row.starts_on
                        ? formatDateRange(row.held_on ?? row.starts_on ?? "", null)
                        : "";
                      const subtitle = [date, row.age_category].filter(Boolean).join(" · ");
                      const title = row.competition_title ?? row.source_title;
                      return (
                        <li key={row.id} className="flex items-start gap-4 py-3">
                          <span
                            className={cn(
                              "w-7 shrink-0 text-right font-display text-lg leading-6",
                              row.place === 1 ? "text-accent-600" : "text-navy-900",
                            )}
                          >
                            {row.place ?? "—"}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-6 text-navy-900">
                              {row.competition_slug ? (
                                <Link
                                  to={`/kalendar/${row.competition_slug}`}
                                  className="transition-colors hover:text-accent-600"
                                >
                                  {title}
                                </Link>
                              ) : (
                                title
                              )}
                            </p>
                            {subtitle && <p className="text-xs text-graphite-500">{subtitle}</p>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <Link
                to="/reyting"
                className="inline-flex items-center gap-2 text-sm font-medium text-navy-900 transition-colors hover:text-accent-600"
              >
                <UserRound size={16} aria-hidden="true" /> Текущий рейтинг школы
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
