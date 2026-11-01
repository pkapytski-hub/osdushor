import { ApiProblem, bool, fail, int, ok, readJson, str, uuid } from "../lib/http";
import { audit, type SessionUser } from "../lib/auth";
import {
  allGroupMatchesPlayed,
  computePlaces,
  drawGroups,
  groupMatches,
  leagueForRank,
  leagueStartTime,
  leagueTitle,
  nextPlayoffRound,
  planFinalize,
  qualifiers,
  seededPairs,
  standings,
  type MatchInput,
  type ParticipantInput,
} from "../lib/tournament";

export const TOURNAMENT_FORMATS = ["round_robin", "groups_playoff"] as const;
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number];

interface TournamentRow extends Record<string, unknown> {
  id: string;
  title: string;
  held_on: string;
  format: TournamentFormat;
  group_size: number;
  playoff_size: number;
  coefficient: number;
  notes: string | null;
  is_published: number;
  is_finished: number;
}

interface ParticipantRow extends ParticipantInput {
  rating_after: number | null;
  place: number | null;
  wins: number;
  losses: number;
}

interface FullTournament {
  tournament: TournamentRow;
  participants: ParticipantRow[];
  matches: MatchInput[];
}

function mapTournament(row: Record<string, unknown>): TournamentRow {
  return {
    ...row,
    id: String(row.id),
    title: String(row.title),
    held_on: String(row.held_on),
    format: (row.format === "groups_playoff" ? "groups_playoff" : "round_robin") as TournamentFormat,
    group_size: Number(row.group_size ?? 6),
    playoff_size: Number(row.playoff_size ?? 8),
    coefficient: Number(row.coefficient ?? 0.5),
    notes: row.notes == null ? null : String(row.notes),
    is_published: Number(row.is_published ?? 0),
    is_finished: Number(row.is_finished ?? 0),
  };
}

function mapMatch(row: Record<string, unknown>): MatchInput & {
  player_a_name: string;
  player_b_name: string;
  winner_id: string | null;
  delta_a: number | null;
  delta_b: number | null;
} {
  return {
    id: String(row.id),
    stage: row.stage === "playoff" ? "playoff" : "group",
    group_no: row.group_no == null ? null : Number(row.group_no),
    round: Number(row.round ?? 1),
    slot: Number(row.slot ?? 0),
    player_a: String(row.player_a),
    player_b: String(row.player_b),
    score_a: row.score_a == null ? null : Number(row.score_a),
    score_b: row.score_b == null ? null : Number(row.score_b),
    player_a_name: String(row.player_a_name ?? ""),
    player_b_name: String(row.player_b_name ?? ""),
    winner_id: row.winner_id == null ? null : String(row.winner_id),
    delta_a: row.delta_a == null ? null : Number(row.delta_a),
    delta_b: row.delta_b == null ? null : Number(row.delta_b),
  };
}

