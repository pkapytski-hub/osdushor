// Хранение турнира конструктора: этапы, группы, участники этапов, встречи
// и итоговые места. Модель в worker/schema.sql, расчёт — в worker/lib/stages.ts.
//
// Номера встреч движка (s1-g1-r1-m1) уникальны только внутри турнира, а ключ
// таблицы tournament_stage_matches общий для всей базы. Поэтому в базе ключ
// встречи — «<турнир>~<номер>», а наружу он отдаётся без префикса: браузер
// работает с теми же номерами, что и движок.

import {
  computePlaces,
  draftFinished,
  syncDraft,
  type CompetitionDraft,
  type Stage,
  type StageEntry,
  type StageGroup,
  type StageMatch,
} from "./stages";
import {
  schemeById,
  schemeForLegacyFormat,
  type SchemeId,
  type SchemeStage,
} from "./schemes";

export interface ConstructorTournament {
  id: string;
  title: string;
  held_on: string;
  scheme_id: string;
  best_of: number;
  is_published: number;
  is_finished: number;
  participants: number;
  matches: number;
  played: number;
  /** Сколько мест записано в tournament_places: турнир доигран, когда мест столько же, сколько участников. */
  places: number;
}

export interface ConstructorRecord {
  tournament: ConstructorTournament;
  draft: CompetitionDraft;
}

const KEY_SEPARATOR = "~";

function stageKey(tournamentId: string, ordinal: number): string {
  return `${tournamentId}${KEY_SEPARATOR}s${ordinal}`;
}

function matchKey(tournamentId: string, matchId: string): string {
  return `${tournamentId}${KEY_SEPARATOR}${matchId}`;
}

function storedMatchId(tournamentId: string, storedId: string): string {
  const prefix = `${tournamentId}${KEY_SEPARATOR}`;
  return storedId.startsWith(prefix) ? storedId.slice(prefix.length) : storedId;
}

/** Одна INSERT-команда на несколько строк: D1 принимает не больше 100 параметров. */
function insertStatements(
  env: Env,
  table: string,
  columns: string[],
  rows: unknown[][],
): D1PreparedStatement[] {
  if (rows.length === 0) return [];
  const perStatement = Math.max(1, Math.floor(90 / columns.length));
  const statements: D1PreparedStatement[] = [];
  for (let index = 0; index < rows.length; index += perStatement) {
    const slice = rows.slice(index, index + perStatement);
    const tuple = `(${columns.map(() => "?").join(", ")})`;
    statements.push(
      env.DB.prepare(
        `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${slice.map(() => tuple).join(", ")}`,
      ).bind(...slice.flat()),
    );
  }
  return statements;
}

function numberOrNull(value: unknown): number | null {
  return value == null ? null : Number(value);
}

function recipeFor(
  scheme: SchemeId,
  ordinal: number,
  row: Record<string, unknown>,
): SchemeStage {
  const planned = schemeById(scheme)?.stages[ordinal - 1];
  if (planned) return planned;
  // Этап сохранён, а в справочнике схемы его уже нет: собираем параметры из базы,
  // чтобы турнир всё равно открывался.
  return {
    kind: row.kind === "bracket" ? "bracket" : "groups",
    title: String(row.title ?? ""),
    rounds: Number(row.rounds ?? 1) === 2 ? 2 : 1,
    groupSize: 0,
    advance: Number(row.advance ?? 0),
    finals: Number(row.finals ?? 1) === 2 ? 2 : 1,
    allPlaces: Number(row.all_places ?? 1) === 1,
  };
}

function mapTournamentRow(row: Record<string, unknown>): ConstructorTournament {
  const participants = Number(row.participants ?? 0);
  return {
    id: String(row.id),
    title: String(row.title),
    held_on: String(row.held_on),
    scheme_id: String(row.scheme_id ?? ""),
    best_of: Number(row.best_of ?? 5),
    is_published: Number(row.is_published ?? 0),
    is_finished: Number(row.is_finished ?? 0),
    participants,
    matches: Number(row.matches ?? 0),
    played: Number(row.played ?? 0),
    places: Number(row.places ?? 0),
  };
}

