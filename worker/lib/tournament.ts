// Расчёт турнирной таблицы, плей-офф и рейтинга.
// Формулы повторяют рабочую книгу школы: за каждую встречу победитель
// получает (100 − разница рейтингов)/10 × коэффициент турнира, проигравший
// теряет (100 − разница)/20 × коэффициент. При разнице 100 и больше — 0.

/**
 * Очки в круговой системе настольного тенниса: победа — 2, поражение — 1,
 * техническое поражение — 0. В таблицу попадает сумма очков по всем встречам.
 */
export const WIN_POINTS = 2;
export const LOSS_POINTS = 1;
export const TECH_LOSS_POINTS = 0;

export interface ParticipantInput {
  athlete_id: string;
  full_name: string;
  birth_year: number | null;
  league: number | null;
  group_no: number | null;
  seed: number;
  rating_before: number;
}

// Сколько сильнейших спортсменов школы играет в каждой лиге. Лига определяется
// по месту в общем рейтинге, а не по числу пришедших на турнир.
export const LEAGUE_FIRST_SIZE = 50;
export const LEAGUE_SECOND_SIZE = 20;

export function leagueForRank(rank: number): number {
  if (rank <= LEAGUE_FIRST_SIZE) return 1;
  if (rank <= LEAGUE_FIRST_SIZE + LEAGUE_SECOND_SIZE) return 2;
  return 3;
}

export function leagueTitle(league: number): string {
  return `${league} лига`;
}

export function leagueOf(participant: ParticipantInput): number {
  return participant.league ?? 1;
}

/** Лига влияет только на время турнира: 1 лига играет утром, 2 и 3 — в полдень. */
export const LEAGUE_FIRST_START = "09:00";
export const LEAGUE_LATER_START = "12:00";

export function leagueStartTime(league: number): string {
  return league === 1 ? LEAGUE_FIRST_START : LEAGUE_LATER_START;
}

/** По правилам школы в группе 5 или 6 человек. */
export const GROUP_MIN_SIZE = 5;
export const GROUP_MAX_SIZE = 6;

/** Форматы турнира: круговая система, группы с плей-офф и сетка на вылет. */
export type TournamentFormatValue = "round_robin" | "groups_playoff" | "olympic";

/** Сколько партий нужно выиграть, чтобы победить: 3 из 5, 4 из 7, 2 из 3. */
export function setsToWin(bestOf: number): number {
  return Math.floor(bestOf / 2) + 1;
}

/**
 * Сколько человек попадёт в каждую группу. Групп ровно столько, сколько нужно
 * при лимите в 6 человек. Если при таком делении какая-то группа вышла бы
 * меньше пяти (7–9, 13–14, 19–20 участников), группы укрупняются до семи:
 * семь человек в группе лучше, чем три-четыре.
 */
export function planGroupSizes(count: number, maxSize: number = GROUP_MAX_SIZE): number[] {
  if (count <= 0) return [];
  const limit = Math.max(GROUP_MIN_SIZE, Math.min(GROUP_MAX_SIZE, Math.floor(maxSize) || GROUP_MAX_SIZE));
  if (count <= limit) return [count];
  const overshoot = GROUP_MAX_SIZE + 1;
  let groups = Math.ceil(count / limit);
  while (
    groups > 1 &&
    Math.floor(count / groups) < GROUP_MIN_SIZE &&
    Math.ceil(count / (groups - 1)) <= overshoot
  ) {
    groups -= 1;
  }
  const base = Math.floor(count / groups);
  const extra = count % groups;
  return Array.from({ length: groups }, (_, index) => base + (index < extra ? 1 : 0));
}

/**
 * Группы набираются подряд по силе, без «змейки»: при 12 участниках и группе
 * по 6 первая группа — места 1–6, вторая — 7–12. Лига на жеребьёвку не влияет,
 * поэтому в одной группе могут оказаться спортсмены разных лиг.
 * Размеры групп берёт planGroupSizes: по 5–6 человек, максимально ровно.
 */