async function loadTournament(env: Env, id: string): Promise<FullTournament | null> {
  const row = await env.DB.prepare("SELECT * FROM tournaments WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!row) return null;
  const [participants, matches] = await Promise.all([
    env.DB.prepare(
      `SELECT p.athlete_id, a.full_name, a.birth_year, p.league, p.group_no, p.seed, p.rating_before,
              p.rating_after, p.place, p.wins, p.losses
       FROM tournament_participants p JOIN athletes a ON a.id = p.athlete_id
       WHERE p.tournament_id = ? ORDER BY p.league, p.seed, a.full_name`,
    )
      .bind(id)
      .all<Record<string, unknown>>(),
    env.DB.prepare(
      `SELECT m.*, a.full_name AS player_a_name, b.full_name AS player_b_name
       FROM tournament_matches m
       JOIN athletes a ON a.id = m.player_a
       JOIN athletes b ON b.id = m.player_b
       WHERE m.tournament_id = ?
       ORDER BY CASE m.stage WHEN 'group' THEN 0 ELSE 1 END, m.group_no, m.round, m.slot`,
    )
      .bind(id)
      .all<Record<string, unknown>>(),
  ]);
  return {
    tournament: mapTournament(row),
    participants: (participants.results ?? []).map((participant): ParticipantRow => ({
      athlete_id: String(participant.athlete_id),
      full_name: String(participant.full_name),
      birth_year: participant.birth_year == null ? null : Number(participant.birth_year),
      league: participant.league == null ? null : Number(participant.league),
      group_no: participant.group_no == null ? null : Number(participant.group_no),
      seed: Number(participant.seed ?? 0),
      rating_before: Number(participant.rating_before ?? 0),
      rating_after: participant.rating_after == null ? null : Number(participant.rating_after),
      place: participant.place == null ? null : Number(participant.place),
      wins: Number(participant.wins ?? 0),
      losses: Number(participant.losses ?? 0),
    })),
    matches: (matches.results ?? []).map(mapMatch),
  };
}

async function tournamentView(env: Env, data: FullTournament) {
  const { tournament, participants, matches } = data;
  const leagueNumbers = [...new Set(participants.map((participant) => participant.league).filter((value): value is number => value != null))].sort(
    (a, b) => a - b,
  );
  const leagueByAthlete = new Map(participants.map((participant) => [participant.athlete_id, participant.league ?? 1]));

  const groupMatchesList = matches.filter((match) => match.stage === "group");
  const playoffMatches = matches.filter((match) => match.stage === "playoff");

  // Группы общие для всех лиг: лига влияет только на время турнира.
  const groupNumbers = [...new Set(groupMatchesList.map((match) => match.group_no).filter((value): value is number => value != null))].sort(
    (a, b) => a - b,
  );
  const groups = groupNumbers.map((groupNo) => ({
    group_no: groupNo,
    standings: standings(participants, groupMatchesList, groupNo),
    matches: groupMatchesList.filter((match) => match.group_no === groupNo),
  }));

  const playoff = [...new Set(playoffMatches.map((match) => match.round))]
    .sort((a, b) => a - b)
    .map((round) => ({ round, matches: playoffMatches.filter((match) => match.round === round) }));

  const groupDone = groupMatchesList.length > 0 && allGroupMatchesPlayed(groupMatchesList);
  const playoffsComplete = (() => {
    if (playoffMatches.length === 0) return false;
    const maxRound = Math.max(...playoffMatches.map((match) => match.round));
    const final = playoffMatches.filter((match) => match.round === maxRound);
    return final.length === 1 && final[0].score_a !== null && final[0].score_b !== null;
  })();
  const canPlayoff =
    tournament.format === "groups_playoff" && groupDone && playoffMatches.length === 0 && participants.length >= 2;
  const canFinalize =
    participants.length >= 2 &&
    matches.length > 0 &&
    matches.every((match) => match.score_a !== null && match.score_b !== null) &&
    (tournament.format === "round_robin" || playoffsComplete);
  const plan =
    canFinalize && tournament.is_finished === 0
      ? planFinalize(participants, matches, tournament.coefficient, tournament.format)
      : null;
  const champion = tournament.is_finished
    ? participants.find((participant) => participant.place === 1) ?? null
    : null;
  // Лиги остаются справочной информацией: сколько человек в каждой и во сколько она играет.
  const leagues = leagueNumbers.map((league) => {
    const inLeague = participants.filter((participant) => participant.league === league);
    const leagueMatches = matches.filter(
      (match) =>
        (leagueByAthlete.get(match.player_a) ?? 1) === league || (leagueByAthlete.get(match.player_b) ?? 1) === league,
    );
    return {
      league,
      title: leagueTitle(league),
      start_time: leagueStartTime(league),
      participants: inLeague.length,
      matches: leagueMatches.length,
      played: leagueMatches.filter((match) => match.score_a !== null && match.score_b !== null).length,
    };
  });
  return {
    tournament: { ...tournament, is_published: Boolean(tournament.is_published), is_finished: Boolean(tournament.is_finished) },
    participants: participants
      .map((participant) => ({
        ...participant,
        rating_after: participant.rating_after ?? null,
        place: participant.place ?? null,
        projected_rating:
          tournament.is_finished === 0 && plan
            ? plan.ratingAfter.get(participant.athlete_id) ?? participant.rating_before
            : null,
        projected_delta:
          tournament.is_finished === 0 && plan ? plan.totals.get(participant.athlete_id) ?? 0 : null,
      }))
      .sort(
        (a, b) =>
          (a.place ?? 999) - (b.place ?? 999) ||
          (a.league ?? 99) - (b.league ?? 99) ||
          b.rating_before - a.rating_before,
      ),
    leagues,
    groups,
    playoff,
    group_done: groupDone,
    can_playoff: canPlayoff,
    can_finalize: canFinalize && tournament.is_finished === 0,
    champion,
    match_count: matches.length,
    played_count: matches.filter((match) => match.score_a !== null && match.score_b !== null).length,
  };
}

function checkTournamentEditable(tournament: TournamentRow): void {
  if (tournament.is_finished) {
    throw new ApiProblem(409, "tournament_finished", "Итоги турнира уже подведены. Сначала отмените итоги.");
  }
}

async function saveScores(
  env: Env,
  id: string,
  matchId: string,
  scoreA: number | null,
  scoreB: number | null,
): Promise<void> {
  const winner = scoreA !== null && scoreB !== null ? (scoreA > scoreB ? "a" : "b") : null;
  const match = await env.DB.prepare("SELECT * FROM tournament_matches WHERE id = ? AND tournament_id = ?")
    .bind(matchId, id)
    .first<Record<string, unknown>>();
  if (!match) throw new ApiProblem(404, "not_found", "Встреча не найдена.");
  const winnerId =
    winner === null ? null : winner === "a" ? String(match.player_a) : String(match.player_b);
  await env.DB.prepare(
    "UPDATE tournament_matches SET score_a = ?, score_b = ?, winner_id = ? WHERE id = ? AND tournament_id = ?",
  )
    .bind(scoreA, scoreB, winnerId, matchId, id)
    .run();
  if (match.stage === "playoff" && winnerId) {
    await advancePlayoff(env, id, Number(match.round ?? 1));
  }
}

/** Плей-офф общий: следующий круг собирается из победителей текущего. */
async function advancePlayoff(env: Env, tournamentId: string, round: number): Promise<void> {
  const { results } = await env.DB.prepare(
    `SELECT m.*, a.full_name AS player_a_name, b.full_name AS player_b_name
     FROM tournament_matches m
     JOIN athletes a ON a.id = m.player_a
     JOIN athletes b ON b.id = m.player_b
     WHERE m.tournament_id = ? AND m.stage = 'playoff' AND m.round = ?
     ORDER BY m.slot`,
  )
    .bind(tournamentId, round)
    .all<Record<string, unknown>>();
  const current = (results ?? []).map(mapMatch);
  if (current.length === 0 || current.some((match) => match.score_a === null || match.score_b === null)) return;
  if (current.length === 1) return;
  const next = nextPlayoffRound(current, round);
  if (next.length === 0) return;
  const existing = await env.DB.prepare(
    "SELECT id FROM tournament_matches WHERE tournament_id = ? AND stage = 'playoff' AND round = ? LIMIT 1",
  )
    .bind(tournamentId, round + 1)
    .first();
  if (existing) return;
  await env.DB.batch(
    next.map((match) =>
      env.DB.prepare(
        `INSERT INTO tournament_matches (id, tournament_id, stage, group_no, round, slot, player_a, player_b)
         VALUES (?, ?, 'playoff', NULL, ?, ?, ?, ?)`,
      ).bind(uuid(), tournamentId, match.round, match.slot, match.player_a, match.player_b),
    ),
  );
}

async function refreshRatingSnapshot(env: Env, id: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE tournament_participants
     SET rating_before = (SELECT rating FROM athletes WHERE athletes.id = tournament_participants.athlete_id)
     WHERE tournament_id = ?`,
  )
    .bind(id)
    .run();
}

export async function handleTournamentsAdmin(
  request: Request,
  env: Env,
  user: SessionUser,
  rest: string[],
): Promise<Response> {
  const method = request.method;
  const id = rest[0] ?? "";
  const action = rest[1] ?? "";

  if (!id) {
    if (method === "GET") return listAdminTournaments(env);
    if (method === "POST") return createTournament(env, user, request);
    return fail(405, "method_not_allowed", "Метод не поддерживается.");
  }

  if (!action) {
    if (method === "GET") {
      const data = await loadTournament(env, id);
      if (!data) return fail(404, "not_found", "Турнир не найден.");
      return ok({ item: await tournamentView(env, data) });
    }
    if (method === "PUT" || method === "PATCH") return updateTournament(env, user, id, request);
    if (method === "DELETE") return deleteTournament(env, user, id);
    return fail(405, "method_not_allowed", "Метод не поддерживается.");
  }

  if (action === "participants" && method === "PUT") return setParticipants(env, user, id, request);
  if (action === "draw" && method === "POST") return drawTournament(env, user, id);
  if (action === "playoff" && method === "POST") return drawPlayoff(env, user, id);
  if (action === "finalize" && method === "POST") return finalizeTournament(env, user, id);
  if (action === "reopen" && method === "POST") return reopenTournament(env, user, id);
  if (action === "matches" && rest[2] && (method === "PATCH" || method === "PUT")) {
    return updateMatch(env, user, id, rest[2], request);
  }
  return fail(404, "not_found", "Действие турнира не найдено.");
}

async function listAdminTournaments(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT t.*,
       (SELECT COUNT(*) FROM tournament_participants p WHERE p.tournament_id = t.id) AS participants,
       (SELECT COUNT(*) FROM tournament_matches m WHERE m.tournament_id = t.id) AS matches,
       (SELECT COUNT(*) FROM tournament_matches m WHERE m.tournament_id = t.id AND m.score_a IS NOT NULL AND m.score_b IS NOT NULL) AS played,
       (SELECT a.full_name FROM tournament_participants p JOIN athletes a ON a.id = p.athlete_id
        WHERE p.tournament_id = t.id AND p.place = 1 LIMIT 1) AS winner
     FROM tournaments t ORDER BY t.held_on DESC, t.created_at DESC`,
  ).all<Record<string, unknown>>();
  return ok({ items: (results ?? []).map((row) => ({ ...mapTournament(row), ...row, is_published: Boolean(row.is_published), is_finished: Boolean(row.is_finished) })) });
}

