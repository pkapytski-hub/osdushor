import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  CircleDot,
  Info,
  ListOrdered,
  Loader2,
  RefreshCw,
  Search,
  Trophy,
  Users,
  X,
} from "lucide-react";
import {
  api,
  ApiError,
  type ConstructorAthlete,
  type ConstructorRecord,
  type ConstructorTournament,
} from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AdminCard, AdminPageHeader } from "@/pages/admin/admin-ui";
import { SCHEMES, schemeById, type SchemeId } from "../../worker/lib/schemes";
import {
  bracketRounds,
  computePlaces,
  draftFinished,
  participantName,
  scoreError,
  stageTables,
  type CompetitionDraft,
  type Stage,
  type StageMatch,
} from "../../worker/lib/stages";
import { setsToWin } from "../../worker/lib/tournament";

// Конструктор турнира: схема, этапы, группы и сетки, встречи со счётом
// по партиям и итоговые места. Всё сохраняется в базу сразу — после
// перезагрузки турнир открывается по ссылке /admin/konstruktor?id=…

const BEST_OF = [3, 5, 7];
const LABEL = "text-[11px] uppercase tracking-[0.14em] text-graphite-500";
const INPUT =
  "mt-1 h-10 w-full border border-navy-200 bg-white px-3 text-sm text-navy-900 outline-none focus:border-navy-900";

function today(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Не удалось выполнить действие. Повторите попытку.";
}