export function drawGroups(participants: ParticipantInput[], groupSize: number): ParticipantInput[] {
  const ordered = byRating(participants);
  if (ordered.length === 0) return [];
  const drawn: ParticipantInput[] = [];
  let index = 0;
  planGroupSizes(ordered.length, groupSize).forEach((take, group) => {
    for (let position = 0; position < take; position += 1) {
      drawn.push({ ...ordered[index], group_no: group + 1, seed: position + 1 });
      index += 1;
    }
  });
  return drawn;
}

export interface MatchInput {
  id: string;
  stage: "group" | "playoff";
  group_no: number | null;
  round: number;
  slot: number;
  player_a: string;
  player_b: string;
  score_a: number | null;
  score_b: number | null;
  /** Техническое поражение стороны A/B: за встречу начисляется 0 очков. */
  tech_loss_a?: boolean | number | null;
  tech_loss_b?: boolean | number | null;
}

export interface StandingRow extends ParticipantInput {
  played: number;
  wins: number;
  losses: number;
  points: number;
  sets_for: number;
  sets_against: number;
  diff: number;
  place: number;
}

// Округление как в Excel: половина всегда уходит от нуля, в том числе
// для отрицательных значений (−1,25 → −1,3, а не −1,2).
export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  const scaled = Math.abs(value) * factor;
  const rounded = Math.round(scaled + Number.EPSILON);
  return (value < 0 ? -rounded : rounded) / factor;
}

export function round2(value: number): number {
  return roundTo(value, 2);
}

export function round1(value: number): number {
  return roundTo(value, 1);
}

/**
 * Разница в формулах книги считается всегда как «рейтинг победителя минус
 * рейтинг проигравшего», в том числе когда победил более слабый игрок.
 */
export function ratingDiff(winnerRating: number, loserRating: number): number {
  return winnerRating - loserRating;
}

export function winnerDelta(winnerRating: number, loserRating: number, coefficient: number): number {
  const diff = ratingDiff(winnerRating, loserRating);
  if (diff >= 100) return 0;
  return round2(((100 - diff) / 10) * coefficient);
}

/** Проигравший теряет вдвое меньше, чем получает победитель. */
export function loserDelta(winnerRating: number, loserRating: number, coefficient: number): number {
  const diff = ratingDiff(winnerRating, loserRating);
  if (diff >= 100) return 0;
  return round2(-((100 - diff) / 20) * coefficient);
}

export function hasScore(match: MatchInput): boolean {
  return match.score_a !== null && match.score_b !== null && match.score_a !== match.score_b;
}

export function matchWinner(match: MatchInput): string | null {
  if (!hasScore(match)) return null;
  return (match.score_a as number) > (match.score_b as number) ? match.player_a : match.player_b;
}

export function isTechLoss(match: MatchInput, athleteId: string): boolean {
  if (athleteId === match.player_a) return Boolean(match.tech_loss_a);
  if (athleteId === match.player_b) return Boolean(match.tech_loss_b);
  return false;
}

/**
 * Очки за встречу: 2 — победа, 1 — поражение, 0 — техническое поражение.
 * null, если встреча ещё не сыграна.
 */
export function matchPoints(match: MatchInput, athleteId: string): number | null {
  if (!hasScore(match)) return null;
  if (isTechLoss(match, athleteId)) return TECH_LOSS_POINTS;
  return matchWinner(match) === athleteId ? WIN_POINTS : LOSS_POINTS;
}

function seedKey(participant: ParticipantInput): number {
  return participant.seed || 1_000_000;
}

interface TieStats {
  points: number;
  setsFor: number;
  setsAgainst: number;
}

/** Отношение выигранных партий к проигранным; без проигранных партий — максимум. */
function setRatio(setsFor: number, setsAgainst: number): number {
  if (setsAgainst === 0) return setsFor > 0 ? Number.POSITIVE_INFINITY : 1;
  return setsFor / setsAgainst;
}

