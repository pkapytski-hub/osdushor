import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, RefreshCw, Save, Shuffle, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { ApiError, api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { AdminPageHeader, ConfirmDialog } from "./admin-ui";
import { Field, FormAlert, Select, TextInput, Textarea } from "@/components/ui/Field";
import {
  TOURNAMENT_FORMATS,
  type Athlete,
  type TournamentDetail,
  type TournamentFormat,
  type TournamentMatch,
  type TournamentStanding,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface Settings {
  title: string;
  held_on: string;
  format: TournamentFormat;
  group_size: number;
  playoff_size: number;
  coefficient: number;
  notes: string;
  is_published: boolean;
}

const EMPTY_SETTINGS: Settings = {
  title: "",
  held_on: new Date().toISOString().slice(0, 10),
  format: "round_robin",
  group_size: 6,
  playoff_size: 8,
  coefficient: 0.5,
  notes: "",
  is_published: false,
};

type Scores = Record<string, { a: string; b: string }>;

interface PendingConfirm {
  title: string;
  text: string;
  label: string;
  run: () => Promise<void>;
}

function roundLabel(round: number, maxRound: number): string {
  const left = maxRound - round;
  if (left === 0) return "Финал";
  if (left === 1) return "1/2 финала";
  if (left === 2) return "1/4 финала";
  if (left === 3) return "1/8 финала";
  return `${round}-й круг`;
}

function StandingsTable({ rows }: { rows: TournamentStanding[] }) {
  return (
    <div className="overflow-x-auto border border-navy-100">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-mist text-[10px] uppercase tracking-[0.14em] text-graphite-500">
          <tr>
            <th scope="col" className="w-10 px-3 py-2 text-center font-medium" title="Жеребьёвочный номер в группе">№</th>
            <th scope="col" className="w-10 px-3 py-2 font-medium">#</th>
            <th scope="col" className="px-3 py-2 font-medium">Спортсмен</th>
            <th scope="col" className="px-3 py-2 text-center font-medium">В</th>
            <th scope="col" className="px-3 py-2 text-center font-medium">П</th>
            <th scope="col" className="hidden px-3 py-2 text-center font-medium sm:table-cell">Сеты</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Рейтинг</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-100">
          {rows.map((row) => (
            <tr key={row.athlete_id}>
              <td className="px-3 py-2 text-center font-display text-xs text-graphite-500">{row.seed || "—"}</td>
              <td className="px-3 py-2 font-display text-navy-900">{row.place}</td>
              <td className="px-3 py-2 font-medium text-navy-900">
                {row.full_name}
                <span className="ml-2 text-xs font-normal text-graphite-500">{row.birth_year ?? ""}</span>
              </td>
              <td className="px-3 py-2 text-center">{row.wins}</td>
              <td className="px-3 py-2 text-center">{row.losses}</td>
              <td className="hidden px-3 py-2 text-center text-graphite-600 sm:table-cell">
                {row.sets_for}:{row.sets_against}
              </td>
              <td className="px-3 py-2 text-right font-display text-navy-900">{row.rating_before.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TournamentEditorPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const [data, setData] = useState<TournamentDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">(isNew ? "ready" : "loading");
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<Settings>(EMPTY_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scores, setScores] = useState<Scores>({});
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const athletes = useAsync((signal) => api.admin.athletes(signal), [], !isNew);

  const apply = (item: TournamentDetail) => {
    setData(item);
    if (!settingsLoaded) {
      setSettings({
        title: item.tournament.title,
        held_on: item.tournament.held_on,
        format: item.tournament.format,
        group_size: item.tournament.group_size,
        playoff_size: item.tournament.playoff_size,
        coefficient: item.tournament.coefficient,
        notes: item.tournament.notes ?? "",
        is_published: item.tournament.is_published,
      });
      setSettingsLoaded(true);
    }
    setSelected(new Set(item.participants.map((participant) => participant.athlete_id)));
    const next: Scores = {};
    for (const match of [...item.groups.flatMap((group) => group.matches), ...item.playoff.flatMap((round) => round.matches)]) {
      next[match.id] = {
        a: match.score_a === null ? "" : String(match.score_a),
        b: match.score_b === null ? "" : String(match.score_b),
      };
    }
    setScores(next);
  };

  const load = async () => {
    if (!id || isNew) return;
    setState("loading");
    setError("");
    try {
      const response = await api.admin.tournaments.item(id);
      apply(response.item);
      setState("ready");
    } catch (cause) {
      setState("error");
      setError(cause instanceof ApiError ? cause.message : "Не удалось загрузить турнир.");
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const filteredAthletes = useMemo(() => {
    const items = athletes.data?.items ?? [];
    if (!search.trim()) return items;
    const needle = search.trim().toLowerCase();
    return items.filter((athlete) => athlete.full_name.toLowerCase().includes(needle));
  }, [athletes.data, search]);

  const run = async (action: () => Promise<void>, message: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(message);
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : "Действие не выполнено.");
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    await run(async () => {
      const payload = { ...settings };
      if (isNew) {
        const response = await api.admin.tournaments.create(payload);
        navigate(`/admin/tournaments/${response.item.tournament.id}`);
        return;
      }
      const response = await api.admin.tournaments.update(id!, payload);
      setData(response.item);
    }, isNew ? "Турнир создан" : "Настройки сохранены");
  };

  const saveParticipants = async () => {
    if (!id) return;
    await run(async () => {
      const response = await api.admin.tournaments.setParticipants(id, [...selected]);
      apply(response.item);
    }, "Состав сохранён");
  };

  const draw = async () => {
    if (!id) return;
    await run(async () => {
      const response = await api.admin.tournaments.draw(id);
      apply(response.item);
    }, "Жеребьёвка проведена");
  };

  const makePlayoff = async () => {
    if (!id) return;
    await run(async () => {
      const response = await api.admin.tournaments.playoff(id);
      apply(response.item);
    }, "Сетка плей-офф сформирована");
  };

  const saveMatch = async (match: TournamentMatch) => {
    if (!id) return;
    const values = scores[match.id] ?? { a: "", b: "" };
    const scoreA = values.a === "" ? null : Number(values.a);
    const scoreB = values.b === "" ? null : Number(values.b);
    if ((scoreA === null) !== (scoreB === null)) {
      toast.error("Заполните оба поля счёта или очистите оба.");
      return;
    }
    if (scoreA !== null && scoreB !== null && (scoreA === scoreB || scoreA < 0 || scoreB < 0)) {
      toast.error("Счёт должен быть разным и неотрицательным.");
      return;
    }
    await run(async () => {
      const response = await api.admin.tournaments.score(id, match.id, scoreA, scoreB);
      apply(response.item);
    }, "Результат сохранён");
  };

  const finalize = async () => {
    if (!id) return;
    await run(async () => {
      const response = await api.admin.tournaments.finalize(id);
      apply(response.item);
    }, "Итоги подведены, рейтинг пересчитан");
  };

  const reopen = async () => {
    if (!id) return;
    await run(async () => {
      const response = await api.admin.tournaments.reopen(id);
      apply(response.item);
    }, "Итоги отменены, рейтинг возвращён");
  };

  const remove = async () => {
    if (!id) return;
    await run(async () => {
      await api.admin.tournaments.remove(id);
      navigate("/admin/tournaments");
    }, "Турнир удалён");
  };

  if (state === "loading") {
    return <div className="border border-navy-100 bg-white p-8 text-sm text-graphite-500">Загрузка турнира…</div>;
  }
  if (state === "error") {
    return (
      <div className="border border-accent-600/30 bg-white p-6">
        <p className="text-sm text-accent-700">{error}</p>
        <div className="mt-4 flex gap-2">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()}>Повторить</button>
          <Link to="/admin/tournaments" className="btn btn-ghost btn-sm">К списку</Link>
        </div>
      </div>
    );
  }

  const finished = Boolean(data?.tournament.is_finished);
  const allMatches = data
    ? [...data.groups.flatMap((group) => group.matches), ...data.playoff.flatMap((round) => round.matches)]
    : [];
  const maxRound = data?.playoff.length ? Math.max(...data.playoff.map((round) => round.round)) : 0;
  const leagueOfAthlete = new Map<string, number | null>();
  for (const participant of data?.participants ?? []) {
    leagueOfAthlete.set(participant.athlete_id, participant.league);
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/tournaments" className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.12em] text-graphite-500 hover:text-accent-600">
        <ArrowLeft size={14} aria-hidden="true" /> Турниры
      </Link>
      <AdminPageHeader
        eyebrow="Соревнования"
        title={isNew ? "Новый турнир" : settings.title || "Турнир"}
        description={
          isNew
            ? "Заполните основные сведения. Участники выбираются после создания турнира."
            : `${data?.participants.length ?? 0} участников · ${data?.played_count ?? 0} из ${data?.match_count ?? 0} встреч заполнено`
        }
        actions={
          !isNew && data ? (
            <>
              {data.tournament.is_published && (
                <Link to={`/turniry/${data.tournament.id}`} target="_blank" className="btn btn-ghost btn-sm">
                  На сайте
                </Link>
              )}
              {!finished && data.can_finalize && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() =>
                    setConfirm({
                      title: "Подвести итоги?",
                      text: "Итоговые места и изменения рейтинга будут применены ко всем участникам. После этого результаты нельзя менять без отмены итогов.",
                      label: "Подвести итоги",
                      run: finalize,
                    })
                  }
                >
                  <Trophy size={15} aria-hidden="true" /> Подвести итоги
                </button>
              )}
              {finished && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() =>
                    setConfirm({
                      title: "Отменить итоги?",
                      text: "Рейтинг участников вернётся к значениям до турнира, а результаты снова станут редактируемыми.",
                      label: "Отменить итоги",
                      run: reopen,
                    })
                  }
                >
                  <RefreshCw size={15} aria-hidden="true" /> Отменить итоги
                </button>
              )}
            </>
          ) : null
        }
      />

      {error && <FormAlert>{error}</FormAlert>}

      <form onSubmit={saveSettings} className="border border-navy-100 bg-white p-5 sm:p-6">
        <h2 className="text-lg normal-case tracking-normal">Основные сведения</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Название турнира" htmlFor="tournament-title" required>
              <TextInput
                id="tournament-title"
                value={settings.title}
                onChange={(event) => setSettings((current) => ({ ...current, title: event.target.value }))}
                maxLength={200}
                placeholder="Например: Субботний турнир школы"
              />
            </Field>
          </div>
          <Field label="Дата" htmlFor="tournament-date" required>
            <TextInput
              id="tournament-date"
              type="date"
              value={settings.held_on}
              onChange={(event) => setSettings((current) => ({ ...current, held_on: event.target.value }))}
            />
          </Field>
          <Field label="Формат" htmlFor="tournament-format" required>
            <Select
              id="tournament-format"
              value={settings.format}
              disabled={finished}
              onChange={(event) =>
                setSettings((current) => ({ ...current, format: event.target.value as TournamentFormat }))
              }
            >
              {TOURNAMENT_FORMATS.map((format) => (
                <option key={format.value} value={format.value}>{format.label}</option>
              ))}
            </Select>
          </Field>
          <Field
            label="Размер группы"
            htmlFor="tournament-group"
            hint="Участники делятся на группы подряд по рейтингу: 1–6, 7–12 и так далее. Лиги могут смешиваться."
          >
            <TextInput
              id="tournament-group"
              type="number"
              min={2}
              max={8}
              value={settings.group_size}
              disabled={finished}
              onChange={(event) =>
                setSettings((current) => ({ ...current, group_size: Number(event.target.value) || 6 }))
              }
            />
          </Field>
          {settings.format === "groups_playoff" && (
            <Field label="Участников в плей-офф" htmlFor="tournament-playoff">
              <Select
                id="tournament-playoff"
                value={String(settings.playoff_size)}
                disabled={finished}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, playoff_size: Number(event.target.value) }))
                }
              >
                {[2, 4, 8, 16].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Коэффициент турнира" htmlFor="tournament-coefficient" hint="Стандарт школы — 0,5. Больше коэффициент — сильнее меняется рейтинг.">
            <TextInput
              id="tournament-coefficient"
              type="number"
              step="0.1"
              min={0.1}
              max={5}
              value={settings.coefficient}
              onChange={(event) =>
                setSettings((current) => ({ ...current, coefficient: Number(event.target.value) || 0.5 }))
              }
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Примечание" htmlFor="tournament-notes" hint="Необязательно. Показывается на странице турнира.">
              <Textarea
                id="tournament-notes"
                rows={3}
                value={settings.notes}
                onChange={(event) => setSettings((current) => ({ ...current, notes: event.target.value }))}
                maxLength={4000}
              />
            </Field>
          </div>
          <label className="flex cursor-pointer items-center gap-3 border border-navy-100 bg-mist px-4 py-3">
            <input
              type="checkbox"
              className="h-4 w-4 accent-accent-600"
              checked={settings.is_published}
              onChange={(event) => setSettings((current) => ({ ...current, is_published: event.target.checked }))}
            />
            <span className="text-sm text-graphite-700">Опубликовать турнир на сайте</span>
          </label>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
            <Save size={15} aria-hidden="true" /> {isNew ? "Создать турнир" : "Сохранить настройки"}
          </button>
          {!isNew && (
            <button
              type="button"
              className="btn btn-ghost btn-sm !text-accent-700"
              disabled={busy || finished}
              onClick={() =>
                setConfirm({
                  title: "Удалить турнир?",
                  text: "Турнир, участники и все встречи будут удалены. Рейтинг участников не изменится.",
                  label: "Удалить",
                  run: remove,
                })
              }
            >
              Удалить турнир
            </button>
          )}
        </div>
      </form>

      {!isNew && data && (
        <>
          <section className="border border-navy-100 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg normal-case tracking-normal">Участники</h2>
                <p className="mt-1 text-xs text-graphite-500">
                  Выбрано: {selected.size}. Список берётся из раздела «Спортсмены и рейтинг».
                </p>
              </div>
              <button type="button" className="btn btn-outline btn-sm" disabled={busy || finished} onClick={() => void saveParticipants()}>
                <Users size={15} aria-hidden="true" /> Сохранить состав
              </button>
            </div>
            {athletes.loading && <p className="mt-4 text-sm text-graphite-500">Загрузка спортсменов…</p>}
            {athletes.error && <p className="mt-4 text-sm text-accent-700">{athletes.error}</p>}
            {athletes.data && athletes.data.items.length === 0 && (
              <div className="mt-4 border border-dashed border-navy-200 p-5 text-sm text-graphite-600">
                В списке спортсменов пока пусто.{" "}
                <Link to="/admin/athletes/new" className="font-medium text-accent-700 underline">Добавьте первого спортсмена</Link>.
              </div>
            )}
            {athletes.data && athletes.data.items.length > 0 && (
              <>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Поиск по фамилии"
                  className="field-input mt-4 max-w-sm"
                  aria-label="Поиск спортсмена"
                />
                <div className="mt-3 grid max-h-80 gap-1 overflow-y-auto border border-navy-100 p-2 sm:grid-cols-2">
                  {filteredAthletes.map((athlete: Athlete) => (
                    <label
                      key={athlete.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 px-2 py-2 text-sm hover:bg-mist",
                        selected.has(athlete.id) && "bg-mist",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-accent-600"
                        checked={selected.has(athlete.id)}
                        disabled={finished}
                        onChange={(event) => {
                          setSelected((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(athlete.id);
                            else next.delete(athlete.id);
                            return next;
                          });
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate text-graphite-800">{athlete.full_name}</span>
                      {leagueOfAthlete.get(athlete.id) ? (
                        <span className="text-[10px] uppercase tracking-[0.1em] text-accent-700">
                          {leagueOfAthlete.get(athlete.id)} лига
                        </span>
                      ) : null}
                      <span className="text-xs text-graphite-500">{athlete.birth_year ?? "—"}</span>
                      <span className="w-16 text-right font-display text-navy-900">{Number(athlete.rating).toFixed(1)}</span>
                    </label>
                  ))}
                </div>
                {!finished && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm mt-4"
                    disabled={busy || selected.size < 2}
                    onClick={() =>
                      setConfirm({
                        title: "Провести жеребьёвку?",
                        text: "Участники будут распределены по группам подряд по рейтингу (лиги могут смешиваться), а все ранее введённые результаты удалены.",
                        label: "Провести жеребьёвку",
                        run: draw,
                      })
                    }
                  >
                    <Shuffle size={15} aria-hidden="true" /> Провести жеребьёвку
                  </button>
                )}
              </>
            )}
          </section>

          {data.match_count === 0 && data.participants.length > 0 && (
            <p className="border-l-2 border-navy-300 bg-white px-4 py-3 text-sm text-graphite-600">
              Сохраните состав и проведите жеребьёвку — появится таблица групп и встречи.
            </p>
          )}

          {data.match_count > 0 &&
            data.groups.map((group, index) => (
              <Fragment key={group.group_no}>
                <section className="border border-navy-100 bg-white p-5 sm:p-6">
                  <h3 className="text-lg normal-case tracking-normal">Группа {index + 1}</h3>
                  <p className="mt-1 text-xs text-graphite-500">{group.standings.length} участников</p>
                  <div className="mt-4">
                    <StandingsTable rows={group.standings} />
                  </div>
                  <h4 className="mt-6 font-display text-[12px] uppercase tracking-[0.16em] text-graphite-500">Встречи по кругам</h4>
                  {/* Группируем встречи по кругам; если круг один — обычный список */}
                  {(() => {
                    const roundNumbers = [...new Set(group.matches.map((m) => m.round))].sort((a, b) => a - b);
                    if (roundNumbers.length <= 1) {
                      return (
                        <div className="mt-2 divide-y divide-navy-100 border border-navy-100">
                          {group.matches.map((match) => (
                            <MatchRow
                              key={match.id}
                              match={match}
                              scores={scores[match.id] ?? { a: "", b: "" }}
                              finished={finished}
                              busy={busy}
                              onChange={(side, value) =>
                                setScores((current) => ({
                                  ...current,
                                  [match.id]: { ...(current[match.id] ?? { a: "", b: "" }), [side]: value },
                                }))
                              }
                              onSave={() => void saveMatch(match)}
                            />
                          ))}
                        </div>
                      );
                    }
                    return (
                      <div className="mt-2 space-y-3">
                        {roundNumbers.map((round) => {
                          const roundMatches = group.matches.filter((m) => m.round === round);
                          return (
                            <div key={round} className="border border-navy-100">
                              <div className="border-b border-navy-100 bg-mist px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-graphite-600">
                                {round}-й круг
                              </div>
                              <div className="divide-y divide-navy-100">
                                {roundMatches.map((match) => (
                                  <MatchRow
                                    key={match.id}
                                    match={match}
                                    scores={scores[match.id] ?? { a: "", b: "" }}
                                    finished={finished}
                                    busy={busy}
                                    onChange={(side, value) =>
                                      setScores((current) => ({
                                        ...current,
                                        [match.id]: { ...(current[match.id] ?? { a: "", b: "" }), [side]: value },
                                      }))
                                    }
                                    onSave={() => void saveMatch(match)}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </section>
              </Fragment>
            ))}

          {data.playoff.map((round) => (
            <Fragment key={round.round}>
              <section className="border border-navy-100 bg-white p-5 sm:p-6">
                <h3 className="text-lg normal-case tracking-normal">{roundLabel(round.round, maxRound)}</h3>
                <div className="mt-3 divide-y divide-navy-100 border border-navy-100">
                  {round.matches.map((match) => (
                    <MatchRow
                      key={match.id}
                      match={match}
                      scores={scores[match.id] ?? { a: "", b: "" }}
                      finished={finished}
                      busy={busy}
                      onChange={(side, value) =>
                        setScores((current) => ({
                          ...current,
                          [match.id]: { ...(current[match.id] ?? { a: "", b: "" }), [side]: value },
                        }))
                      }
                      onSave={() => void saveMatch(match)}
                    />
                  ))}
                </div>
              </section>
            </Fragment>
          ))}

          {data.tournament.format === "groups_playoff" && data.can_playoff && (
            <section className="border border-navy-100 bg-white p-5 sm:p-6">
              <h2 className="text-lg normal-case tracking-normal">Плей-офф</h2>
              <p className="mt-1 text-sm text-graphite-600">
                Все групповые встречи заполнены. Сформируйте сетку плей-офф: в неё выходят {data.tournament.playoff_size} сильнейших по итогам групп (или меньше, если участников меньше). Лиги между собой не разделяются.
              </p>
              <button type="button" className="btn btn-primary btn-sm mt-4" disabled={busy} onClick={() => void makePlayoff()}>
                <Trophy size={15} aria-hidden="true" /> Сформировать плей-офф
              </button>
            </section>
          )}

          {finished && data.participants.length > 0 && (
            <section className="border border-navy-100 bg-white p-5 sm:p-6">
              <h2 className="text-lg normal-case tracking-normal">Итоговые места и рейтинг</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-mist text-[10px] uppercase tracking-[0.14em] text-graphite-500">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">Место</th>
                      <th scope="col" className="px-3 py-2 font-medium">Лига</th>
                      <th scope="col" className="px-3 py-2 font-medium">Спортсмен</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Было</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Стало</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">+ / −</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-100">
                    {data.participants.map((participant) => {
                      const delta =
                        participant.rating_after !== null && participant.rating_after !== undefined
                          ? participant.rating_after - participant.rating_before
                          : 0;
                      return (
                        <tr key={participant.athlete_id}>
                          <td className="px-3 py-2 font-display">{participant.place ?? "—"}</td>
                          <td className="px-3 py-2 text-graphite-600">{participant.league ? `${participant.league} лига` : "—"}</td>
                          <td className="px-3 py-2 font-medium text-navy-900">{participant.full_name}</td>
                          <td className="px-3 py-2 text-right text-graphite-600">{participant.rating_before.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-display">{participant.rating_after?.toFixed(2) ?? "—"}</td>
                          <td className={cn("px-3 py-2 text-right font-medium", delta > 0 ? "text-emerald-700" : delta < 0 ? "text-accent-700" : "text-graphite-500")}>
                            {delta > 0 ? "+" : ""}
                            {delta.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {!finished && data.can_finalize && (
            <p className="border-l-2 border-emerald-600 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Все встречи заполнены ({allMatches.length}). Можно подводить итоги — рейтинг участников будет пересчитан.
            </p>
          )}
        </>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ""}
        text={confirm?.text ?? ""}
        confirmLabel={confirm?.label ?? "Подтвердить"}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const action = confirm?.run;
          setConfirm(null);
          if (action) void action();
        }}
      />
    </div>
  );
}

function MatchRow({
  match,
  scores,
  finished,
  busy,
  onChange,
  onSave,
}: {
  match: TournamentMatch;
  scores: { a: string; b: string };
  finished: boolean;
  busy: boolean;
  onChange: (side: "a" | "b", value: string) => void;
  onSave: () => void;
}) {
  const winnerA = match.winner_id === match.player_a;
  const winnerB = match.winner_id === match.player_b;
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
      <span className={cn("min-w-0 flex-1 truncate text-right", winnerA ? "font-semibold text-navy-900" : "text-graphite-700")}>
        {match.player_a_name}
      </span>
      {finished ? (
        <span className="min-w-16 text-center font-display text-base text-navy-900">
          {match.score_a ?? "—"}:{match.score_b ?? "—"}
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={9}
            value={scores.a}
            onChange={(event) => onChange("a", event.target.value)}
            className="field-input !min-h-9 w-14 px-2 py-1 text-center"
            aria-label={`Счёт ${match.player_a_name}`}
          />
          <span className="text-graphite-400">:</span>
          <input
            type="number"
            min={0}
            max={9}
            value={scores.b}
            onChange={(event) => onChange("b", event.target.value)}
            className="field-input !min-h-9 w-14 px-2 py-1 text-center"
            aria-label={`Счёт ${match.player_b_name}`}
          />
        </span>
      )}
      <span className={cn("min-w-0 flex-1 truncate", winnerB ? "font-semibold text-navy-900" : "text-graphite-700")}>
        {match.player_b_name}
      </span>
      {finished ? (
        <span className="w-28 text-right text-[11px] text-graphite-500">
          {match.delta_a !== null || match.delta_b !== null
            ? `${match.delta_a! >= 0 ? "+" : ""}${match.delta_a ?? 0} / ${match.delta_b! >= 0 ? "+" : ""}${match.delta_b ?? 0}`
            : ""}
        </span>
      ) : (
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center text-graphite-500 hover:bg-mist hover:text-emerald-700"
          disabled={busy}
          onClick={onSave}
          title="Сохранить счёт"
          aria-label="Сохранить счёт"
        >
          <Check size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