export default function ConstructorPage() {
  const [params, setParams] = useSearchParams();
  const openId = params.get("id") ?? "";

  const [athletes, setAthletes] = useState<ConstructorAthlete[]>([]);
  const [list, setList] = useState<ConstructorTournament[]>([]);
  const [record, setRecord] = useState<ConstructorRecord | null>(null);
  const [loading, setLoading] = useState(Boolean(openId));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingMatch, setSavingMatch] = useState("");

  const [title, setTitle] = useState("Турнир школы");
  const [heldOn, setHeldOn] = useState(today);
  const [schemeId, setSchemeId] = useState<SchemeId>("groups_bracket");
  const [bestOf, setBestOf] = useState(5);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  async function reloadList() {
    try {
      const response = await api.admin.constructor.list();
      setList(response.items);
    } catch {
      // Список — подсказка: ошибка загрузки не должна мешать работать с турниром.
    }
  }

  useEffect(() => {
    let alive = true;
    api.admin.constructor
      .athletes()
      .then((response) => {
        if (alive) setAthletes(response.items);
      })
      .catch((cause) => {
        if (alive) setError(messageOf(cause));
      });
    api.admin.constructor
      .list()
      .then((response) => {
        if (alive) setList(response.items);
      })
      .catch(() => {
        /* список необязателен */
      });
    return () => {
      alive = false;
    };
  }, []);

  async function openTournament(id: string) {
    setLoading(true);
    setError("");
    try {
      const response = await api.admin.constructor.item(id);
      setRecord(response.item);
    } catch (cause) {
      setRecord(null);
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!openId) {
      setRecord(null);
      return;
    }
    void openTournament(openId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  const visibleAthletes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return athletes;
    return athletes.filter((athlete) => athlete.full_name.toLowerCase().includes(needle));
  }, [athletes, query]);

  function toggle(athleteId: string) {
    setSelected((current) =>
      current.includes(athleteId)
        ? current.filter((id) => id !== athleteId)
        : [...current, athleteId],
    );
  }

  async function create() {
    setBusy(true);
    setError("");
    try {
      const response = await api.admin.constructor.create({
        title: title.trim(),
        held_on: heldOn,
        scheme_id: schemeId,
        best_of: bestOf,
        athlete_ids: selected,
      });
      if (!response.item) throw new ApiError("Сервер не вернул турнир.", "empty_response");
      setRecord(response.item);
      setParams({ id: response.item.tournament.id });
      toast.success("Турнир сохранён в базу");
      void reloadList();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  async function saveScore(matchId: string, scoreA: number | null, scoreB: number | null) {
    if (!record) return;
    setSavingMatch(matchId);
    try {
      const response = await api.admin.constructor.score(
        record.tournament.id,
        matchId,
        scoreA,
        scoreB,
      );
      if (response.item) setRecord(response.item);
      void reloadList();
    } catch (cause) {
      toast.error(messageOf(cause));
    } finally {
      setSavingMatch("");
    }
  }

  const scheme = record ? schemeById(record.draft.scheme_id) ?? SCHEMES[0] : null;
  const draft = record?.draft ?? null;
  const places = useMemo(() => (draft ? computePlaces(draft) : []), [draft]);
  const finished = draft ? draftFinished(draft) : false;
  const played = draft
    ? draft.stages.reduce((sum, stage) => sum + stage.matches.filter(isScored).length, 0)
    : 0;
  const total = draft ? draft.stages.reduce((sum, stage) => sum + stage.matches.length, 0) : 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Соревнования"
        title="Конструктор турнира"
        description="Схема, этапы, группы и сетки, встречи со счётом по партиям и итоговые места. Турнир сохраняется в базу и открывается снова в том же виде."
        actions={
          openId ? (
            <>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => void openTournament(openId)}
                disabled={loading}
              >
                <RefreshCw size={14} aria-hidden="true" /> Обновить
              </button>
              <Link to="/admin/konstruktor" className="btn btn-outline btn-sm">
                <ArrowLeft size={14} aria-hidden="true" /> К списку
              </Link>
            </>
          ) : undefined
        }
      />

      {error && (
        <p className="border-l-2 border-accent-600 bg-white px-4 py-3 text-sm text-accent-700" role="alert">
          {error}
        </p>
      )}

      {!openId && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <AdminCard>
            <h2 className="text-lg">Новый турнир</h2>
            <p className="mt-1 text-sm leading-relaxed text-graphite-500">
              Выберите схему и участников из списка спортсменов. Жеребьёвка и встречи сохранятся
              в базу сразу — турнир не потеряется при перезагрузке.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={LABEL}>Название</span>
                <input
                  className={INPUT}
                  value={title}
                  maxLength={200}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Первенство школы"
                />
              </label>
              <label className="block">
                <span className={LABEL}>Дата</span>
                <input
                  className={INPUT}
                  type="date"
                  value={heldOn}
                  onChange={(event) => setHeldOn(event.target.value)}
                />
              </label>
            </div>

            <p className={cn(LABEL, "mt-6")}>Схема проведения</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
              {SCHEMES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSchemeId(item.id)}
                  className={cn(
                    "border p-3 text-left transition-colors",
                    item.id === schemeId
                      ? "border-navy-900 bg-navy-900 text-white"
                      : "border-navy-100 bg-white hover:border-navy-300",
                  )}
                  aria-pressed={item.id === schemeId}
                >
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-[0.14em]",
                      item.id === schemeId ? "text-accent-300" : "text-accent-600",
                    )}
                  >
                    {item.flow}
                  </span>
                  <span className="mt-1 block font-display text-sm uppercase leading-tight">
                    {item.title}
                  </span>
                  <span
                    className={cn(
                      "mt-1 block text-[12px] leading-snug",
                      item.id === schemeId ? "text-navy-100" : "text-graphite-500",
                    )}
                  >
                    {item.description}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className={LABEL}>Участники</p>
                  <div className="flex gap-3 text-[11px] uppercase tracking-[0.1em]">
                    <button
                      type="button"
                      className="text-graphite-500 hover:text-accent-600"
                      onClick={() => setSelected(athletes.map((athlete) => athlete.id))}
                    >
                      Выбрать всех
                    </button>
                    <button
                      type="button"
                      className="text-graphite-500 hover:text-accent-600"
                      onClick={() => setSelected([])}
                    >
                      Снять
                    </button>
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-2 border border-navy-200 bg-white px-2">
                  <Search size={14} className="shrink-0 text-graphite-400" aria-hidden="true" />
                  <input
                    className="h-9 w-full border-0 bg-transparent text-sm outline-none"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Поиск по фамилии"
                    aria-label="Поиск спортсмена"
                  />
                </div>
                <div className="mt-2 max-h-64 divide-y divide-navy-100 overflow-y-auto border border-navy-100 bg-white">
                  {visibleAthletes.map((athlete) => (
                    <label
                      key={athlete.id}
                      className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-mist"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0"
                        checked={selected.includes(athlete.id)}
                        onChange={() => toggle(athlete.id)}
                      />
                      <span className="min-w-0 flex-1 truncate text-navy-900">{athlete.full_name}</span>
                      {athlete.is_archived && (
                        <span className="shrink-0 border border-graphite-300 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-graphite-500">
                          архив
                        </span>
                      )}
                      <span className="shrink-0 text-xs text-graphite-500">
                        {Math.round(athlete.rating)}
                      </span>
                    </label>
                  ))}
                  {visibleAthletes.length === 0 && (
                    <p className="px-3 py-4 text-sm text-graphite-500">
                      {athletes.length === 0 ? "Список спортсменов пуст." : "Никого не найдено."}
                    </p>
                  )}
                </div>
                <p className="mt-2 text-xs text-graphite-500">
                  Выбрано {selected.length} из {athletes.length}. Рейтинг показан справа.
                </p>
              </div>

              <div>
                <p className={LABEL}>Партии во встрече</p>
                <div className="mt-2 flex gap-2">
                  {BEST_OF.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={cn("chip", value === bestOf && "chip-active")}
                      onClick={() => setBestOf(value)}
                    >
                      до {value}
                    </button>
                  ))}
                </div>
                <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-graphite-500">
                  <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                  Счёт вводится по партиям: при встрече до {bestOf} партий победитель берёт{" "}
                  {setsToWin(bestOf)}.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-navy-100 pt-4">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => void create()}
                disabled={busy || selected.length < 2 || title.trim().length < 2}
              >
                {busy ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                ) : null}
                Создать турнир и провести жеребьёвку
              </button>
              {selected.length < 2 && (
                <span className="text-xs text-graphite-500">Нужны хотя бы два участника.</span>
              )}
            </div>
          </AdminCard>

          <AdminCard className="h-fit">
            <h2 className="text-lg">Сохранённые турниры</h2>
            {list.length === 0 ? (
              <p className="mt-3 text-sm leading-relaxed text-graphite-500">
                Пока пусто. Создайте турнир — он появится здесь и откроется после перезагрузки
                страницы.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-navy-100">
                {list.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={`/admin/konstruktor?id=${encodeURIComponent(item.id)}`}
                      className="-mx-2 block px-2 py-3 hover:bg-mist"
                    >
                      <span className="block font-medium text-navy-900">{item.title}</span>
                      <span className="mt-0.5 block text-xs text-graphite-500">
                        {formatDate(item.held_on)} ·{" "}
                        {schemeById(item.scheme_id)?.short ?? item.scheme_id}
                      </span>
                      <span className="mt-1 block text-xs text-graphite-500">
                        встреч {item.played} из {item.matches} · мест в базе {item.places}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        </div>
      )}

      {openId && loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse border border-navy-100 bg-white" />
          ))}
        </div>
      )}

      {openId && !loading && record && draft && scheme && (
        <div className="space-y-6">
          <AdminCard>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="section-label">{scheme.flow}</p>
                <h2 className="mt-1 text-xl">{record.tournament.title}</h2>
                <p className="mt-1 text-sm text-graphite-500">
                  {formatDate(record.tournament.held_on)} · {record.tournament.participants} участников · до{" "}
                  {draft.best_of} партий
                </p>
              </div>
              <div className="text-right">
                <span
                  className={cn(
                    "badge",
                    finished
                      ? "border border-emerald-600/30 bg-emerald-50 text-emerald-800"
                      : "border border-graphite-300 bg-mist text-graphite-500",
                  )}
                >
                  {finished
                    ? `Итоги · ${record.tournament.places} мест в базе`
                    : "Черновик · сохранён в базу"}
                </span>
                <p className="mt-2 text-xs text-graphite-500">
                  Этап {draft.stages.length} из {scheme.stages.length}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-navy-100 pt-3 text-sm text-graphite-600">
              <span className="inline-flex items-center gap-2">
                <Users size={15} aria-hidden="true" /> {record.tournament.participants} участников
              </span>
              <span className="inline-flex items-center gap-2">
                <CircleDot size={15} aria-hidden="true" /> до {draft.best_of} партий
              </span>
              <span className="inline-flex items-center gap-2">
                <ListOrdered size={15} aria-hidden="true" /> встреч: {played} из {total}
              </span>
            </div>
          </AdminCard>

          {draft.stages.map((stage, index) => {
            const stagePlayed = stage.matches.filter(isScored).length;
            const next = scheme.stages[index + 1];
            return (
              <article key={`${stage.no}-${stage.kind}`} className="border border-navy-100 bg-white">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-100 bg-mist/70 px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="badge bg-navy-900 text-white">Этап {stage.no}</span>
                    <h2 className="text-lg leading-none">{stage.title}</h2>
                    <span className="text-xs uppercase tracking-[0.12em] text-graphite-500">
                      {stage.kind === "groups" ? "Группы" : "Сетка"} · {stage.entries.length}{" "}
                      участников
                    </span>
                  </div>
                  <span className="text-xs text-graphite-500">
                    Встреч: {stagePlayed} из {stage.matches.length}
                  </span>
                </header>

                {stage.kind === "groups" ? (
                  <GroupStage
                    draft={draft}
                    stage={stage}
                    savingMatch={savingMatch}
                    onScore={saveScore}
                  />
                ) : (
                  <BracketStage
                    draft={draft}
                    stage={stage}
                    savingMatch={savingMatch}
                    onScore={saveScore}
                  />
                )}

                {next && stagePlayed === stage.matches.length && (
                  <p className="border-t border-navy-100 bg-navy-50/60 px-4 py-2.5 text-xs leading-relaxed text-graphite-600 sm:px-5">
                    Этап доигран. Следующий этап — «{next.title}» — собирается автоматически по
                    местам в группах и тоже сохраняется.
                  </p>
                )}
              </article>
            );
          })}

          {!finished && draft.stages.length < scheme.stages.length && (
            <p className="flex items-start gap-2 border-l-2 border-navy-300 bg-white px-4 py-3 text-sm leading-relaxed text-graphite-600">
              <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              Заполните все встречи текущего этапа — следующий этап появится сам: пары соберутся по
              таблицам, без ручной жеребьёвки.
            </p>
          )}

          {finished && places.length > 0 && (
            <section className="border border-navy-900">
              <header className="flex flex-wrap items-center justify-between gap-3 bg-navy-900 px-4 py-4 text-white sm:px-5">
                <div className="flex items-center gap-3">
                  <Trophy size={20} aria-hidden="true" />
                  <h2 className="text-xl text-white">Итоговые места</h2>
                </div>
                <span className="text-sm text-navy-100">
                  Победитель: {places[0]?.full_name} · места сохранены в базе
                </span>
              </header>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-mist text-[10px] uppercase tracking-[0.14em] text-graphite-500">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 font-medium">Место</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Спортсмен</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">В</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">П</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Откуда место</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-100">
                    {places.map((row) => (
                      <tr key={row.athlete_id} className={row.place === 1 ? "bg-accent-50" : undefined}>
                        <td className="px-4 py-2 font-display text-base text-navy-900">{row.place}</td>
                        <td className="px-4 py-2 font-medium text-navy-900">{row.full_name}</td>
                        <td className="px-4 py-2 text-graphite-600">{row.wins}</td>
                        <td className="px-4 py-2 text-graphite-600">{row.losses}</td>
                        <td className="px-4 py-2 text-graphite-500">{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="border border-navy-100 bg-white">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-100 px-4 py-3 sm:px-5">
              <h2 className="text-lg">Все встречи</h2>
              <span className="text-xs uppercase tracking-[0.12em] text-graphite-500">
                {played} из {total} сыграно
              </span>
            </header>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead className="sticky top-0 bg-mist text-[10px] uppercase tracking-[0.14em] text-graphite-500">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Этап</th>
                    <th scope="col" className="px-3 py-2 font-medium">Группа</th>
                    <th scope="col" className="px-3 py-2 font-medium">Круг</th>
                    <th scope="col" className="px-3 py-2 font-medium">Встреча</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Счёт</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-100">
                  {draft.stages.flatMap((stage) =>
                    stage.matches.map((match) => (
                      <tr key={match.id}>
                        <td className="px-3 py-1.5 text-graphite-500">{stage.no}</td>
                        <td className="px-3 py-1.5 text-graphite-500">
                          {match.group_no == null ? "—" : match.group_no}
                        </td>
                        <td className="px-3 py-1.5 text-graphite-500">{match.round}</td>
                        <td className="px-3 py-1.5">
                          {participantName(draft, match.player_a)} —{" "}
                          {participantName(draft, match.player_b)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-medium text-navy-900">
                          {isScored(match) ? `${match.score_a}:${match.score_b}` : "—"}
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {openId && !loading && !record && !error && (
        <p className="border border-navy-100 bg-white px-4 py-6 text-sm text-graphite-500">
          Турнир не найден. Откройте его из списка сохранённых.
        </p>
      )}
    </div>
  );
}

function isScored(match: StageMatch): boolean {
  return match.score_a !== null && match.score_b !== null;
}

type ScoreHandler = (
  matchId: string,
  scoreA: number | null,
  scoreB: number | null,
) => Promise<void> | void;

function GroupStage({
  draft,
  stage,
  savingMatch,
  onScore,
}: {
  draft: CompetitionDraft;
  stage: Stage;
  savingMatch: string;
  onScore: ScoreHandler;
}) {
  return (
    <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
      {stageTables(stage).map((table) => (
        <div key={table.no} className="border border-navy-100">
          <div className="flex items-center justify-between gap-2 bg-mist px-3 py-2">
            <h3 className="text-sm leading-none">{table.title}</h3>
            <span className="text-[11px] uppercase tracking-[0.12em] text-graphite-500">
              {table.rows.length} человек
            </span>
          </div>
          <table className="w-full border-collapse text-left text-[13px]">
            <thead className="text-[10px] uppercase tracking-[0.12em] text-graphite-500">
              <tr>
                <th scope="col" className="w-8 px-2 py-1.5 font-medium">№</th>
                <th scope="col" className="px-2 py-1.5 font-medium">Спортсмен</th>
                <th scope="col" className="w-8 px-1 py-1.5 text-center font-medium">И</th>
                <th scope="col" className="w-8 px-1 py-1.5 text-center font-medium">В</th>
                <th scope="col" className="w-8 px-1 py-1.5 text-center font-medium">П</th>
                <th scope="col" className="w-10 px-1 py-1.5 text-center font-medium">О</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100/80">
              {table.rows.map((row) => (
                <tr key={row.athlete_id}>
                  <td className="px-2 py-1.5 font-display text-navy-900">{row.place}</td>
                  <td className="px-2 py-1.5 text-navy-900">{row.full_name}</td>
                  <td className="px-1 py-1.5 text-center text-graphite-600">{row.played}</td>
                  <td className="px-1 py-1.5 text-center text-graphite-600">{row.wins}</td>
                  <td className="px-1 py-1.5 text-center text-graphite-600">{row.losses}</td>
                  <td className="px-1 py-1.5 text-center font-semibold text-navy-900">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="divide-y divide-navy-100 border-t border-navy-100">
            {stage.matches
              .filter((match) => match.group_no === table.no)
              .map((match) => (
                <div
                  key={match.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-1.5 text-[13px]"
                >
                  <span className={cn("truncate text-navy-900", winner(match) === "a" && "font-semibold")}>
                    {participantName(draft, match.player_a)}
                  </span>
                  <ScorePick
                    draft={draft}
                    match={match}
                    saving={savingMatch === match.id}
                    onScore={onScore}
                  />
                  <span
                    className={cn(
                      "truncate text-right text-navy-900",
                      winner(match) === "b" && "font-semibold",
                    )}
                  >
                    {participantName(draft, match.player_b)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BracketStage({
  draft,
  stage,
  savingMatch,
  onScore,
}: {
  draft: CompetitionDraft;
  stage: Stage;
  savingMatch: string;
  onScore: ScoreHandler;
}) {
  return (
    <div className="space-y-6 p-4 sm:p-5">
      {stage.groups.map((group) => {
        const entries = stage.entries.filter((entry) => entry.group_no === group.no);
        const offset = stage.entries.filter((entry) => (entry.group_no ?? 1) < group.no).length;
        const rounds = bracketRounds(stage, group.no);
        return (
          <div key={group.no}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-base leading-none">{group.title}</h3>
              <span className="text-[11px] uppercase tracking-[0.12em] text-graphite-500">
                {entries.length} участников · места {offset + 1}–{offset + entries.length}
              </span>
            </div>
            {rounds.length === 0 ? (
              <p className="mt-3 border border-dashed border-navy-200 bg-mist px-3 py-4 text-sm text-graphite-500">
                Пары появятся, когда определятся участники.
              </p>
            ) : (
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {rounds.map((round) => (
                  <div key={round.key} className="border border-navy-100 bg-mist/40">
                    <div className="border-b border-navy-100 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-graphite-500">
                      {round.label}
                    </div>
                    <div className="space-y-2 p-2">
                      {round.matches.map((match) => (
                        <div key={match.id} className="border border-navy-100 bg-white p-2">
                          <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.12em] text-graphite-400">
                            <span>Встреча {match.slot}</span>
                            <span>
                              {match.place_from}–{match.place_to}
                            </span>
                          </div>
                          <div className="mt-1.5 space-y-0.5 text-[13px]">
                            <div
                              className={cn(
                                "truncate text-navy-900",
                                winner(match) === "a" && "font-semibold",
                              )}
                            >
                              {participantName(draft, match.player_a)}
                            </div>
                            <div
                              className={cn(
                                "truncate text-navy-900",
                                winner(match) === "b" && "font-semibold",
                              )}
                            >
                              {participantName(draft, match.player_b)}
                            </div>
                          </div>
                          <div className="mt-2 flex justify-end">
                            <ScorePick
                              draft={draft}
                              match={match}
                              saving={savingMatch === match.id}
                              onScore={onScore}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function winner(match: StageMatch): "a" | "b" | null {
  if (match.score_a === null || match.score_b === null) return null;
  return match.score_a > match.score_b ? "a" : "b";
}

function ScorePick({
  draft,
  match,
  saving,
  onScore,
}: {
  draft: CompetitionDraft;
  match: StageMatch;
  saving: boolean;
  onScore: ScoreHandler;
}) {
  const win = setsToWin(draft.best_of);
  const [a, setA] = useState(match.score_a === null ? "" : String(match.score_a));
  const [b, setB] = useState(match.score_b === null ? "" : String(match.score_b));

  useEffect(() => {
    setA(match.score_a === null ? "" : String(match.score_a));
    setB(match.score_b === null ? "" : String(match.score_b));
  }, [match.id, match.score_a, match.score_b]);

  const values = Array.from({ length: win + 1 }, (_, index) => index);
  const parsedA = a === "" ? null : Number(a);
  const parsedB = b === "" ? null : Number(b);
  const error = parsedA !== null && parsedB !== null ? scoreError(draft, parsedA, parsedB) : null;
  const canApply = parsedA !== null && parsedB !== null && error === null && !saving;

  return (
    <div className="flex items-center gap-1" title={error ?? "Счёт по партиям"}>
      <select
        aria-label="Партии первого участника"
        className="h-8 w-11 border border-navy-200 bg-white text-center text-xs text-navy-900 disabled:opacity-60"
        value={a}
        disabled={saving}
        onChange={(event) => setA(event.target.value)}
      >
        <option value="">—</option>
        {values.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <span className="text-graphite-400">:</span>
      <select
        aria-label="Партии второго участника"
        className="h-8 w-11 border border-navy-200 bg-white text-center text-xs text-navy-900 disabled:opacity-60"
        value={b}
        disabled={saving}
        onChange={(event) => setB(event.target.value)}
      >
        <option value="">—</option>
        {values.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-label="Сохранить счёт"
        className="inline-flex h-8 w-8 items-center justify-center border border-navy-200 text-navy-700 transition-colors hover:border-navy-900 hover:bg-navy-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!canApply}
        onClick={() => {
          if (parsedA !== null && parsedB !== null) void onScore(match.id, parsedA, parsedB);
        }}
      >
        {saving ? (
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        ) : (
          <Check size={14} aria-hidden="true" />
        )}
      </button>
      {(match.score_a !== null || match.score_b !== null) && (
        <button
          type="button"
          aria-label="Сбросить счёт"
          className="inline-flex h-8 w-7 items-center justify-center text-graphite-400 transition-colors hover:text-accent-600 disabled:opacity-40"
          disabled={saving}
          onClick={() => void onScore(match.id, null, null)}
        >
          <X size={13} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