const SUMMARY_COLUMNS = `t.id, t.title, t.held_on, t.scheme_id, t.best_of, t.is_published, t.is_finished,
  (SELECT COUNT(*) FROM tournament_participants p WHERE p.tournament_id = t.id) AS participants,
  (SELECT COUNT(*) FROM tournament_stage_matches m
     JOIN tournament_stages s ON s.id = m.stage_id
    WHERE s.tournament_id = t.id) AS matches,
  (SELECT COUNT(*) FROM tournament_stage_matches m
     JOIN tournament_stages s ON s.id = m.stage_id
    WHERE s.tournament_id = t.id AND m.score_a IS NOT NULL AND m.score_b IS NOT NULL) AS played,
  (SELECT COUNT(*) FROM tournament_places p WHERE p.tournament_id = t.id) AS places`;

/** Турниры, заведённые конструктором, — для списка в панели. */
export async function listConstructorTournaments(env: Env): Promise<ConstructorTournament[]> {
  const { results } = await env.DB.prepare(
    `SELECT ${SUMMARY_COLUMNS} FROM tournaments t
     WHERE t.scheme_id IS NOT NULL AND t.scheme_id <> ''
     ORDER BY t.held_on DESC, t.created_at DESC LIMIT 200`,
  ).all<Record<string, unknown>>();
  return (results ?? []).map(mapTournamentRow);
}

/** Читает турнир вместе с этапами и встречами и пересобирает черновик движка. */
export async function loadCompetition(env: Env, id: string): Promise<ConstructorRecord | null> {
  const row = await env.DB.prepare(
    `SELECT ${SUMMARY_COLUMNS} FROM tournaments t WHERE t.id = ?`,
  )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!row) return null;

  const tournament = mapTournamentRow(row);
  const schemeId = (tournament.scheme_id || schemeForLegacyFormat(String(row.format ?? ""))) as SchemeId;
  const bestOf = [3, 5, 7].includes(tournament.best_of) ? tournament.best_of : 5;

  const [stageRows, groupRows, entryRows, matchRows] = await Promise.all([
    env.DB.prepare(
      "SELECT * FROM tournament_stages WHERE tournament_id = ? ORDER BY ordinal",
    )
      .bind(id)
      .all<Record<string, unknown>>(),
    env.DB.prepare(
      `SELECT g.* FROM tournament_stage_groups g
       JOIN tournament_stages s ON s.id = g.stage_id
       WHERE s.tournament_id = ? ORDER BY s.ordinal, g.no`,
    )
      .bind(id)
      .all<Record<string, unknown>>(),
    env.DB.prepare(
      `SELECT e.*, a.full_name,
              COALESCE(p.rating_before, a.rating) AS rating
       FROM tournament_stage_entries e
       JOIN tournament_stages s ON s.id = e.stage_id
       JOIN athletes a ON a.id = e.athlete_id
       LEFT JOIN tournament_participants p
         ON p.tournament_id = s.tournament_id AND p.athlete_id = e.athlete_id
       WHERE s.tournament_id = ?
       ORDER BY s.ordinal, e.group_no, e.seed`,
    )
      .bind(id)
      .all<Record<string, unknown>>(),
    env.DB.prepare(
      `SELECT m.* FROM tournament_stage_matches m
       JOIN tournament_stages s ON s.id = m.stage_id
       WHERE s.tournament_id = ?
       ORDER BY s.ordinal, m.group_no, m.round, m.slot`,
    )
      .bind(id)
      .all<Record<string, unknown>>(),
  ]);

  const stages: Stage[] = (stageRows.results ?? []).map((stageRow) => {
    const ordinal = Number(stageRow.ordinal);
    const kind = stageRow.kind === "bracket" ? "bracket" : "groups";
    const groups: StageGroup[] = (groupRows.results ?? [])
      .filter((group) => group.stage_id === stageRow.id)
      .map((group) => ({ no: Number(group.no), title: String(group.title) }));
    const entries: StageEntry[] = (entryRows.results ?? [])
      .filter((entry) => entry.stage_id === stageRow.id)
      .map((entry) => ({
        athlete_id: String(entry.athlete_id),
        full_name: String(entry.full_name ?? ""),
        rating: Number(entry.rating ?? 0),
        seed: Number(entry.seed ?? 0),
        group_no: numberOrNull(entry.group_no),
        source_stage: numberOrNull(entry.source_stage),
        source_place: numberOrNull(entry.source_place),
        source_group: numberOrNull(entry.source_group),
      }));
    const matches: StageMatch[] = (matchRows.results ?? [])
      .filter((match) => match.stage_id === stageRow.id)
      .map((match) => ({
        id: storedMatchId(id, String(match.id)),
        stage_no: ordinal,
        group_no: numberOrNull(match.group_no),
        round: Number(match.round ?? 1),
        slot: Number(match.slot ?? 0),
        place_from: numberOrNull(match.place_from),
        place_to: numberOrNull(match.place_to),
        player_a: String(match.player_a),
        player_b: String(match.player_b),
        score_a: numberOrNull(match.score_a),
        score_b: numberOrNull(match.score_b),
      }));
    return {
      no: ordinal,
      kind,
      title: String(stageRow.title ?? ""),
      recipe: recipeFor(schemeId, ordinal, stageRow),
      groups,
      entries,
      matches,
    };
  });

  const draft = syncDraft({ scheme_id: schemeId, best_of: bestOf, stages });
  return {
    tournament: {
      ...tournament,
      scheme_id: schemeId,
    },
    draft,
  };
}

