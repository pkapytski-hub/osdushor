// Панель управления: конструктор соревнований. Турнир собирается по выбранной
// схеме из настоящего списка спортсменов, жеребьёвка и встречи сохраняются
// в те же таблицы, что читает страница после перезагрузки.

import { ApiProblem, fail, int, ok, readJson, str, uuid } from "../lib/http";
import { audit, type SessionUser } from "../lib/auth";
import { legacyFormatForScheme, schemeById, type SchemeId } from "../lib/schemes";
import { applyScore, createDraft, scoreError, type DraftParticipant } from "../lib/stages";
import { listConstructorTournaments, loadCompetition, saveCompetition } from "../lib/stages-db";

const BEST_OF_OPTIONS = [3, 5, 7];
const MAX_PARTICIPANTS = 128;

/** Спортсмены школы для выбора в конструкторе: сначала действующие, архивные — в конце. */
async function listAthletes(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT id, full_name, rating, birth_year, is_archived
     FROM athletes WHERE is_active = 1
     ORDER BY is_archived, rating DESC, full_name`,
  ).all<Record<string, unknown>>();
  return ok({
    items: (results ?? []).map((row) => ({
      id: String(row.id),
      full_name: String(row.full_name),
      rating: Number(row.rating ?? 0),
      birth_year: row.birth_year == null ? null : Number(row.birth_year),
      is_archived: Number(row.is_archived ?? 0) === 1,
    })),
  });
}

interface TournamentPayload {
  title: string;
  heldOn: string;
  schemeId: SchemeId;
  bestOf: number;
  athleteIds: string[];
  errors: Record<string, string>;
}

function tournamentPayload(body: Record<string, unknown>): TournamentPayload {
  const title = str(body.title, 200).trim();
  const heldOn = str(body.held_on, 10);
  const schemeId = str(body.scheme_id, 40);
  const bestOf = int(body.best_of, 5);
  const raw = Array.isArray(body.athlete_ids) ? body.athlete_ids : [];
  const athleteIds = [...new Set(raw.map((value) => str(value, 80)).filter(Boolean))].slice(
    0,
    MAX_PARTICIPANTS,
  );
  const errors: Record<string, string> = {};
  if (title.length < 2) errors.title = "Укажите название турнира.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(heldOn)) errors.held_on = "Укажите дату в формате ГГГГ-ММ-ДД.";
  if (!schemeById(schemeId)) errors.scheme_id = "Выберите схему проведения.";
  if (!BEST_OF_OPTIONS.includes(bestOf)) errors.best_of = "Встреча: до 3, 5 или 7 партий.";
  if (athleteIds.length < 2) errors.athlete_ids = "Выберите хотя бы двух участников.";
  return { title, heldOn, schemeId: schemeId as SchemeId, bestOf, athleteIds, errors };
}

async function createTournament(env: Env, user: SessionUser, request: Request): Promise<Response> {
  const payload = tournamentPayload(await readJson(request));
  if (Object.keys(payload.errors).length > 0) {
    throw new ApiProblem(400, "validation_failed", "Проверьте данные турнира.", payload.errors);
  }
  const scheme = schemeById(payload.schemeId);
  if (!scheme) throw new ApiProblem(400, "validation_failed", "Проверьте данные турнира.");

  const placeholders = payload.athleteIds.map(() => "?").join(", ");
  const { results } = await env.DB.prepare(
    `SELECT id, full_name, rating FROM athletes WHERE id IN (${placeholders})`,
  )
    .bind(...payload.athleteIds)
    .all<{ id: string; full_name: string; rating: number }>();
  const athletes = results ?? [];
  if (athletes.length !== payload.athleteIds.length) {
    throw new ApiProblem(400, "invalid_participants", "Некоторые спортсмены не найдены.");
  }

  // Жеребьёвка идёт по силе: список спортсменов отдаётся движку от сильнейшего.
  const participants: DraftParticipant[] = athletes
    .map((row) => ({
      athlete_id: String(row.id),
      full_name: String(row.full_name),
      rating: Number(row.rating ?? 0),
    }))
    .sort((a, b) => b.rating - a.rating || a.full_name.localeCompare(b.full_name, "ru"));

  const groupStage = scheme.stages.find((stage) => stage.kind === "groups");
  const tournamentId = uuid();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO tournaments (id, title, held_on, format, scheme_id, group_size, playoff_size,
         best_of, coefficient, notes, is_published)
       VALUES (?, ?, ?, ?, ?, ?, 8, ?, 0.5, NULL, 0)`,
    ).bind(
      tournamentId,
      payload.title,
      payload.heldOn,
      legacyFormatForScheme(payload.schemeId),
      payload.schemeId,
      groupStage?.groupSize || 6,
      payload.bestOf,
    ),
    ...participants.map((participant, index) =>
      env.DB.prepare(
        `INSERT INTO tournament_participants (tournament_id, athlete_id, seed, rating_before)
         VALUES (?, ?, ?, ?)`,
      ).bind(tournamentId, participant.athlete_id, index + 1, participant.rating),
    ),
  ]);

  const draft = createDraft(payload.schemeId, participants, payload.bestOf);
  await saveCompetition(env, tournamentId, draft);
  await audit(env, user, "create", "tournament_constructor", tournamentId, payload.title);

  const item = await loadCompetition(env, tournamentId);
  return ok({ item });
}