function tournamentSettings(body: Record<string, unknown>): {
  values: Record<string, unknown>;
  errors: Record<string, string>;
} {
  const title = str(body.title, 200);
  const heldOn = str(body.held_on, 10);
  const format = str(body.format, 30);
  const groupSize = int(body.group_size, 6);
  const playoffSize = int(body.playoff_size, 8);
  const coefficient = Number(body.coefficient);
  const notes = str(body.notes, 4_000);
  const errors: Record<string, string> = {};
  if (title.length < 2) errors.title = "Укажите название турнира.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(heldOn)) errors.held_on = "Укажите дату в формате ГГГГ-ММ-ДД.";
  if (!TOURNAMENT_FORMATS.includes(format as TournamentFormat)) errors.format = "Выберите формат турнира.";
  if (groupSize < 2 || groupSize > 8) errors.group_size = "Размер группы: от 2 до 8.";
  if (![2, 4, 8, 16].includes(playoffSize)) errors.playoff_size = "Плей-офф: 2, 4, 8 или 16 участников.";
  if (!Number.isFinite(coefficient) || coefficient <= 0 || coefficient > 5) {
    errors.coefficient = "Коэффициент турнира: больше 0 и не больше 5.";
  }
  return {
    values: {
      title,
      held_on: heldOn,
      format,
      group_size: groupSize,
      playoff_size: playoffSize,
      coefficient: Math.round(coefficient * 100) / 100,
      notes: notes || null,
    },
    errors,
  };
}

