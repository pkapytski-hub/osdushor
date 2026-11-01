// Расчёт турнирной таблицы, плей-офф и рейтинга.
// Формулы повторяют рабочую книгу школы: за каждую встречу победитель
// получает (100 − разница рейтингов)/10 × коэффициент турнира, проигравший
// теряет (100 − разница)/20 × коэффициент. При разнице 100 и больше — 0.

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

/**
 * Группы набираются подряд по силе, без «змейки»: при 12 участниках и группе
 * по 6 первая группа — места 1–6, вторая — 7–12. Лига на жеребьёвку не влияет,
 * поэтому в одной группе могут оказаться спортсмены разных лиг.
 * Групп столько, сколько нужно при заданном размере (12 при размере 6 — это
 * две группы), а участники делятся между ними максимально ровно.
 */
export function drawGroups(participants: ParticipantInput[], groupSize: number): ParticipantInput[] {
  const size = Math.max(2, Math.min(8, Math.floor(groupSize) || 6));
  const ordered = byRating(participants);
  const count = ordered.length;
  if (count === 0) return [];
  const groups = Math.max(1, Math.ceil(count / size));
  const base = Math.floor(count / groups);
  const extra = count % groups;
  const drawn: ParticipantInput[] = [];
  let index = 0;
  for (let group = 0; group < groups; group += 1) {
    const take = base + (group < extra ? 1 : 0);
    for (let position = 0; position < take; position += 1) {
      drawn.push({ ...ordered[index], group_no: group + 1 });
      index += 1;
    }
  }
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
}

export interface StandingRow extends ParticipantInput {
  played: number;
  wins: number;
  losses: number;
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

function seedKey(participant: ParticipantInput): number {
  return participant.seed || 1_000_000;
}

/** Сортировка по силе: сначала те, кто выше в текущем рейтинге. */
export function byRating(participants: ParticipantInput[]): ParticipantInput[] {
  return [...participants].sort(
    (a, b) => b.rating_before - a.rating_before || seedKey(a) - seedKey(b) || a.full_name.localeCompare(b.full_name, "ru"),
  );
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
  let slot = 0;
  for (const [group, list] of [...grouped.entries()].sort((a, b) => a[0] - b[0])) {
    const ordered = byRating(list);
    for (let i = 0; i < ordered.length; i += 1) {
      for (let j = i + 1; j < ordered.length; j += 1) {
        slot += 1;
        matches.push({
          stage: "group",
          group_no: group,
          round: 1,
          slot,
          player_a: ordered[i].athlete_id,
          player_b: ordered[j].athlete_id,
          score_a: null,
          score_b: null,
        });
      }
    }
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
  }
  const list = [...rows.values()];
  for (const row of list) row.diff = row.sets_for - row.sets_against;
  list.sort(
    (a, b) =>
      b.wins - a.wins ||
      b.diff - a.diff ||
      b.sets_for - a.sets_for ||
      b.rating_before - a.rating_before ||
      a.full_name.localeCompare(b.full_name, "ru"),
  );
  list.forEach((row, index) => {
    row.place = index + 1;
  });
  return list;
}

export function allGroupMatchesPlayed(matches: MatchInput[]): boolean {
  const group = matches.filter((match) => match.stage === "group");
  return group.length > 0 && group.every((match) => match.score_a !== null && match.score_b !== null);
}

/**
 * Порядок сеяных для сетки: пары 1–N, 2–(N−1) и так далее, но так, чтобы
 * сильнейшие встретились как можно позже. Возвращает пары по порядку.
 */
export function seededPairs(athleteIds: string[]): [string, string][] {
  const count = athleteIds.length;
  if (count < 2) return [];
  const size = 2 ** Math.floor(Math.log2(count));
  const order: number[] = [1];
  while (order.length < size) {
    const next: number[] = [];
    const round = order.length * 2 + 1;
    for (const seed of order) {
      next.push(seed, round - seed);
    }
    order.splice(0, order.length, ...next);
  }
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
  format: "round_robin" | "groups_playoff",
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
  format: "round_robin" | "groups_playoff",
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