function compareRatio(left: number, right: number): number {
  if (left === right) return 0;
  return left > right ? -1 : 1;
}

/**
 * Мини-таблица по встречам только между участниками с равными очками:
 * очки в личных встречах и партии в них (правило 4.2.2).
 */
function headToHeadStats(matches: MatchInput[], ids: Set<string>): Map<string, TieStats> {
  const stats = new Map<string, TieStats>();
  for (const id of ids) stats.set(id, { points: 0, setsFor: 0, setsAgainst: 0 });
  for (const match of matches) {
    if (match.stage !== "group" || !hasScore(match)) continue;
    if (!ids.has(match.player_a) || !ids.has(match.player_b)) continue;
    const a = stats.get(match.player_a);
    const b = stats.get(match.player_b);
    if (!a || !b) continue;
    const scoreA = match.score_a as number;
    const scoreB = match.score_b as number;
    a.points += matchPoints(match, match.player_a) ?? 0;
    b.points += matchPoints(match, match.player_b) ?? 0;
    a.setsFor += scoreA;
    a.setsAgainst += scoreB;
    b.setsFor += scoreB;
    b.setsAgainst += scoreA;
  }
  return stats;
}

/**
 * Места в группе: сначала по набранным очкам. Участники с равными очками
 * разбираются по правилу 4.2.2 — исключительно по играм между ними:
 * очки в личных встречах, затем отношение выигранных партий к проигранным.
 * Если и это не разделило (например, встречи не сыграны) — общее отношение
 * партий, затем рейтинг.
 */

/** Если личные встречи не разделили участников — общие показатели и рейтинг. */
function finalFallback(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort(
    (a, b) =>
      compareRatio(setRatio(a.sets_for, a.sets_against), setRatio(b.sets_for, b.sets_against)) ||
      b.sets_for - a.sets_for ||
      b.rating_before - a.rating_before ||
      a.full_name.localeCompare(b.full_name, "ru"),
  );
}

/**
 * Последовательное сравнение (4.2.2): внутри группы с равными очками считаем
 * мини-таблицу личных встреч, делим по очкам в ней, внутри оставшихся равных —
 * по отношению партий, и так же повторяем для подгрупп, пока порядок не определится.
 */
function rankTie(cluster: StandingRow[], matches: MatchInput[], depth: number): StandingRow[] {
  if (cluster.length < 2) return cluster;
  const h2h = headToHeadStats(matches, new Set(cluster.map((row) => row.athlete_id)));
  const statsOf = (row: StandingRow): TieStats => h2h.get(row.athlete_id) ?? { points: 0, setsFor: 0, setsAgainst: 0 };

  const buckets: StandingRow[][] = [];
  for (const row of [...cluster].sort((a, b) => statsOf(b).points - statsOf(a).points)) {
    const last = buckets[buckets.length - 1];
    if (last && statsOf(last[0]).points === statsOf(row).points) last.push(row);
    else buckets.push([row]);
  }

  const ordered: StandingRow[] = [];
  for (const bucket of buckets) {
    if (bucket.length === 1) {
      ordered.push(bucket[0]);
      continue;
    }
    if (depth >= 4) {
      ordered.push(...finalFallback(bucket));
      continue;
    }
    const ratioOf = (row: StandingRow): number => setRatio(statsOf(row).setsFor, statsOf(row).setsAgainst);
    const ratioBuckets: StandingRow[][] = [];
    for (const row of [...bucket].sort((a, b) => compareRatio(ratioOf(a), ratioOf(b)))) {
      const last = ratioBuckets[ratioBuckets.length - 1];
      if (last && ratioOf(last[0]) === ratioOf(row)) last.push(row);
      else ratioBuckets.push([row]);
    }
    for (const ratioBucket of ratioBuckets) {
      if (ratioBucket.length === 1) ordered.push(ratioBucket[0]);
      else ordered.push(...rankTie(ratioBucket, matches, depth + 1));
    }
  }
  return ordered;
}

