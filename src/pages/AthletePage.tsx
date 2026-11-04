import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Trophy, UserRound } from "lucide-react";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/site/PageHero";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/site/primitives";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { formatDateRange } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function AthletePage() {
  const { id = "" } = useParams();
  const athlete = useAsync((signal) => api.public.athlete(id, signal), [id]);
  const item = athlete.data?.item;
  const history = item?.results ?? [];

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
        description="Год рождения, спортивный разряд и история мест на соревнованиях."
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