/**
 * Перезаписывает этапы турнира. Состав этапов меняется вместе со счётом:
 * правка прошлой встречи пересобирает следующие этапы, поэтому проще заменить
 * их целиком, чем вычислять разницу.
 */
export async function saveCompetition(
  env: Env,
  tournamentId: string,
  draft: CompetitionDraft,
): Promise<void> {
  const statements: D1PreparedStatement[] = [
    env.DB.prepare("DELETE FROM tournament_stages WHERE tournament_id = ?").bind(tournamentId),
    env.DB.prepare("DELETE FROM tournament_places WHERE tournament_id = ?").bind(tournamentId),
  ];

  const stageRows: unknown[][] = [];
  const groupRows: unknown[][] = [];
  const entryRows: unknown[][] = [];
  const matchRows: unknown[][] = [];

  for (const stage of draft.stages) {
    const stageId = stageKey(tournamentId, stage.no);
    stageRows.push([
      stageId,
      tournamentId,
      stage.no,
      stage.kind,
      stage.title,
      stage.recipe.rounds,
      stage.recipe.advance,
      stage.recipe.finals,
      stage.recipe.allPlaces ? 1 : 0,
    ]);
    for (const group of stage.groups) {
      groupRows.push([stageId, group.no, group.title]);
    }
    for (const entry of stage.entries) {
      entryRows.push([
        stageId,
        entry.athlete_id,
        entry.group_no,
        entry.seed,
        entry.source_stage,
        entry.source_place,
        entry.source_group,
      ]);
    }
    for (const match of stage.matches) {
      matchRows.push([
        matchKey(tournamentId, match.id),
        stageId,
        match.group_no,
        match.round,
        match.slot,
        match.place_from,
        match.place_to,
        match.player_a,
        match.player_b,
        match.score_a,
        match.score_b,
      ]);
    }
  }

  statements.push(
    ...insertStatements(
      env,
      "tournament_stages",
      ["id", "tournament_id", "ordinal", "kind", "title", "rounds", "advance", "finals", "all_places"],
      stageRows,
    ),
    ...insertStatements(env, "tournament_stage_groups", ["stage_id", "no", "title"], groupRows),
    ...insertStatements(
      env,
      "tournament_stage_entries",
      ["stage_id", "athlete_id", "group_no", "seed", "source_stage", "source_place", "source_group"],
      entryRows,
    ),
    ...insertStatements(
      env,
      "tournament_stage_matches",
      [
        "id",
        "stage_id",
        "group_no",
        "round",
        "slot",
        "place_from",
        "place_to",
        "player_a",
        "player_b",
        "score_a",
        "score_b",
      ],
      matchRows,
    ),
  );

  // Итоговые места пишем, только когда схема доиграна: до этого таблицы групп
  // ещё меняются, и «место» было бы промежуточным.
  if (draftFinished(draft)) {
    statements.push(
      ...insertStatements(
        env,
        "tournament_places",
        ["tournament_id", "athlete_id", "place", "wins", "losses", "note"],
        computePlaces(draft).map((place) => [
          tournamentId,
          place.athlete_id,
          place.place,
          place.wins,
          place.losses,
          place.note,
        ]),
      ),
    );
  }

  statements.push(
    env.DB.prepare("UPDATE tournaments SET updated_at = datetime('now') WHERE id = ?").bind(tournamentId),
  );
  await env.DB.batch(statements);
}
