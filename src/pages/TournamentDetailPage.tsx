import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Trophy, Users } from "lucide-react";
import { Seo } from "@/components/Seo";
import { Breadcrumbs } from "@/components/site/PageHero";
import { EmptyState, LoadingBlock } from "@/components/site/primitives";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TournamentMatch, TournamentStanding } from "@/lib/types";

function roundLabel(round: number, maxRound: number): string {
  const left = maxRound - round;
  if (left === 0) return "Финал";
  if (left === 1) return "1/2 финала";
  if (left === 2) return "1/4 финала";
  if (left === 3) return "1/8 финала";
  return `${round}-й круг`;
}

function scoreText(match: TournamentMatch): string {
  if (match.score_a === null || match.score_b === null) return "—";
  return `${match.score_a}:${match.score_b}`;
}

function StandingsTable({ rows, showRating = true }: { rows: TournamentStanding[]; showRating?: boolean }) {
  return (
    <div className="overflow-x-auto border border-navy-100">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-mist text-[10px] uppercase tracking-[0.14em] text-graphite-500">
          <tr>
            <th scope="col" className="w-10 px-3 py-2.5 font-medium">#</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Спортсмен</th>
            <th scope="col" className="hidden px-3 py-2.5 font-medium sm:table-cell">Год</th>
            <th scope="col" className="px-3 py-2.5 text-center font-medium">В</th>
            <th scope="col" className="px-3 py-2.5 text-center font-medium">П</th>
            <th scope="col" className="hidden px-3 py-2.5 text-center font-medium sm:table-cell">Сеты</th>
            {showRating && <th scope="col" className="px-3 py-2.5 text-right font-medium">Рейтинг</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-100">
          {rows.map((row) => (
            <tr key={row.athlete_id} className="hover:bg-mist/40">
              <td className="px-3 py-2.5 font-display text-navy-900">{row.place}</td>
              <td className="px-3 py-2.5 font-medium text-navy-900">{row.full_name}</td>
              <td className="hidden px-3 py-2.5 text-graphite-600 sm:table-cell">{row.birth_year ?? "—"}</td>
              <td className="px-3 py-2.5 text-center">{row.wins}</td>
              <td className="px-3 py-2.5 text-center">{row.losses}</td>
              <td className="hidden px-3 py-2.5 text-center text-graphite-600 sm:table-cell">
                {row.sets_for}:{row.sets_against}
              </td>
              {showRating && (
                <td className="px-3 py-2.5 text-right font-display text-navy-900">
                  {row.rating_after !== null && row.rating_after !== undefined
                    ? row.rating_after.toFixed(2)
                    : row.rating_before.toFixed(2)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchesTable({ matches }: { matches: TournamentMatch[] }) {
  return (
    <div className="divide-y divide-navy-100 border border-navy-100">
      {matches.map((match) => {
        const winnerA = match.winner_id === match.player_a;
        const winnerB = match.winner_id === match.player_b;
        return (
          <div key={match.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2.5 text-sm">
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
  const maxRound = item.playoff.length ? Math.max(...item.playoff.map((round) => round.round)) : 0;

  return (
    <>
      <Seo
        title={`${t.title} — результаты турнира`}
        description={`Турнир по настольному теннису ${t.title}: участники, встречи, итоговые места и изменения рейтинга.`}
        path={`/turniry/${t.id}`}
        type="article"
      />

      <div className="border-b border-navy-100 bg-mist">
        <div className="container-site py-5">
          <Breadcrumbs light={false} items={[{ label: "Турниры", to: "/turniry" }, { label: t.title }]} />
        </div>
      </div>

      <section className="relative overflow-hidden bg-navy-900 py-12 text-white sm:py-16">
        <div className="absolute inset-0 bg-grid-dark opacity-40" aria-hidden="true" />
        <div className="container-site relative">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">{formatDate(t.held_on)}</p>
          <h1 className="mt-3 max-w-4xl text-balance text-[clamp(2rem,5vw,3.4rem)] leading-[1.08] text-white">{t.title}</h1>
          <div className="mt-7 flex flex-wrap gap-6 border-t border-white/15 pt-6 text-sm text-white/80">
            <span className="inline-flex items-center gap-2">
              <Users size={16} className="text-accent-400" aria-hidden="true" /> {item.participants.length} участников
            </span>
            <span className="inline-flex items-center gap-2">
              <CalendarDays size={16} className="text-accent-400" aria-hidden="true" />
              {t.format === "groups_playoff" ? "Группы + плей-офф" : "Круговой турнир"}
            </span>
            <span>Коэффициент: {t.coefficient}</span>
            {item.leagues.length > 0 && (
              <span>Начало: {item.leagues.map((league) => `${league.title} — ${league.start_time}`).join(" · ")}</span>
            )}
            {!t.is_finished && <span className="text-white/60">Итоги ещё не подведены</span>}
          </div>
        </div>
      </section>

      <section className="section bg-white">
        <div className="container-site space-y-12">
          {t.notes && <p className="max-w-3xl border-l-2 border-accent-600 bg-mist px-4 py-3 text-sm leading-relaxed text-graphite-700">{t.notes}</p>}

          {item.champion && (
            <div className="flex flex-col gap-3 border border-accent-600/30 bg-accent-50 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Trophy size={26} className="text-accent-600" aria-hidden="true" />
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-accent-700">Победитель турнира</p>
                  <p className="font-display text-xl text-navy-900">{item.champion.full_name}</p>
                </div>
              </div>
              <p className="text-sm text-graphite-600">
                Рейтинг: {item.champion.rating_after?.toFixed(2) ?? item.champion.rating_before.toFixed(2)}
                {item.champion.rating_after !== null && item.champion.rating_after !== undefined && (
                  <span className={cn("ml-2", item.champion.rating_after >= item.champion.rating_before ? "text-emerald-700" : "text-accent-700")}>
                    {item.champion.rating_after >= item.champion.rating_before ? "+" : ""}
                    {(item.champion.rating_after - item.champion.rating_before).toFixed(2)}
                  </span>
                )}
              </p>
            </div>
          )}

          {item.groups.map((group, index) => (
            <div key={group.group_no} className="space-y-5 border-t border-navy-200 pt-10">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h2 className="text-3xl">{item.groups.length > 1 ? `Группа ${index + 1}` : "Таблица"}</h2>
                <span className="text-[11px] uppercase tracking-[0.14em] text-graphite-500">
                  {group.standings.length} участников · счёт по сетам
                </span>
              </div>
              <StandingsTable rows={group.standings} />
              <div>
                <h3 className="font-display text-[12px] uppercase tracking-[0.16em] text-graphite-500">Встречи</h3>
                <div className="mt-2">
                  <MatchesTable matches={group.matches} />
                </div>
              </div>
            </div>
          ))}

          {item.playoff.map((round) => (
            <div key={round.round} className="space-y-3 border-t border-navy-200 pt-10">
              <h2 className="text-3xl">{roundLabel(round.round, maxRound)}</h2>
              <MatchesTable matches={round.matches} />
            </div>
          ))}

          {t.is_finished && item.participants.length > 0 && (
            <div className="space-y-3 border-t border-navy-200 pt-10">
              <h2 className="text-3xl">Итоговые места и рейтинг</h2>
              <div className="overflow-x-auto border border-navy-100">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-mist text-[10px] uppercase tracking-[0.14em] text-graphite-500">
                    <tr>
                      <th scope="col" className="w-14 px-4 py-3 font-medium">Место</th>
                      <th scope="col" className="px-4 py-3 font-medium">Спортсмен</th>
                      <th scope="col" className="px-4 py-3 font-medium">Лига</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Было</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Стало</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">+ / −</th>
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
                          <td className="px-4 py-3 font-display text-navy-900">{participant.place ?? "—"}</td>
                          <td className="px-4 py-3 font-medium text-navy-900">{participant.full_name}</td>
                          <td className="px-4 py-3 text-graphite-600">
                            {participant.league ? `${participant.league} лига` : "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-graphite-600">{participant.rating_before.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-display text-navy-900">
                            {participant.rating_after?.toFixed(2) ?? "—"}
                          </td>
                          <td className={cn("px-4 py-3 text-right font-medium", delta > 0 ? "text-emerald-700" : delta < 0 ? "text-accent-700" : "text-graphite-500")}>
                            {delta > 0 ? "+" : ""}
                            {delta.toFixed(2)}
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
            <div>
              <h2 className="text-2xl">Участники</h2>
              <p className="mt-2 text-sm text-graphite-600">
                Состав опубликован, жеребьёвка ещё не проведена.
              </p>
              <div className="mt-4 overflow-x-auto border border-navy-100">
                <table className="w-full border-collapse text-left text-sm">
                  <tbody className="divide-y divide-navy-100">
                    {item.participants.map((participant) => (
                      <tr key={participant.athlete_id}>
                        <td className="px-4 py-2.5 font-medium text-navy-900">{participant.full_name}</td>
                        <td className="px-4 py-2.5 text-graphite-600">{participant.birth_year ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right font-display text-navy-900">
                          {participant.rating_before.toFixed(2)}
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