export function rankStandings(list: StandingRow[], matches: MatchInput[]): StandingRow[] {
  const byPoints = [...list].sort((a, b) => b.points - a.points);
  const result: StandingRow[] = [];
  let index = 0;
  while (index < byPoints.length) {
    let end = index + 1;
    while (end < byPoints.length && byPoints[end].points === byPoints[index].points) end += 1;
    const cluster = byPoints.slice(index, end);
    result.push(...(cluster.length > 1 ? rankTie(cluster, matches, 0) : cluster));
    index = end;
  }
  return result;
}

/** Сортировка по силе: сначала те, кто выше в текущем рейтинге. */
export function byRating(participants: ParticipantInput[]): ParticipantInput[] {
  return [...participants].sort(
    (a, b) => b.rating_before - a.rating_before || seedKey(a) - seedKey(b) || a.full_name.localeCompare(b.full_name, "ru"),
  );
}

/**
 * Официальный порядок встреч в группе (по турам / кругам) по правилам настольного тенниса.
 * Номера 1..N соответствуют посеву участников в группе по силе рейтинга (1 — сильнейший).
 */
export const GROUP_SCHEDULE_3_4: readonly (readonly [number, number])[][] = [
  // 1 круг
  [[1, 3], [2, 4]],
  // 2 круг
  [[4, 1], [3, 2]],
  // 3 круг
  [[1, 2], [3, 4]],
];

export const GROUP_SCHEDULE_5_6: readonly (readonly [number, number])[][] = [
  // 1 круг
  [[2, 4], [1, 5], [3, 6]],
  // 2 круг
  [[4, 1], [6, 2], [5, 3]],
  // 3 круг
  [[1, 3], [2, 5], [4, 6]],
  // 4 круг
  [[3, 2], [6, 1], [5, 4]],
  // 5 круг
  [[1, 2], [3, 4], [5, 6]],
];

export function getGroupRoundSchedule(count: number): readonly (readonly [number, number])[][] {
  if (count <= 2) {
    return [[[1, 2]]];
  }
  if (count <= 4) {
    return GROUP_SCHEDULE_3_4;
  }
  if (count <= 6) {
    return GROUP_SCHEDULE_5_6;
  }
  // Циклическая система Бергера для групп > 6 участников
  const n = count % 2 === 0 ? count : count + 1;
  const rounds: [number, number][][] = [];
  const players = Array.from({ length: n - 1 }, (_, i) => i + 1);
  for (let r = 0; r < n - 1; r += 1) {
    const roundPairs: [number, number][] = [];
    const p1 = players[r % players.length];
    roundPairs.push([p1, n]);
    for (let i = 1; i < n / 2; i += 1) {
      const a = players[(r + i) % players.length];
      const b = players[(r + n - 1 - i) % players.length];
      roundPairs.push([a, b]);
    }
    rounds.push(roundPairs);
  }
  return rounds;
}

export function groupMatches(participants: ParticipantInput[]): Omit<MatchInput, "id">[] {
  const grouped = new Map<number, ParticipantInput[]>();
  for (const participant of participants) {
    const group = participant.group_no ?? 1;
    const list = grouped.get(group) ?? [];
    list.push(participant);
    grouped.set(group, list);
  }
  const matches: Omit<MatchInput, "id">[] = [];
  for (const [group, list] of [...grouped.entries()].sort((a, b) => a[0] - b[0])) {
    const ordered = byRating(list);
    const count = ordered.length;
    if (count < 2) continue;
    const schedule = getGroupRoundSchedule(count);
    schedule.forEach((roundPairs, roundIndex) => {
      const roundNum = roundIndex + 1;
      let slot = 0;
      for (const [aNum, bNum] of roundPairs) {
        if (aNum <= count && bNum <= count) {
          slot += 1;
          matches.push({
            stage: "group",
            group_no: group,
            round: roundNum,
            slot,
            player_a: ordered[aNum - 1].athlete_id,
            player_b: ordered[bNum - 1].athlete_id,
            score_a: null,
            score_b: null,
          });
        }
      }
    });
  }
  return matches;
}

