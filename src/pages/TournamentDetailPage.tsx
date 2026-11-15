import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, Trophy } from "lucide-react";
import { Seo } from "@/components/Seo";
import { Breadcrumbs } from "@/components/site/PageHero";
import { EmptyState, LoadingBlock } from "@/components/site/primitives";
import { CrossTable } from "@/components/CrossTable";
import { BracketView } from "@/components/BracketView";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { formatDate } from "@/lib/format";
import { cn, formatRating } from "@/lib/utils";
import type { TournamentMatch } from "@/lib/types";

function scoreText(match: TournamentMatch): string {
  if (match.score_a === null || match.score_b === null) return "—";
  // Техническая победа — как в протоколе: «w» у победителя и 0 у соперника.
  if (match.tech_loss_a) return "0:w";
  if (match.tech_loss_b) return "w:0";
  return `${match.score_a}:${match.score_b}`;
}

function MatchesTable({ matches }: { matches: TournamentMatch[] }) {
  return (
    <div className="divide-y divide-navy-100 border border-navy-100 bg-white">
      {matches.map((match) => {
        const winnerA = match.winner_id === match.player_a;
        const winnerB = match.winner_id === match.player_b;
        return (
          <div key={match.id} className="grid grid-cols-[2rem_1fr_auto_1fr] items-center gap-3 px-4 py-2.5 text-sm">
            <span className="text-[11px] tabular-nums text-graphite-400">{match.number ?? ""}</span>
            <span className={cn("truncate text-right", winnerA ? "font-semibold text-navy-900" : "text-graphite-600")}>
              {match.player_a_name}
            </span>
            <span className={cn("min-w-14 text-center font-display text-base", winnerA || winnerB ? "text-navy-900" : "text-graphite-400")}>
              {scoreText(match)}
            </span>
            <span className={cn("truncate", winnerB ? "font-semibold text-navy-900" : "text-graphite-600")}>
              {match.player_b_name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function GroupMatchesList({ matches }: { matches: TournamentMatch[] }) {
  const roundNumbers = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  if (roundNumbers.length <= 1) {
    return <MatchesTable matches={matches} />;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {roundNumbers.map((round) => {
        const roundMatches = matches.filter((m) => m.round === round);
        return (
          <div key={round} className="border border-navy-100 bg-white">
            <div className="border-b border-navy-100 bg-mist px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-graphite-700">
              {round}-й круг
            </div>
            <MatchesTable matches={roundMatches} />
          </div>
        );
      })}
    </div>
  );
}

/** Текстовые результаты спрятаны под раскрывающийся блок: основной вид — сетка и таблица. */
function ResultsToggle({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border border-navy-100 bg-white px-4 py-2.5 text-xs uppercase tracking-[0.12em] text-graphite-600 transition-colors hover:border-navy-200 hover:text-navy-900 [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown size={15} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function formatLabel(format: string): string {
  return format === "groups_playoff" ? "Группы + плей-офф" : format === "olympic" ? "Олимпийская система" : "Круговой турнир";
}

export default function TournamentDetailPage() {
  const { id = "" } = useParams();
  const tournament = useAsync((signal) => api.public.tournament(id, signal), [id]);

  if (tournament.loading) {
    return (
      <div className="container-site py-16">
        <LoadingBlock rows={4} />
      </div>
    );
  }
  if (tournament.error || !tournament.data) {
    return (
      <div className="container-site py-16">
        <Seo title="Турнир не найден — Гродненская ОСДЮШОР" description="Запрошенный турнир не найден." path={`/turniry/${id}`} noindex />
        <EmptyState
          title="Турнир не найден"
          text="Возможно, запись снята с публикации или адрес изменился."
          action={<Link to="/turniry" className="btn btn-outline btn-sm">Все турниры</Link>}
        />
      </div>
    );
  }

  const item = tournament.data.item;
  const t = item.tournament;
  // Место спортсмена появляется в сетке, как только он провёл последнюю встречу.
  const placeByAthlete = new Map(
    item.participants
      .filter((participant) => participant.place !== null)
      .map((participant) => [participant.athlete_id, Number(participant.place)]),
  );

  return (
    <>
      <Seo
        title={`${t.title} — результаты турнира`}
        description={`Турнир по настольному теннису ${t.title}: участники, встречи, итоговые места и изменения рейтинга.`}
        path={`/turniry/${t.id}`}
        type="article"
      />

      <div className="border-b border-navy-100 bg-mist">
        <div className="container-site py-4">
          <Breadcrumbs light={false} items={[{ label: "Турниры", to: "/turniry" }, { label: t.title }]} />
        </div>
      </div>

      <header className="border-b border-navy-100 bg-white">
        <div className="container-site py-7">
          <p className="text-[11px] uppercase tracking-[0.16em] text-graphite-500">{formatDate(t.held_on)}</p>
          <h1 className="mt-2 max-w-5xl text-balance text-[clamp(1.6rem,3.4vw,2.4rem)] leading-[1.12] text-navy-900">{t.title}</h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-graphite-600">
            <span>{item.participants.length} участников</span>
            <span className="text-graphite-300" aria-hidden="true">·</span>
            <span>{formatLabel(t.format)}</span>
            <span className="text-graphite-300" aria-hidden="true">·</span>
            <span>Коэффициент {t.coefficient}</span>
            {!t.is_finished && (
              <>
                <span className="text-graphite-300" aria-hidden="true">·</span>
                <span className="text-graphite-500">Итоги ещё не подведены</span>
              </>
            )}
          </p>
        </div>
      </header>

      <section className="section bg-white">
        <div className="container-site space-y-10">
          {t.notes && <p className="max-w-3xl border-l-2 border-accent-600 pl-4 text-sm leading-relaxed text-graphite-600">{t.notes}</p>}

          {item.playoff.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-2xl">Сетка</h2>
                <span className="text-[11px] uppercase tracking-[0.12em] text-graphite-500">
                  {t.format === "olympic" ? "Все места" : "Плей-офф"}
                </span>
              </div>
              <BracketView rounds={item.playoff} places={placeByAthlete} />
              <ResultsToggle title="Результаты встреч списком">
                <div className="space-y-5">
                  {item.playoff.map((round) => (
                    <div key={`${round.place_from ?? 0}:${round.round}`} className="space-y-2">
                      <h3 className="font-display text-[12px] uppercase tracking-[0.16em] text-graphite-500">{round.label}</h3>
                      <MatchesTable matches={round.matches} />
                    </div>
                  ))}
                </div>
              </ResultsToggle>
            </div>
          )}

          {item.champion && (
            <div className="flex flex-col gap-2 border border-accent-600/30 bg-accent-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Trophy size={20} className="text-accent-600" aria-hidden="true" />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-accent-700">Победитель турнира</p>
                  <p className="font-display text-lg leading-tight text-navy-900">{item.champion.full_name}</p>
                </div>
              </div>
              <p className="text-sm text-graphite-600">
                Рейтинг: {formatRating(item.champion.rating_after ?? item.champion.rating_before)}
                {item.champion.rating_after !== null && item.champion.rating_after !== undefined && (
                  <span className={cn("ml-2", item.champion.rating_after >= item.champion.rating_before ? "text-emerald-700" : "text-accent-700")}>
                    {item.champion.rating_after >= item.champion.rating_before ? "+" : ""}
                    {formatRating(item.champion.rating_after - item.champion.rating_before)}
                  </span>
                )}
              </p>
            </div>
          )}

          {item.groups.map((group, index) => (
            <div key={group.group_no} className="space-y-4">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h2 className="text-2xl">{item.groups.length > 1 ? `Группа ${index + 1}` : "Таблица"}</h2>
                <span className="text-[11px] uppercase tracking-[0.12em] text-graphite-500">
                  {group.standings.length} участников · до {group.best_of} партий · очки 2/1/0
                </span>
              </div>
              <CrossTable standings={group.standings} matches={group.matches} />
              <ResultsToggle title="Результаты встреч списком">
                <GroupMatchesList matches={group.matches} />
              </ResultsToggle>
            </div>
          ))}

          {t.format === "olympic" && !t.is_finished && placeByAthlete.size > 0 && (
            <div className="space-y-3">
              <h2 className="text-2xl">Занятые места</h2>
              <div className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
                {item.participants
                  .filter((participant) => placeByAthlete.has(participant.athlete_id))
                  .sort((a, b) => Number(a.place) - Number(b.place))
                  .map((participant) => (
                    <div
                      key={participant.athlete_id}
                      className="flex items-baseline justify-between gap-3 border-b border-navy-100 py-1.5 text-sm"
                    >
                      <span className="truncate text-navy-900">{participant.full_name}</span>
                      <span className="font-display text-navy-900">{participant.place} место</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {t.is_finished && item.participants.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-2xl">Итоговые места и рейтинг</h2>
              <div className="overflow-x-auto border border-navy-100">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-mist text-[10px] uppercase tracking-[0.12em] text-graphite-500">
                    <tr>
                      <th scope="col" className="w-14 px-4 py-2.5 font-medium">Место</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Спортсмен</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Лига</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Было</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Стало</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">+ / −</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-100">
                    {item.participants.map((participant) => {
                      const delta =
                        participant.rating_after !== null && participant.rating_after !== undefined
                          ? participant.rating_after - participant.rating_before
                          : 0;
                      return (
                        <tr key={participant.athlete_id} className="hover:bg-mist/40">
                          <td className="px-4 py-2.5 font-display text-navy-900">{participant.place ?? "—"}</td>
                          <td className="px-4 py-2.5 font-medium text-navy-900">{participant.full_name}</td>
                          <td className="px-4 py-2.5 text-graphite-600">
                            {participant.league ? `${participant.league} лига` : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right text-graphite-600">{formatRating(participant.rating_before)}</td>
                          <td className="px-4 py-2.5 text-right font-display text-navy-900">
                            {participant.rating_after === null || participant.rating_after === undefined
                              ? "—"
                              : formatRating(participant.rating_after)}
                          </td>
                          <td className={cn("px-4 py-2.5 text-right font-medium", delta > 0 ? "text-emerald-700" : delta < 0 ? "text-accent-700" : "text-graphite-500")}>
                            {delta > 0 ? "+" : ""}
                            {formatRating(delta)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {item.leagues.length === 0 && item.participants.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-2xl">Участники</h2>
              <p className="text-sm text-graphite-600">Состав опубликован, жеребьёвка ещё не проведена.</p>
              <div className="overflow-x-auto border border-navy-100">
                <table className="w-full border-collapse text-left text-sm">
                  <tbody className="divide-y divide-navy-100">
                    {item.participants.map((participant) => (
                      <tr key={participant.athlete_id}>
                        <td className="px-4 py-2.5 font-medium text-navy-900">{participant.full_name}</td>
                        <td className="px-4 py-2.5 text-graphite-600">{participant.birth_year ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right font-display text-navy-900">
                          {formatRating(participant.rating_before)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Link to="/turniry" className="inline-flex items-center gap-2 font-display text-sm uppercase tracking-[0.12em] text-navy-900 hover:text-accent-600">
            <ArrowLeft size={15} aria-hidden="true" /> Все турниры
          </Link>
        </div>
      </section>
    </>
  );
}