/**
 * Счёт встречи сохраняется в базу сразу: после него движок пересобирает
 * следующие этапы, и они тоже записываются. Пустой счёт (null / null) снимает
 * результат и откатывает зависимые этапы.
 */
async function updateMatch(
  env: Env,
  user: SessionUser,
  id: string,
  matchId: string,
  request: Request,
): Promise<Response> {
  const record = await loadCompetition(env, id);
  if (!record) return fail(404, "not_found", "Турнир не найден.");
  const match = record.draft.stages
    .flatMap((stage) => stage.matches)
    .find((item) => item.id === matchId);
  if (!match) return fail(404, "not_found", "Встреча не найдена.");

  const body = await readJson(request);
  const empty = body.score_a === null && body.score_b === null;
  let scoreA: number | null = null;
  let scoreB: number | null = null;
  if (!empty) {
    scoreA = int(body.score_a, -1);
    scoreB = int(body.score_b, -1);
    const error = scoreError(record.draft, scoreA, scoreB);
    if (error) {
      return fail(400, "invalid_score", error, {
        score_a: "Проверьте счёт.",
        score_b: "Проверьте счёт.",
      });
    }
  }

  const draft = applyScore(record.draft, matchId, scoreA, scoreB);
  await saveCompetition(env, id, draft);
  await audit(
    env,
    user,
    "update",
    "tournament_stage_match",
    matchId,
    `${scoreA ?? "—"}:${scoreB ?? "—"}`,
  );
  const item = await loadCompetition(env, id);
  return ok({ item });
}

async function listTournaments(env: Env): Promise<Response> {
  return ok({ items: await listConstructorTournaments(env) });
}

async function getTournament(env: Env, id: string): Promise<Response> {
  // loadCompetition пересобирает черновик через syncDraft: недостающие встречи
  // сетки достраиваются, а счёт берётся только из сохранённых встреч.
  const record = await loadCompetition(env, id);
  if (!record) return fail(404, "not_found", "Турнир не найден.");
  return ok({ item: record });
}

export async function handleConstructorAdmin(
  request: Request,
  env: Env,
  user: SessionUser,
  rest: string[],
): Promise<Response> {
  const method = request.method;
  const [resource, id, action, matchId] = rest;

  if (resource === "athletes" && method === "GET") return listAthletes(env);
  if (resource !== "tournaments") return fail(404, "not_found", "Раздел конструктора не найден.");

  if (!id) {
    if (method === "GET") return listTournaments(env);
    if (method === "POST") return createTournament(env, user, request);
    return fail(405, "method_not_allowed", "Метод не поддерживается.");
  }
  if (!action) {
    if (method === "GET") return getTournament(env, id);
    return fail(405, "method_not_allowed", "Метод не поддерживается.");
  }
  if (action === "matches" && matchId && (method === "PATCH" || method === "PUT")) {
    return updateMatch(env, user, id, matchId, request);
  }
  return fail(404, "not_found", "Действие конструктора не найдено.");
}