/** Таблица одной группы или общая таблица кругового турнира. */
export function standings(participants: ParticipantInput[], matches: MatchInput[], groupNo?: number): StandingRow[] {
  const filtered = groupNo === undefined
    ? participants
    : participants.filter((participant) => participant.group_no === groupNo);
  const ids = new Set(filtered.map((participant) => participant.athlete_id));
  const rows = new Map<string, StandingRow>();
  for (const participant of filtered) {
    rows.set(participant.athlete_id, {
      ...participant,
      played: 0,
      wins: 0,
      losses: 0,
      points: 0,
      sets_for: 0,
      sets_against: 0,
      diff: 0,
      place: 0,
    });
  }
  for (const match of matches) {
    if (match.stage !== "group" || !hasScore(match)) continue;
    if (!ids.has(match.player_a) || !ids.has(match.player_b)) continue;
    const a = rows.get(match.player_a);
    const b = rows.get(match.player_b);
    if (!a || !b) continue;
    const scoreA = match.score_a as number;
    const scoreB = match.score_b as number;
    a.played += 1;
    b.played += 1;
    a.sets_for += scoreA;
    a.sets_against += scoreB;
    b.sets_for += scoreB;
    b.sets_against += scoreA;
    if (scoreA > scoreB) {
      a.wins += 1;
      b.losses += 1;
    } else {
      b.wins += 1;
      a.losses += 1;
    }
    a.points += matchPoints(match, match.player_a) ?? 0;
    b.points += matchPoints(match, match.player_b) ?? 0;
  }
  const list = [...rows.values()];
  for (const row of list) row.diff = row.sets_for - row.sets_against;
  const ranked = rankStandings(list, matches);
  ranked.forEach((row, index) => {
    row.place = index + 1;
  });
  return ranked;
}

export function allGroupMatchesPlayed(matches: MatchInput[]): boolean {
  const group = matches.filter((match) => match.stage === "group");
  return group.length > 0 && group.every((match) => match.score_a !== null && match.score_b !== null);
}

/** Размер сетки на вылет: ближайшая степень двойки не меньше числа участников. */
export function bracketSize(count: number): number {
  return count <= 2 ? 2 : 2 ** Math.ceil(Math.log2(count));
}

/**
 * Порядок сеяных в сетке: пары 1–N, 2–(N−1) и так далее, но так, чтобы
 * сильнейшие встретились как можно позже.
 */
export function bracketOrder(size: number): number[] {
  const order: number[] = [1];
  while (order.length < size) {
    const next: number[] = [];
    const round = order.length * 2 + 1;
    for (const seed of order) {
      next.push(seed, round - seed);
    }
    order.splice(0, order.length, ...next);
  }
  return order;
}

/** Пары первого круга для готового списка сеяных. */
export function seededPairs(athleteIds: string[]): [string, string][] {
  const count = athleteIds.length;
  if (count < 2) return [];
  const size = 2 ** Math.floor(Math.log2(count));
  const order = bracketOrder(size);
  const pairs: [string, string][] = [];
  for (let i = 0; i < order.length; i += 2) {
    const first = athleteIds[order[i] - 1];
    const second = athleteIds[order[i + 1] - 1];
    if (first && second) pairs.push([first, second]);
  }
  return pairs;
}

/** Кто выходит в плей-офф: сначала победители групп, затем вторые места и т. д. */
export function qualifiers(participants: ParticipantInput[], matches: MatchInput[], playoffSize: number): string[] {
  const groups = [...new Set(participants.map((participant) => participant.group_no ?? 1))].sort((a, b) => a - b);
  const tables = groups.map((group) => standings(participants, matches, group));
  const eligible = Math.min(playoffSize, participants.length);
  const size = 2 ** Math.floor(Math.log2(Math.max(2, eligible)));
  const result: string[] = [];
  let place = 0;
  while (result.length < size) {
    let added = false;
    for (const table of tables) {
      const row = table[place];
      if (row && result.length < size) {
        result.push(row.athlete_id);
        added = true;
      }
    }
    if (!added) break;
    place += 1;
  }
  return result;
}