async function createTournament(env: Env, user: SessionUser, request: Request): Promise<Response> {
  const body = await readJson(request);
  const { values, errors } = tournamentSettings(body);
  if (Object.keys(errors).length > 0) throw new ApiProblem(400, "validation_failed", "Проверьте данные турнира.", errors);
  const id = uuid();
  await env.DB.prepare(
    `INSERT INTO tournaments (id, title, held_on, format, group_size, playoff_size, coefficient, notes, is_published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      values.title,
      values.held_on,
      values.format,
      values.group_size,
      values.playoff_size,
      values.coefficient,
      values.notes,
      bool(body.is_published) ? 1 : 0,
    )
    .run();
  await audit(env, user, "create", "tournament", id, str(values.title, 120));
  const data = await loadTournament(env, id);
  return ok({ item: data ? await tournamentView(env, data) : null });
}

async function updateTournament(env: Env, user: SessionUser, id: string, request: Request): Promise<Response> {
  const existing = await env.DB.prepare("SELECT * FROM tournaments WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!existing) return fail(404, "not_found", "Турнир не найден.");
  const tournament = mapTournament(existing);
  const body = await readJson(request);
  const { values, errors } = tournamentSettings({ ...existing, ...body });
  if (Object.keys(errors).length > 0) throw new ApiProblem(400, "validation_failed", "Проверьте данные турнира.", errors);
  if (tournament.is_finished && values.format !== tournament.format) {
    return fail(409, "tournament_finished", "Итоги подведены: формат менять нельзя.");
  }
  const structural =
    values.format !== tournament.format ||
    Number(values.group_size) !== tournament.group_size ||
    Number(values.playoff_size) !== tournament.playoff_size;
  await env.DB.prepare(
    `UPDATE tournaments SET title = ?, held_on = ?, format = ?, group_size = ?, playoff_size = ?,
       coefficient = ?, notes = ?, is_published = ?, updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(
      values.title,
      values.held_on,
      values.format,
      values.group_size,
      values.playoff_size,
      values.coefficient,
      values.notes,
      bool(body.is_published) ? 1 : 0,
      id,
    )
    .run();
  if (structural && !tournament.is_finished) {
    await env.DB.prepare("DELETE FROM tournament_matches WHERE tournament_id = ?").bind(id).run();
    await env.DB.prepare("UPDATE tournament_participants SET group_no = NULL, league = NULL WHERE tournament_id = ?")
      .bind(id)
      .run();
  }
  await audit(env, user, "update", "tournament", id, str(values.title, 120));
  const data = await loadTournament(env, id);
  return ok({ item: data ? await tournamentView(env, data) : null });
}

async function deleteTournament(env: Env, user: SessionUser, id: string): Promise<Response> {
  const existing = await env.DB.prepare("SELECT * FROM tournaments WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!existing) return fail(404, "not_found", "Турнир не найден.");
  if (Number(existing.is_finished)) {
    return fail(409, "tournament_finished", "Сначала отмените итоги турнира, чтобы вернуть рейтинги.");
  }
  await env.DB.prepare("DELETE FROM tournaments WHERE id = ?").bind(id).run();
  await audit(env, user, "delete", "tournament", id, str(existing.title, 120));
  return ok({ deleted: true });
}

async function setParticipants(env: Env, user: SessionUser, id: string, request: Request): Promise<Response> {
  const existing = await env.DB.prepare("SELECT * FROM tournaments WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!existing) return fail(404, "not_found", "Турнир не найден.");
  const tournament = mapTournament(existing);
  checkTournamentEditable(tournament);
  const body = await readJson(request);
  const raw = Array.isArray(body.athlete_ids) ? body.athlete_ids : [];
  // 128 — заведомо больше списка школы (96 человек): состав не должен
  // обрезаться молча, если администратор выбрал всех.
  const ids = [...new Set(raw.map((value) => str(value, 80)).filter(Boolean))].slice(0, 128);
  if (ids.length < 2) return fail(400, "not_enough_participants", "Выберите хотя бы двух участников.");
  const placeholders = ids.map(() => "?").join(", ");
  const { results } = await env.DB.prepare(
    `SELECT id, rating FROM athletes WHERE id IN (${placeholders})`,
  )
    .bind(...ids)
    .all<{ id: string; rating: number }>();
  const ratingById = new Map((results ?? []).map((row) => [row.id, Number(row.rating)]));
  if (ratingById.size !== ids.length) return fail(400, "invalid_participants", "Некоторые спортсмены не найдены.");
  const ordered = [...ids].sort((a, b) => (ratingById.get(b) ?? 0) - (ratingById.get(a) ?? 0));
  const statements = [
    env.DB.prepare("DELETE FROM tournament_matches WHERE tournament_id = ?").bind(id),
    env.DB.prepare("DELETE FROM tournament_participants WHERE tournament_id = ?").bind(id),
    ...ordered.map((athleteId, index) =>
      env.DB.prepare(
        `INSERT INTO tournament_participants (tournament_id, athlete_id, seed, rating_before)
         VALUES (?, ?, ?, ?)`,
      ).bind(id, athleteId, index + 1, ratingById.get(athleteId) ?? 0),
    ),
    env.DB.prepare("UPDATE tournaments SET updated_at = datetime('now') WHERE id = ?").bind(id),
  ];
  await env.DB.batch(statements);
  await audit(env, user, "update", "tournament_participants", id, `${ordered.length} участников`);
  const data = await loadTournament(env, id);
  return ok({ item: data ? await tournamentView(env, data) : null });
}

/** Место спортсмена в общем рейтинге школы — от него зависит лига. */
async function globalRanks(env: Env): Promise<Map<string, number>> {
  const { results } = await env.DB.prepare(
    "SELECT id FROM athletes WHERE is_active = 1 ORDER BY rating DESC, full_name",
  ).all<{ id: string }>();
  const ranks = new Map<string, number>();
  (results ?? []).forEach((row, index) => ranks.set(row.id, index + 1));
  return ranks;
}

async function drawTournament(env: Env, user: SessionUser, id: string): Promise<Response> {
  const data = await loadTournament(env, id);
  if (!data) return fail(404, "not_found", "Турнир не найден.");
  checkTournamentEditable(data.tournament);
  if (data.participants.length < 2) return fail(400, "not_enough_participants", "Сначала выберите участников.");
  await refreshRatingSnapshot(env, id);
  const refreshed = await loadTournament(env, id);
  if (!refreshed) return fail(404, "not_found", "Турнир не найден.");
  const ranks = await globalRanks(env);
  const withLeagues = refreshed.participants.map((participant) => ({
    ...participant,
    league: leagueForRank(ranks.get(participant.athlete_id) ?? Number.MAX_SAFE_INTEGER),
  }));
  const drawn = drawGroups(withLeagues, refreshed.tournament.group_size);
  const matches = groupMatches(drawn);
  const statements = [
    env.DB.prepare("DELETE FROM tournament_matches WHERE tournament_id = ?").bind(id),
    ...drawn.map((participant) =>
      env.DB.prepare(
        "UPDATE tournament_participants SET league = ?, group_no = ?, seed = ? WHERE tournament_id = ? AND athlete_id = ?",
      ).bind(participant.league, participant.group_no, participant.seed, id, participant.athlete_id),
    ),
    ...matches.map((match) =>
      env.DB.prepare(
        `INSERT INTO tournament_matches (id, tournament_id, stage, group_no, round, slot, player_a, player_b)
         VALUES (?, ?, 'group', ?, ?, ?, ?, ?)`,
      ).bind(uuid(), id, match.group_no, match.round, match.slot, match.player_a, match.player_b),
    ),
    env.DB.prepare("UPDATE tournaments SET updated_at = datetime('now') WHERE id = ?").bind(id),
  ];
  await env.DB.batch(statements);
  await audit(env, user, "update", "tournament_draw", id);
  const updated = await loadTournament(env, id);
  return ok({ item: updated ? await tournamentView(env, updated) : null });
}

async function drawPlayoff(env: Env, user: SessionUser, id: string): Promise<Response> {
  const data = await loadTournament(env, id);
  if (!data) return fail(404, "not_found", "Турнир не найден.");
  checkTournamentEditable(data.tournament);
  if (data.tournament.format !== "groups_playoff") {
    return fail(400, "wrong_format", "Плей-офф доступен только для формата «группы + плей-офф».");
  }
  if (data.matches.some((match) => match.stage === "playoff")) {
    return fail(409, "playoff_exists", "Сетка плей-офф уже сформирована.");
  }
  const groupMatchesList = data.matches.filter((match) => match.stage === "group");
  if (!allGroupMatchesPlayed(groupMatchesList)) {
    return fail(400, "groups_unfinished", "Сначала заполните все результаты групп.");
  }
  const seeds = qualifiers(data.participants, groupMatchesList, data.tournament.playoff_size);
  if (seeds.length < 2) {
    return fail(400, "not_enough_qualified", "Недостаточно участников для плей-офф.");
  }
  const pairs = seededPairs(seeds);
  const statements: ReturnType<typeof env.DB.prepare>[] = [];
  pairs.forEach(([first, second], index) => {
    statements.push(
      env.DB.prepare(
        `INSERT INTO tournament_matches (id, tournament_id, stage, group_no, round, slot, player_a, player_b)
         VALUES (?, ?, 'playoff', NULL, 1, ?, ?, ?)`,
      ).bind(uuid(), id, index + 1, first, second),
    );
  });
  const summary = `${pairs.length} пар`;
  await env.DB.batch(statements);
  await audit(env, user, "update", "tournament_playoff", id, summary);
  const updated = await loadTournament(env, id);
  return ok({ item: updated ? await tournamentView(env, updated) : null });
}

async function updateMatch(
  env: Env,
  user: SessionUser,
  id: string,
  matchId: string,
  request: Request,
): Promise<Response> {
  const existing = await env.DB.prepare("SELECT * FROM tournaments WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!existing) return fail(404, "not_found", "Турнир не найден.");
  checkTournamentEditable(mapTournament(existing));
  const body = await readJson(request);
  const empty = body.score_a === null && body.score_b === null;
  let scoreA: number | null = null;
  let scoreB: number | null = null;
  if (!empty) {
    scoreA = int(body.score_a, -1);
    scoreB = int(body.score_b, -1);
    if (scoreA < 0 || scoreA > 9 || scoreB < 0 || scoreB > 9) {
      return fail(400, "invalid_score", "Счёт по сетам: целые числа от 0 до 9.", {
        score_a: "От 0 до 9.",
        score_b: "От 0 до 9.",
      });
    }
    if (scoreA === scoreB) {
      return fail(400, "invalid_score", "Счёт не может быть равным: нужен победитель.", {
        score_a: "Счёт не может быть равным.",
        score_b: "Счёт не может быть равным.",
      });
    }
  }
  await saveScores(env, id, matchId, scoreA, scoreB);
  await audit(env, user, "update", "tournament_match", matchId, `${scoreA ?? "—"}:${scoreB ?? "—"}`);
  const updated = await loadTournament(env, id);
  return ok({ item: updated ? await tournamentView(env, updated) : null });
}

async function finalizeTournament(env: Env, user: SessionUser, id: string): Promise<Response> {
  const data = await loadTournament(env, id);
  if (!data) return fail(404, "not_found", "Турнир не найден.");
  const { tournament, participants, matches } = data;
  if (tournament.is_finished) return fail(409, "already_finished", "Итоги уже подведены.");
  if (participants.length < 2) return fail(400, "not_enough_participants", "В турнире нет участников.");
  if (matches.length === 0) return fail(400, "no_matches", "Сначала проведите жеребьёвку.");
  const unfinished = matches.filter((match) => match.score_a === null || match.score_b === null);
  if (unfinished.length > 0) {
    return fail(400, "unfinished_matches", `Осталось заполнить встреч: ${unfinished.length}.`);
  }
  if (tournament.format === "groups_playoff") {
    const playoff = matches.filter((match) => match.stage === "playoff");
    if (playoff.length === 0) {
      return fail(400, "no_playoff", "Сначала сформируйте сетку плей-офф.");
    }
    const maxRound = Math.max(...playoff.map((match) => match.round));
    const final = playoff.filter((match) => match.round === maxRound);
    if (final.length !== 1 || final[0].score_a === null || final[0].score_b === null) {
      return fail(400, "no_final", "Финал ещё не сыгран.");
    }
  }
  await refreshRatingSnapshot(env, id);
  const refreshed = await loadTournament(env, id);
  if (!refreshed) return fail(404, "not_found", "Турнир не найден.");
  const withCurrentRatings = refreshed.participants.map((participant) => ({
    ...participant,
    rating_before: participant.rating_before,
  }));
  const plan = planFinalize(withCurrentRatings, refreshed.matches, tournament.coefficient, tournament.format);
  const overall = standings(withCurrentRatings, refreshed.matches);
  const stats = new Map(overall.map((row) => [row.athlete_id, row]));
  // Зачёт общий: группы смешанные, поэтому места считаются по всему турниру.
  const places = computePlaces(withCurrentRatings, refreshed.matches, tournament.format);
  const statements = [];
  for (const participant of withCurrentRatings) {
    const after = plan.ratingAfter.get(participant.athlete_id) ?? participant.rating_before;
    const place = places.get(participant.athlete_id) ?? null;
    const row = stats.get(participant.athlete_id);
    statements.push(
      env.DB.prepare(
        `UPDATE tournament_participants SET rating_before = ?, rating_after = ?, place = ?, wins = ?, losses = ?
         WHERE tournament_id = ? AND athlete_id = ?`,
      ).bind(
        participant.rating_before,
        after,
        place,
        row?.wins ?? 0,
        row?.losses ?? 0,
        id,
        participant.athlete_id,
      ),
      env.DB.prepare("UPDATE athletes SET rating = ?, updated_at = datetime('now') WHERE id = ?").bind(
        after,
        participant.athlete_id,
      ),
      env.DB.prepare(
        `INSERT INTO rating_history (id, athlete_id, tournament_id, held_on, rating_before, rating_after, delta)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        uuid(),
        participant.athlete_id,
        id,
        tournament.held_on,
        participant.rating_before,
        after,
        plan.totals.get(participant.athlete_id) ?? 0,
      ),
    );
  }
  for (const [matchId, delta] of plan.matchDeltas) {
    statements.push(
      env.DB.prepare("UPDATE tournament_matches SET delta_a = ?, delta_b = ? WHERE id = ? AND tournament_id = ?").bind(
        delta.a,
        delta.b,
        matchId,
        id,
      ),
    );
  }
  statements.push(
    env.DB.prepare(
      "UPDATE tournaments SET is_finished = 1, is_published = 1, updated_at = datetime('now') WHERE id = ?",
    ).bind(id),
  );
  await env.DB.batch(statements);
  await audit(env, user, "update", "tournament_finalize", id);
  const updated = await loadTournament(env, id);
  return ok({ item: updated ? await tournamentView(env, updated) : null });
}

async function reopenTournament(env: Env, user: SessionUser, id: string): Promise<Response> {
  const data = await loadTournament(env, id);
  if (!data) return fail(404, "not_found", "Турнир не найден.");
  if (!data.tournament.is_finished) return fail(400, "not_finished", "Итоги ещё не подведены.");
  const { results } = await env.DB.prepare(
    "SELECT athlete_id, delta FROM rating_history WHERE tournament_id = ?",
  )
    .bind(id)
    .all<{ athlete_id: string; delta: number }>();
  const statements = (results ?? []).map((row) =>
    env.DB.prepare("UPDATE athletes SET rating = ROUND(rating - ?, 2), updated_at = datetime('now') WHERE id = ?").bind(
      Number(row.delta),
      row.athlete_id,
    ),
  );
  statements.push(
    env.DB.prepare("DELETE FROM rating_history WHERE tournament_id = ?").bind(id),
    env.DB.prepare(
      "UPDATE tournament_participants SET rating_after = NULL, place = NULL, wins = 0, losses = 0 WHERE tournament_id = ?",
    ).bind(id),
    env.DB.prepare("UPDATE tournament_matches SET delta_a = NULL, delta_b = NULL WHERE tournament_id = ?").bind(id),
    env.DB.prepare("UPDATE tournaments SET is_finished = 0, updated_at = datetime('now') WHERE id = ?").bind(id),
  );
  await env.DB.batch(statements);
  await audit(env, user, "update", "tournament_reopen", id);
  const updated = await loadTournament(env, id);
  return ok({ item: updated ? await tournamentView(env, updated) : null });
}

export async function listRating(env: Env, url: URL): Promise<Response> {
  const query = str(url.searchParams.get("q") ?? "", 120);
  const year = str(url.searchParams.get("year") ?? "", 4);
  const where = ["is_active = 1"];
  const params: unknown[] = [];
  if (query) {
    where.push("full_name LIKE ?");
    params.push(`%${query}%`);
  }
  if (/^\d{4}$/.test(year)) {
    where.push("birth_year = ?");
    params.push(Number(year));
  }
  const { results } = await env.DB.prepare(
    `SELECT id, full_name, birth_year, gender, rating FROM athletes
     WHERE ${where.join(" AND ")} ORDER BY rating DESC, full_name LIMIT 500`,
  )
    .bind(...params)
    .all<Record<string, unknown>>();
  const ages = await env.DB.prepare(
    "SELECT DISTINCT birth_year FROM athletes WHERE is_active = 1 AND birth_year IS NOT NULL ORDER BY birth_year DESC",
  ).all<{ birth_year: number }>();
  // Лига считается по месту во всём рейтинге школы, а не в отфильтрованном
  // списке: при фильтре по году рождения номера мест тоже сквозные.
  const ranks = await globalRanks(env);
  return ok({
    items: (results ?? []).map((row, index) => ({
      ...row,
      place: index + 1,
      rating: Number(row.rating ?? 0),
      league: leagueForRank(ranks.get(String(row.id)) ?? Number.MAX_SAFE_INTEGER),
    })),
    years: (ages.results ?? []).map((row) => row.birth_year),
  });
}

export async function listTournaments(env: Env, url: URL): Promise<Response> {
  const year = str(url.searchParams.get("year") ?? "", 4);
  const where = ["t.is_published = 1"];
  const params: unknown[] = [];
  if (/^\d{4}$/.test(year)) {
    where.push("substr(t.held_on, 1, 4) = ?");
    params.push(year);
  }
  const { results } = await env.DB.prepare(
    `SELECT t.*,
       (SELECT COUNT(*) FROM tournament_participants p WHERE p.tournament_id = t.id) AS participants,
       (SELECT COUNT(*) FROM tournament_matches m WHERE m.tournament_id = t.id) AS matches,
       (SELECT a.full_name FROM tournament_participants p JOIN athletes a ON a.id = p.athlete_id
        WHERE p.tournament_id = t.id AND p.place = 1 LIMIT 1) AS winner
     FROM tournaments t WHERE ${where.join(" AND ")}
     ORDER BY t.held_on DESC LIMIT 500`,
  )
    .bind(...params)
    .all<Record<string, unknown>>();
  const years = await env.DB.prepare(
    "SELECT DISTINCT substr(held_on, 1, 4) AS year FROM tournaments WHERE is_published = 1 ORDER BY year DESC",
  ).all<{ year: string }>();
  return ok({
    items: (results ?? []).map((row) => ({
      ...mapTournament(row),
      participants: Number(row.participants ?? 0),
      matches: Number(row.matches ?? 0),
      winner: row.winner ? String(row.winner) : null,
      is_published: true,
      is_finished: Boolean(row.is_finished),
    })),
    years: (years.results ?? []).map((row) => row.year),
  });
}

export async function getTournament(env: Env, id: string): Promise<Response> {
  const data = await loadTournament(env, id);
  if (!data || !data.tournament.is_published) {
    return fail(404, "not_found", "Турнир не найден или ещё не опубликован.");
  }
  const view = await tournamentView(env, data);
  return ok({ item: view });
}
