import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Megaphone, Plus, RefreshCw, Save, Shuffle, Trophy, Users, X } from "lucide-react";
import { toast } from "sonner";
import { ApiError, api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { AdminPageHeader, ConfirmDialog } from "./admin-ui";
import { Field, FormAlert, Select, TextInput, Textarea } from "@/components/ui/Field";
import { CrossTable } from "@/components/CrossTable";
import { BracketView } from "@/components/BracketView";
import {
  TOURNAMENT_FORMATS,
  type Athlete,
  type TournamentDetail,
  type TournamentFormat,
  type TournamentMatch,
  type TournamentStanding,
} from "@/lib/types";
import { cn } from "@/lib/utils";
// Считаем таблицу тем же кодом, что и сервер: предпросмотр не расходится с итогами.
import { standings as computeStandings, type MatchInput } from "../../../worker/lib/tournament";

interface Settings {
  title: string;
  held_on: string;
  format: TournamentFormat;
  group_size: number;
  playoff_size: number;
  best_of: number;
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
  best_of: 5,
  coefficient: 0.5,
  notes: "",
  is_published: false,
};

/** Какие счёта возможны при разной длине встречи. */
const BEST_OF_SCORES: Record<number, string> = {
  3: "2:0, 2:1",
  5: "3:0, 3:1, 3:2",
  7: "4:0, 4:1, 4:2, 4:3",
};

type Scores = Record<string, { a: string; b: string }>;

interface ParsedScore {
  a: number;
  b: number;
  techLossA: boolean;
  techLossB: boolean;
}

/** Сколько партий нужно выиграть: у плей-офф — общее, у группы — своё. */
function winSetsOfMatch(match: TournamentMatch, data: TournamentDetail | null): number {
  if (match.stage === "playoff") return data?.playoff[0]?.sets_to_win ?? 3;
  return data?.groups.find((group) => group.group_no === match.group_no)?.sets_to_win ?? 3;
}

/**
 * Разбор введённого счёта. «w» вместо числа партий у победителя при 0 у соперника —
 * техническая победа: встреча пишется со счётом до победы, проигравшему — техпоражение
 * (0 очков в таблице). Пока счёт не сложился, возвращает null.
 */
function parseScoreEntry(values: { a: string; b: string }, winSets: number): ParsedScore | null {
  const rawA = values.a.trim().toLowerCase();
  const rawB = values.b.trim().toLowerCase();
  if (rawA === "w" && rawB === "w") return null;
  if (rawA === "w") return rawB === "0" ? { a: winSets, b: 0, techLossA: false, techLossB: true } : null;
  if (rawB === "w") return rawA === "0" ? { a: 0, b: winSets, techLossA: true, techLossB: false } : null;
  if (rawA === "" || rawB === "") return null;
  const a = Number(rawA);
  const b = Number(rawB);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return null;
  return { a, b, techLossA: false, techLossB: false };
}

interface PendingConfirm {
  title: string;
  text: string;
  label: string;
  run: () => Promise<void>;
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

  // Счёт, уже набранный в полях, применяем к таблице сразу, ещё до сохранения.
  const previewScores = useMemo(() => {
    const result = new Map<string, ParsedScore>();
    if (!data) return result;
    for (const match of [
      ...data.groups.flatMap((group) => group.matches),
      ...data.playoff.flatMap((round) => round.matches),
    ]) {
      const values = scores[match.id];
      if (!values) continue;
      const parsed = parseScoreEntry(values, winSetsOfMatch(match, data));
      if (parsed) result.set(match.id, parsed);
    }
    return result;
  }, [data, scores]);

  const previewGroups = useMemo(() => {
    if (!data) return [] as { group_no: number; rows: TournamentStanding[] }[];
    const matches: MatchInput[] = [
      ...data.groups.flatMap((group) => group.matches),
      ...data.playoff.flatMap((round) => round.matches),
    ].map((match) => {
      const typed = previewScores.get(match.id);
      return {
        id: match.id,
        stage: match.stage,
        group_no: match.group_no,
        round: match.round,
        slot: match.slot,
        player_a: match.player_a,
        player_b: match.player_b,
        score_a: typed ? typed.a : match.score_a,
        score_b: typed ? typed.b : match.score_b,
        tech_loss_a: typed ? typed.techLossA : Boolean(match.tech_loss_a),
        tech_loss_b: typed ? typed.techLossB : Boolean(match.tech_loss_b),
      };
    });
    return data.groups.map((group) => {
      const saved = new Map(group.standings.map((item) => [item.athlete_id, item]));
      const rows: TournamentStanding[] = computeStandings(data.participants, matches, group.group_no).map((row) => {
        const savedRow = saved.get(row.athlete_id);
        const base: TournamentStanding = savedRow ?? {
          ...row,
          rating_after: null,
          projected_rating: null,
          projected_delta: null,
        };
        return { ...base, ...row };
      });
      return { group_no: group.group_no, rows };
    });
  }, [data, previewScores]);

  // Вызов встреч идёт по кругам: сначала 1-й круг 1-й группы, потом 1-й круг
  // 2-й группы и так далее — так все группы играют равномерно, а не одна
  // группа доигрывает турнир целиком, пока другие ждут.
  const callPlan = useMemo(() => {
    if (!data) return [] as { round: number; groups: { group_no: number; index: number; matches: TournamentMatch[] }[] }[];
    const rounds = [
      ...new Set(data.groups.flatMap((group) => group.matches.map((match) => match.round))),
    ].sort((a, b) => a - b);
    return rounds.map((round) => ({
      round,
      groups: data.groups
        .map((group, index) => ({
          group_no: group.group_no,
          index,
          matches: group.matches
            .filter((match) => match.round === round)
            .sort((a, b) => a.slot - b.slot),
        }))
        .filter((entry) => entry.matches.length > 0),
    }));
  }, [data]);

  // Сквозная нумерация встреч в порядке вызова: 1, 2, 3 …
  const callNumbers = useMemo(() => {
    const numbers = new Map<string, number>();
    let next = 0;
    for (const round of callPlan) {
      for (const entry of round.groups) {
        for (const match of entry.matches) numbers.set(match.id, ++next);
      }
    }
    return numbers;
  }, [callPlan]);

  const updateScore = (matchId: string, side: "a" | "b", value: string) =>
    setScores((current) => ({
      ...current,
      [matchId]: { ...(current[matchId] ?? { a: "", b: "" }), [side]: value },
    }));

  const toggleCall = async (match: TournamentMatch, called: boolean) => {
    if (!id) return;
    await run(async () => {
      const response = await api.admin.tournaments.call(id, match.id, called);
      // Меняем только отметку вызова: введённый, но не сохранённый счёт должен
      // остаться в полях, поэтому весь экран заново не перерисовываем.
      const stamp =
        response.item.groups.flatMap((group) => group.matches).find((item) => item.id === match.id)?.called_at ?? null;
      setData((current) =>
        current
          ? {
              ...current,
              groups: current.groups.map((group) => ({
                ...group,
                matches: group.matches.map((item) =>
                  item.id === match.id ? { ...item, called_at: stamp } : item,
                ),
              })),
            }
          : current,
      );
    }, called ? "Встреча вызвана" : "Вызов снят");
  };

  const apply = (item: TournamentDetail) => {
    setData(item);
    if (!settingsLoaded) {
      setSettings({
        title: item.tournament.title,
        held_on: item.tournament.held_on,
        format: item.tournament.format,
        group_size: item.tournament.group_size,
        playoff_size: item.tournament.playoff_size,
        best_of: item.tournament.best_of,
        coefficient: item.tournament.coefficient,
        notes: item.tournament.notes ?? "",
        is_published: item.tournament.is_published,
      });
      setSettingsLoaded(true);
    }
    setSelected(new Set(item.participants.map((participant) => participant.athlete_id)));
    const next: Scores = {};
    for (const match of [...item.groups.flatMap((group) => group.matches), ...item.playoff.flatMap((round) => round.matches)]) {
      // Техническую победу показываем так же, как её вводят: «w» вместо счёта.
      next[match.id] = match.tech_loss_a
        ? { a: "0", b: "w" }
        : match.tech_loss_b
          ? { a: "w", b: "0" }
          : {
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
    const winSets = winSetsOfMatch(match, data);
    const values = scores[match.id] ?? { a: "", b: "" };
    const empty = values.a.trim() === "" && values.b.trim() === "";
    const half = (values.a.trim() === "") !== (values.b.trim() === "");
    if (half) {
      toast.error("Заполните оба поля: счёт или «w» у победителя и 0 у соперника.");
      return;
    }
    const parsed = empty ? null : parseScoreEntry(values, winSets);
    if (!empty && !parsed) {
      toast.error("Счёт не подходит: партии до победы или «w» у победителя и 0 у соперника.");
      return;
    }
    if (parsed) {
      if (parsed.a === parsed.b) {
        toast.error("Счёт должен быть разным: нужен победитель.");
        return;
      }
      if (Math.max(parsed.a, parsed.b) !== winSets || Math.min(parsed.a, parsed.b) >= winSets) {
        toast.error(`Встреча идёт до ${winSets} партий: у победителя — ${winSets}, у соперника — меньше.`);
        return;
      }
    }
    const tech = Boolean(parsed && (parsed.techLossA || parsed.techLossB));
    await run(async () => {
      const response = await api.admin.tournaments.score(
        id,
        match.id,
        parsed?.a ?? null,
        parsed?.b ?? null,
        parsed?.techLossA ?? false,
        parsed?.techLossB ?? false,
      );
      apply(response.item);
    }, tech ? "Техническая победа сохранена" : "Результат сохранён");
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
  const leagueOfAthlete = new Map<string, number | null>();
  for (const participant of data?.participants ?? []) {
    leagueOfAthlete.set(participant.athlete_id, participant.league);
  }

  // Встреча с учётом набранного, но ещё не сохранённого счёта — для круговой таблицы.
  const previewMatch = (match: TournamentMatch): TournamentMatch => {
    const typed = previewScores.get(match.id);
    if (!typed) return match;
    return {
      ...match,
      score_a: typed.a,
      score_b: typed.b,
      tech_loss_a: typed.techLossA,
      tech_loss_b: typed.techLossB,
      winner_id: typed.a === typed.b ? null : typed.a > typed.b ? match.player_a : match.player_b,
      delta_a: null,
      delta_b: null,
    };
  };

  const isUnsaved = (match: TournamentMatch): boolean => {
    const typed = previewScores.get(match.id);
    return typed !== undefined && (typed.a !== match.score_a || typed.b !== match.score_b);
  };

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
          {settings.format !== "olympic" && (
          <Field
            label="Размер группы"
            htmlFor="tournament-group"
            hint="По правилам школы в группе 5 или 6 человек. Участники делятся подряд по рейтингу, группы получаются максимально ровными; лиги могут смешиваться."
          >
            <Select
              id="tournament-group"
              value={String(settings.group_size)}
              disabled={finished}
              onChange={(event) =>
                setSettings((current) => ({ ...current, group_size: Number(event.target.value) || 6 }))
              }
            >
              {[5, 6].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </Select>
          </Field>
          )}
          <Field
            label="Длина встречи"
            htmlFor="tournament-best-of"
            hint="Не зависит от числа участников: встреча идёт до 3, 5 или 7 партий. Победитель берёт 2, 3 или 4 партии (2:0 и 2:1, 3:0–3:2 или 4:0–4:3), за каждый выигранный сет — 1 очко."
          >
            <Select
              id="tournament-best-of"
              value={String(settings.best_of)}
              disabled={finished}
              onChange={(event) =>
                setSettings((current) => ({ ...current, best_of: Number(event.target.value) || 5 }))
              }
            >
              {[3, 5, 7].map((bestOf) => (
                <option key={bestOf} value={bestOf}>
                  до {bestOf} партий — {BEST_OF_SCORES[bestOf]}
                </option>
              ))}
            </Select>
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
                  Выбрано: {selected.size}. Список берётся из раздела «Спортсмены и рейтинг»; те, кто в архиве, тоже
                  доступны — турнир возвращает их в рейтинг.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!finished && (
                  <Link to="/admin/athletes/new" className="btn btn-outline btn-sm">
                    <Plus size={15} aria-hidden="true" /> Новый спортсмен
                  </Link>
                )}
                <button type="button" className="btn btn-outline btn-sm" disabled={busy || finished} onClick={() => void saveParticipants()}>
                  <Users size={15} aria-hidden="true" /> Сохранить состав
                </button>
              </div>
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
                <div className="mt-3 grid max-h-80 gap-1 overflow-y-auto border border-navy-100 p-2 sm:grid-cols-2 xl:grid-cols-3">
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
                      {athlete.is_archived ? (
                        <span
                          className="text-[10px] uppercase tracking-[0.1em] text-amber-700"
                          title="Новичок без очков: в рейтинге не показывается, но его можно добавить в любой турнир"
                        >
                          архив
                        </span>
                      ) : null}
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
                        text:
                          settings.format === "olympic"
                            ? "Участники будут расставлены в сетку на вылет по рейтингу: сильнейшие первый круг проходят без соперника. Все ранее введённые встречи и результаты будут удалены."
                            : "Участники будут распределены по группам подряд по рейтингу (лиги могут смешиваться), а все ранее введённые результаты удалены.",
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
              {data.tournament.format === "olympic"
                ? "Сохраните состав и проведите жеребьёвку — появится сетка на вылет."
                : "Сохраните состав и проведите жеребьёвку — появится таблица групп и встречи."}
            </p>
          )}

          {data.match_count > 0 && data.groups.length > 0 && (
            <section className="border border-navy-100 bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg normal-case tracking-normal">Круговые таблицы и встречи</h2>
                <p className="max-w-xl text-xs text-graphite-500">
                  Встречи вызываются по кругам: сначала 1-й круг 1-й группы, затем 1-й круг 2-й группы и так
                  далее — все группы проходят круг, прежде чем начнётся следующий.
                </p>
              </div>
              <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] xl:items-start">
                {/* Слева — круговые таблицы всех групп: в них сразу видны очки и места. */}
                <div className="min-w-0 space-y-5">
                  {data.groups.map((group, index) => {
                    const live = previewGroups.find((item) => item.group_no === group.group_no);
                    const rows = live?.rows ?? group.standings;
                    const groupUnsaved = group.matches.some(isUnsaved);
                    return (
                      <div key={group.group_no} className="min-w-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <h3 className="text-base normal-case tracking-normal">Группа {index + 1}</h3>
                          <p className="text-xs text-graphite-500">
                            {group.standings.length} участников · встречи до {group.best_of} партий (победа —{" "}
                            {group.sets_to_win})
                          </p>
                        </div>
                        {groupUnsaved && (
                          <p className="mt-2 border-l-2 border-emerald-600 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                            В таблице уже учтён введённый, но не сохранённый счёт. Нажмите ✓ у встречи, чтобы
                            записать результат.
                          </p>
                        )}
                        <CrossTable
                          standings={rows}
                          matches={group.matches.map(previewMatch)}
                          showRating
                          showSetsRatio
                          className="mt-2 border border-navy-100 bg-white"
                        />
                        <p className="mt-1 text-[11px] text-graphite-500 xl:hidden">
                          На телефоне таблицу можно прокручивать вбок.
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Справа — встречи по кругам: вызов идёт в этом же порядке. */}
                <div className="min-w-0">
                  <h3 className="text-base normal-case tracking-normal">Встречи по кругам</h3>
                  <p className="mt-1 text-xs text-graphite-500">
                    Вызовите встречу, когда пара приглашена на стол: отметка сохранится для всех организаторов.
                  </p>
                  <div className="mt-3 space-y-3">
                    {callPlan.map((round) => (
                      <div key={round.round} className="border border-navy-100">
                        <div className="border-b border-navy-100 bg-mist px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-graphite-600">
                          {round.round}-й круг
                        </div>
                        {round.groups.map((entry) => (
                          <div key={entry.group_no}>
                            <div className="border-b border-navy-100 px-3 py-1 text-[11px] font-medium text-graphite-500">
                              Группа {entry.index + 1}
                            </div>
                            <div className="divide-y divide-navy-100">
                              {entry.matches.map((match) => (
                                <MatchRow
                                  key={match.id}
                                  match={match}
                                  number={callNumbers.get(match.id)}
                                  scores={scores[match.id] ?? { a: "", b: "" }}
                                  winSets={winSetsOfMatch(match, data)}
                                  finished={finished}
                                  busy={busy}
                                  onChange={(side, value) => updateScore(match.id, side, value)}
                                  onSave={() => void saveMatch(match)}
                                  onCall={(called) => void toggleCall(match, called)}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {data.playoff.length > 0 && (
            <section className="border border-navy-100 bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg normal-case tracking-normal">Сетка</h2>
                <p className="text-xs text-graphite-500">Счёт вводится в блоках ниже. Здесь видна сетка целиком, с учётом уже набранных, но не сохранённых партий.</p>
              </div>
              <BracketView
                rounds={data.playoff.map((round) => ({ ...round, matches: round.matches.map(previewMatch) }))}
                places={
                  new Map(
                    data.participants
                      .filter((participant) => participant.place !== null)
                      .map((participant) => [participant.athlete_id, Number(participant.place)]),
                  )
                }
                className="mt-4"
              />
            </section>
          )}

          {data.playoff.map((round) => (
            <Fragment key={`${round.place_from ?? 0}:${round.round}`}>
              <section className="border border-navy-100 bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-lg normal-case tracking-normal">{round.label}</h3>
                  {round.matches.every((match) => match.number) && (
                    <span className="text-xs text-graphite-500">
                      встречи {Math.min(...round.matches.map((match) => Number(match.number)))}–
                      {Math.max(...round.matches.map((match) => Number(match.number)))}
                    </span>
                  )}
                </div>
                <div className="mt-3 divide-y divide-navy-100 border border-navy-100">
                  {round.matches.map((match) => (
                    <MatchRow
                      key={match.id}
                      match={match}
                      scores={scores[match.id] ?? { a: "", b: "" }}
                      winSets={round.sets_to_win}
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
  number,
  scores,
  winSets,
  finished,
  busy,
  onChange,
  onSave,
  onCall,
}: {
  match: TournamentMatch;
  /** Номер встречи в порядке вызова: 1, 2, 3 … */
  number?: number;
  scores: { a: string; b: string };
  /** Сколько партий нужно выиграть: 3 из 5, 4 из 7, 2 из 3. */
  winSets: number;
  finished: boolean;
  busy: boolean;
  onChange: (side: "a" | "b", value: string) => void;
  onSave: () => void;
  /** Вызов встречи на стол; undefined — у встречи нет вызова (плей-офф). */
  onCall?: (called: boolean) => void;
}) {
  const winnerA = match.winner_id === match.player_a;
  const winnerB = match.winner_id === match.player_b;
  // Счёт, который сейчас набран в полях: показываем его сразу, не дожидаясь сохранения.
  const parsed = parseScoreEntry(scores, winSets);
  const scoreA = parsed ? parsed.a : null;
  const scoreB = parsed ? parsed.b : null;
  const decided = scoreA !== null && scoreB !== null && scoreA !== scoreB;
  const previewWinner = !decided ? null : (scoreA as number) > (scoreB as number) ? "a" : "b";
  const legal =
    decided &&
    Math.max(scoreA as number, scoreB as number) === winSets &&
    Math.min(scoreA as number, scoreB as number) < winSets;
  const techWinner = parsed?.techLossA ? "b" : parsed?.techLossB ? "a" : null;
  const unsavedScore = decided && (match.score_a !== scoreA || match.score_b !== scoreB);
  const winnerName = previewWinner === "a" ? match.player_a_name : match.player_b_name;
  // В поле вводится число партий или «w» — техническая победа при 0 у соперника.
  const change = (side: "a" | "b", value: string) => {
    onChange(side, value.replace(/[^0-9wW]/g, "").slice(0, 1));
  };
  const calledAt = match.called_at ?? null;
  const calledTime = calledAt
    ? new Date(calledAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : "";
  const played = match.score_a !== null && match.score_b !== null;
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
      {typeof number === "number" && (
        <span
          className="w-5 shrink-0 text-center font-display text-[11px] text-graphite-400"
          title="Номер встречи в порядке вызова"
        >
          {number}
        </span>
      )}
      <span className={cn("min-w-0 flex-1 truncate text-right", winnerA || previewWinner === "a" ? "font-semibold text-navy-900" : "text-graphite-700")}>
        {match.player_a_name}
      </span>
      {finished ? (
        <span
          className="min-w-16 text-center font-display text-base text-navy-900"
          title={
            match.tech_loss_a || match.tech_loss_b
              ? "Техническая победа: соперник отдал встречу"
              : undefined
          }
        >
          {match.tech_loss_a
            ? "0 : w"
            : match.tech_loss_b
              ? "w : 0"
              : `${match.score_a ?? "—"}:${match.score_b ?? "—"}`}
        </span>
      ) : (
        <span className="order-last flex w-full items-center justify-center gap-1 sm:order-none sm:w-auto">
          <input
            type="text"
            inputMode="numeric"
            value={scores.a}
            onChange={(event) => change("a", event.target.value)}
            placeholder={String(winSets)}
            title="Выигранные партии. «w» вместо счёта при 0 у соперника — техническая победа."
            className={cn(
              "field-input !min-h-9 w-14 px-2 py-1 text-center",
              legal && previewWinner === "a" && "border-emerald-600 font-semibold text-emerald-800",
              decided && !legal && "border-accent-600 text-accent-700",
            )}
            aria-label={`Счёт ${match.player_a_name}`}
          />
          <span className="text-graphite-400">:</span>
          <input
            type="text"
            inputMode="numeric"
            value={scores.b}
            onChange={(event) => change("b", event.target.value)}
            placeholder={String(winSets)}
            title="Выигранные партии. «w» вместо счёта при 0 у соперника — техническая победа."
            className={cn(
              "field-input !min-h-9 w-14 px-2 py-1 text-center",
              legal && previewWinner === "b" && "border-emerald-600 font-semibold text-emerald-800",
              decided && !legal && "border-accent-600 text-accent-700",
            )}
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
      {onCall && !finished && !played && (
        <button
          type="button"
          className={cn(
            "flex h-8 shrink-0 items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-wide",
            calledAt
              ? "px-2 bg-amber-100 text-amber-900 hover:bg-amber-200"
              : "w-8 text-graphite-500 hover:bg-mist hover:text-navy-900",
          )}
          disabled={busy}
          onClick={() => onCall(!calledAt)}
          title={calledAt ? `Встреча вызвана в ${calledTime}. Нажмите, чтобы снять вызов.` : "Вызвать встречу на стол"}
          aria-label={calledAt ? `Снять вызов (встреча вызвана в ${calledTime})` : "Вызвать встречу на стол"}
        >
          {calledAt ? (
            <>
              <X size={13} aria-hidden="true" /> {calledTime}
            </>
          ) : (
            <Megaphone size={15} aria-hidden="true" />
          )}
        </button>
      )}
      {unsavedScore && (
        <p className={cn("w-full text-[11px] leading-tight", legal ? "text-emerald-700" : "text-accent-700")}>
          {techWinner
            ? `Предпросмотр, ещё не сохранено: техническая победа ${winnerName} — ${scoreA}:${scoreB}`
            : legal
              ? `Предпросмотр, ещё не сохранено: ${scoreA}:${scoreB} — победа ${winnerName}`
              : `Счёт пока не финальный: встреча идёт до ${winSets} партий, у победителя — ${winSets}`}
        </p>
      )}
    </div>
  );
}