export interface FinalizePlan {
  totals: Map<string, number>;
  matchDeltas: Map<string, { a: number; b: number; winner: string }>;
  ratingAfter: Map<string, number>;
  places: Map<string, number>;
}

export interface BracketPlanMatch {
  round: number;
  slot: number;
  player_a: string;
  player_b: string;
  /** id встречи, если она уже заведена и не устарела. */
  id?: string;
}

export interface BracketPlan {
  matches: BracketPlanMatch[];
  /** Встречи, которые больше не соответствуют сетке: их нужно удалить. */
  remove: string[];
}

/**
 * Олимпийская система: все участники играют на вылет, групп нет. Число мест
 * в сетке добивается до степени двойки, поэтому сильнейшие по рейтингу
 * (seed 1, 2, …) первый круг проходят без соперника.
 *
 * Функция считает сетку заново по текущим результатам и поэтому же
 * используется после каждой встречи: следующие пары появляются сами, а
 * устаревшие (после исправления счёта) попадают в remove.
 */
export function planBracket(participants: ParticipantInput[], matches: MatchInput[]): BracketPlan {
  const playoff = matches.filter((match) => match.stage === "playoff");
  const count = participants.length;
  if (count < 2) return { matches: [], remove: playoff.map((match) => match.id) };
  const order = bracketOrder(bracketSize(count));
  // Лучший по рейтингу получает первый номер посева.
  const bySeed = new Map<number, string>();
  [...participants]
    .sort((a, b) => (a.seed || 999) - (b.seed || 999))
    .forEach((participant, index) => bySeed.set(index + 1, participant.athlete_id));
  const existing = new Map(playoff.map((match) => [`${match.round}:${match.slot}`, match]));
  const keep = new Set<string>();
  const plan: BracketPlanMatch[] = [];
  // positions[i] — участник на этом месте сетки; undefined, пока победитель
  // предыдущей встречи неизвестен.
  let positions: (string | undefined)[] = order.map((seed) => bySeed.get(seed));
  let round = 1;
  while (positions.length > 1) {
    const next: (string | undefined)[] = [];
    for (let index = 0; index < positions.length; index += 2) {
      const first = positions[index];
      const second = positions[index + 1];
      const slot = index / 2 + 1;
      if (first && second) {
        const found = existing.get(`${round}:${slot}`);
        const valid = found && found.player_a === first && found.player_b === second ? found : null;
        if (valid) keep.add(valid.id);
        plan.push({ round, slot, player_a: first, player_b: second, id: valid?.id });
        next.push(valid ? matchWinner(valid) ?? undefined : undefined);
      } else {
        // Первый круг без соперника: участник сразу проходит дальше. В более
        // поздних кругах пустое место означает, что встреча ещё не сыграна, и
        // поднимать кого-то наверх нельзя — иначе финал собрался бы раньше
        // полуфиналов.
        if (round > 1) {
          next.push(undefined);
          continue;
        }
        next.push(first ?? second);
      }
    }
    positions = next;
    round += 1;
  }
  return { matches: plan, remove: playoff.filter((match) => !keep.has(match.id)).map((match) => match.id) };
}

/**
 * Считает изменения рейтинга так же, как книга школы: каждая встреча берёт
 * рейтинги на начало турнира, изменения по встречам суммируются, итог
 * округляется до десятых. Один и тот же расчёт используется и для
 * предпросмотра, и для сохранения.
 */
export function planFinalize(
  participants: ParticipantInput[],
  matches: MatchInput[],
  coefficient: number,
  format: TournamentFormatValue,
): FinalizePlan {
  const before = new Map<string, number>();
  for (const participant of participants) before.set(participant.athlete_id, participant.rating_before);
  const accumulated = new Map<string, number>();
  for (const participant of participants) accumulated.set(participant.athlete_id, 0);
  const matchDeltas = new Map<string, { a: number; b: number; winner: string }>();
  const ordered = [...matches].sort((a, b) => {
    if (a.stage !== b.stage) return a.stage === "group" ? -1 : 1;
    return (a.group_no ?? 0) - (b.group_no ?? 0) || a.round - b.round || a.slot - b.slot;
  });
  for (const match of ordered) {
    if (!hasScore(match)) continue;
    const ratingA = before.get(match.player_a);
    const ratingB = before.get(match.player_b);
    if (ratingA === undefined || ratingB === undefined) continue;
    const winner = matchWinner(match) as string;
    const winnerRating = winner === match.player_a ? ratingA : ratingB;
    const loserRating = winner === match.player_a ? ratingB : ratingA;
    const gain = winnerDelta(winnerRating, loserRating, coefficient);
    const loss = loserDelta(winnerRating, loserRating, coefficient);
    const deltaA = winner === match.player_a ? gain : loss;
    const deltaB = winner === match.player_b ? gain : loss;
    accumulated.set(match.player_a, (accumulated.get(match.player_a) ?? 0) + deltaA);
    accumulated.set(match.player_b, (accumulated.get(match.player_b) ?? 0) + deltaB);
    matchDeltas.set(match.id, { a: deltaA, b: deltaB, winner });
  }
  const totals = new Map<string, number>();
  const ratingAfter = new Map<string, number>();
  for (const participant of participants) {
    const start = participant.rating_before;
    const total = round1(accumulated.get(participant.athlete_id) ?? 0);
    totals.set(participant.athlete_id, total);
    ratingAfter.set(participant.athlete_id, round2(start + total));
  }
  const places = computePlaces(participants, matches, format);
  return { totals, matchDeltas, ratingAfter, places };
}

export function computePlaces(
  participants: ParticipantInput[],
  matches: MatchInput[],
  format: TournamentFormatValue,
): Map<string, number> {
  const result = new Map<string, number>();
  if (format === "round_robin") {
    const table = standings(participants, matches);
    table.forEach((row, index) => result.set(row.athlete_id, index + 1));
    return result;
  }
  const playoff = matches.filter((match) => match.stage === "playoff" && hasScore(match));
  if (playoff.length === 0) {
    const table = standings(participants, matches);
    table.forEach((row, index) => result.set(row.athlete_id, index + 1));
    return result;
  }
  const maxRound = Math.max(...playoff.map((match) => match.round));
  for (const match of playoff) {
    const winner = matchWinner(match);
    if (!winner) continue;
    const loser = winner === match.player_a ? match.player_b : match.player_a;
    if (match.round === maxRound) {
      result.set(winner, 1);
      result.set(loser, 2);
    } else if (!result.has(loser)) {
      result.set(loser, 2 ** (maxRound - match.round) + 1);
    }
  }
  const bracketSize = 2 ** maxRound;
  const rest = standings(participants, matches).filter((row) => !result.has(row.athlete_id));
  rest.forEach((row, index) => result.set(row.athlete_id, bracketSize + 1 + index));
  return result;
}

/** Следующий круг плей-офф: победители пар в порядке слотов. */
export function nextPlayoffRound(matches: MatchInput[], round: number): Omit<MatchInput, "id">[] {
  const current = matches
    .filter((match) => match.stage === "playoff" && match.round === round)
    .sort((a, b) => a.slot - b.slot);
  if (current.length < 2 || current.length % 2 !== 0) return [];
  const winners: string[] = [];
  for (const match of current) {
    const winner = matchWinner(match);
    if (!winner) return [];
    winners.push(winner);
  }
  const result: Omit<MatchInput, "id">[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    result.push({
      stage: "playoff",
      group_no: null,
      round: round + 1,
      slot: i / 2 + 1,
      player_a: winners[i],
      player_b: winners[i + 1],
      score_a: null,
      score_b: null,
    });
  }
  return result;
}
