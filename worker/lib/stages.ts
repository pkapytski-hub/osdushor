// Движок конструктора соревнований: этапы, группы, встречи по партиям,
// таблицы и итоговые места.
//
// Модуль чистый: его использует и браузерная страница-черновик, и воркер,
// когда турнир сохраняется в базу. Поэтому здесь нет ни обращений к базе,
// ни работы с датами — только расчёт.
//
// Счёт встречи — выигранные партии (3:1, 4:2 …), как в протоколах RTTF.
// Подсчёт мест в группах берётся из worker/lib/tournament.ts: правило 4.2.2
// (очки, личные встречи, отношение партий) уже реализовано там.

import {
  bracketRoundLabel,
  getGroupRoundSchedule,
  planBracket,
  planGroupSizes,
  setsToWin,
  standings,
  type MatchInput,
  type ParticipantInput,
  type StandingRow,
} from "./tournament";
import { schemeById, type SchemeId, type SchemeStage } from "./schemes";

/** Участник, которого отдаёт страница соревнования или база. */
export interface DraftParticipant {
  athlete_id: string;
  full_name: string;
  rating: number;
}

/** Участник этапа: посев внутри группы или финала. */
export interface StageEntry {
  athlete_id: string;
  full_name: string;
  rating: number;
  seed: number;
  /** Для групп — номер группы, для сетки — номер финала (1 или 2). */
  group_no: number | null;
  /** Откуда пришёл: номер предыдущего этапа и место в своей группе. */
  source_stage: number | null;
  source_place: number | null;
  source_group: number | null;
}

export interface StageGroup {
  no: number;
  title: string;
}

export interface StageMatch {
  id: string;
  stage_no: number;
  /** Группа или финал, к которому относится встреча. */
  group_no: number | null;
  round: number;
  slot: number;
  /** Блок сетки: с какого по какое место разыгрывает встреча. */
  place_from: number | null;
  place_to: number | null;
  player_a: string;
  player_b: string;
  score_a: number | null;
  score_b: number | null;
}

export interface Stage {
  no: number;
  kind: "groups" | "bracket";
  title: string;
  recipe: SchemeStage;
  groups: StageGroup[];
  entries: StageEntry[];
  matches: StageMatch[];
}

export interface CompetitionDraft {
  scheme_id: SchemeId;
  /** До скольких партий идёт встреча: 3, 5 или 7. */
  best_of: number;
  stages: Stage[];
}

export interface CompetitionPlace {
  athlete_id: string;
  full_name: string;
  place: number;
  wins: number;
  losses: number;
  /** Откуда место: «Группа A», «Финал А», «Сетка». */
  note: string;
}

export interface BracketRoundView {
  key: string;
  round: number;
  place_from: number;
  place_to: number;
  label: string;
  matches: StageMatch[];
}

function orderByRating(participants: DraftParticipant[]): DraftParticipant[] {
  return [...participants].sort(
    (a, b) => b.rating - a.rating || a.full_name.localeCompare(b.full_name, "ru"),
  );
}

function groupNumbers(entries: StageEntry[]): number[] {
  return [...new Set(entries.map((entry) => entry.group_no).filter((no): no is number => no != null))].sort(
    (a, b) => a - b,
  );
}

function groupLetter(no: number): string {
  return no >= 1 && no <= 26 ? String.fromCharCode(64 + no) : String(no);
}

export function stageGroupTitle(stage: Stage, no: number): string {
  const group = stage.groups.find((item) => item.no === no);
  if (group) return group.title;
  return stage.kind === "groups" ? `Группа ${groupLetter(no)}` : `Финал ${no}`;
}

function toParticipant(entry: StageEntry, groupNo: number | null = entry.group_no, seed = entry.seed): ParticipantInput {
  return {
    athlete_id: entry.athlete_id,
    full_name: entry.full_name,
    birth_year: null,
    league: null,
    group_no: groupNo,
    seed,
    rating_before: entry.rating,
  };
}

function toMatchInput(match: StageMatch, kind: "groups" | "bracket"): MatchInput {
  return {
    id: match.id,
    stage: kind === "bracket" ? "playoff" : "group",
    group_no: match.group_no,
    round: match.round,
    slot: match.slot,
    place_from: match.place_from,
    place_to: match.place_to,
    player_a: match.player_a,
    player_b: match.player_b,
    score_a: match.score_a,
    score_b: match.score_b,
  };
}

/**
 * Жеребьёвка групп: участники идут подряд по силе (первая группа — сильнейшие),
 * размеры групп берёт planGroupSizes — по 5–6 человек, максимально ровно.
 * Для круговой схемы groupSize = 0: все играют в одной группе.
 */
function drawGroupEntries(participants: DraftParticipant[], recipe: SchemeStage): StageEntry[] {
  const ordered = orderByRating(participants);
  const sizes = recipe.groupSize > 0 ? planGroupSizes(ordered.length, recipe.groupSize) : [ordered.length];
  const entries: StageEntry[] = [];
  let index = 0;
  sizes.forEach((size, groupIndex) => {
    for (let position = 0; position < size && index < ordered.length; position += 1) {
      const participant = ordered[index];
      entries.push({
        athlete_id: participant.athlete_id,
        full_name: participant.full_name,
        rating: participant.rating,
        seed: position + 1,
        group_no: groupIndex + 1,
        source_stage: null,
        source_place: null,
        source_group: null,
      });
      index += 1;
    }
  });
  return entries;
}

function bracketEntries(participants: DraftParticipant[]): StageEntry[] {
  return orderByRating(participants).map((participant, index) => ({
    athlete_id: participant.athlete_id,
    full_name: participant.full_name,
    rating: participant.rating,
    seed: index + 1,
    group_no: 1,
    source_stage: null,
    source_place: null,
    source_group: null,
  }));
}

/** Встречи группового этапа: по официальному порядку туров, при двух кругах — с переменой сторон. */
function buildGroupMatches(stageNo: number, entries: StageEntry[], rounds: 1 | 2): StageMatch[] {
  const matches: StageMatch[] = [];
  for (const groupNo of groupNumbers(entries)) {
    const ordered = entries.filter((entry) => entry.group_no === groupNo).sort((a, b) => a.seed - b.seed);
    if (ordered.length < 2) continue;
    const schedule = getGroupRoundSchedule(ordered.length);
    for (let circle = 0; circle < rounds; circle += 1) {
      schedule.forEach((pairs, roundIndex) => {
        const round = circle * schedule.length + roundIndex + 1;
        let slot = 0;
        for (const [left, right] of pairs) {
          if (left > ordered.length || right > ordered.length) continue;
          slot += 1;
          const first = ordered[left - 1];
          const second = ordered[right - 1];
          const swap = circle % 2 === 1;
          matches.push({
            id: `s${stageNo}-g${groupNo}-r${round}-m${slot}`,
            stage_no: stageNo,
            group_no: groupNo,
            round,
            slot,
            place_from: null,
            place_to: null,
            player_a: swap ? second.athlete_id : first.athlete_id,
            player_b: swap ? first.athlete_id : second.athlete_id,
            score_a: null,
            score_b: null,
          });
        }
      });
    }
  }
  return matches;
}

/** Смещение мест каждого финала: финал А разыгрывает 1–N, финал Б — следующие места. */
function bracketOffsets(entries: StageEntry[]): Map<number, number> {
  const offsets = new Map<number, number>();
  let offset = 0;
  for (const no of groupNumbers(entries)) {
    offsets.set(no, offset);
    offset += entries.filter((entry) => entry.group_no === no).length;
  }
  return offsets;
}

/**
 * Сетка финала: пары и встречи за места считает planBracket из
 * worker/lib/tournament.ts. Места в плане относительные (1–N внутри финала),
 * поэтому для финала Б они сдвигаются на число участников финала А.
 */
function buildBracketMatches(stageNo: number, entries: StageEntry[], existing: StageMatch[]): StageMatch[] {
  const result: StageMatch[] = [];
  const byId = new Map(existing.map((match) => [match.id, match]));
  for (const [bracketNo, offset] of bracketOffsets(entries).entries()) {
    const list = entries
      .filter((entry) => entry.group_no === bracketNo)
      .sort((a, b) => a.seed - b.seed);
    if (list.length < 2) continue;
    const planParticipants = list.map((entry, index) => toParticipant(entry, bracketNo, index + 1));
    const planMatches = existing
      .filter((match) => match.group_no === bracketNo)
      .map((match) => ({
        ...toMatchInput(match, "bracket"),
        place_from: (match.place_from ?? 1) - offset,
        place_to: (match.place_to ?? 1) - offset,
      }));
    const plan = planBracket(planParticipants, planMatches);
    for (const match of plan.matches) {
      const placeFrom = match.place_from + offset;
      const placeTo = match.place_to + offset;
      const id =
        match.id ?? `s${stageNo}-b${bracketNo}-p${placeFrom}-r${match.round}-m${match.slot}`;
      const stored = byId.get(id);
      result.push({
        id,
        stage_no: stageNo,
        group_no: bracketNo,
        round: match.round,
        slot: match.slot,
        place_from: placeFrom,
        place_to: placeTo,
        player_a: match.player_a,
        player_b: match.player_b,
        score_a: stored?.score_a ?? null,
        score_b: stored?.score_b ?? null,
      });
    }
  }
  return result;
}

function makeStage(no: number, recipe: SchemeStage, entries: StageEntry[]): Stage {
  if (recipe.kind === "groups") {
    const groups = groupNumbers(entries).map((groupNo) => ({
      no: groupNo,
      title: `Группа ${groupLetter(groupNo)}`,
    }));
    return {
      no,
      kind: "groups",
      title: recipe.title,
      recipe,
      groups,
      entries,
      matches: buildGroupMatches(no, entries, recipe.rounds),
    };
  }
  const finals = groupNumbers(entries);
  const groups = finals.map((groupNo, index) => ({
    no: groupNo,
    title: recipe.finals > 1 ? (index === 0 ? "Финал А" : "Финал Б") : "Сетка",
  }));
  return {
    no,
    kind: "bracket",
    title: recipe.title,
    recipe,
    groups,
    entries,
    matches: buildBracketMatches(no, entries, []),
  };
}

/** Создаёт черновик соревнования: первый этап по схеме, жеребьёвка, встречи. */
export function createDraft(
  schemeId: SchemeId,
  participants: DraftParticipant[],
  bestOf = 5,
): CompetitionDraft {
  const scheme = schemeById(schemeId);
  if (!scheme) throw new Error(`Неизвестная схема: ${schemeId}`);
  const first = scheme.stages[0];
  const entries = first.kind === "groups" ? drawGroupEntries(participants, first) : bracketEntries(participants);
  return syncDraft({
    scheme_id: schemeId,
    best_of: [3, 5, 7].includes(bestOf) ? bestOf : 5,
    stages: [makeStage(1, first, entries)],
  });
}

/** Таблица одной группы этапа. */
export function stageTable(stage: Stage, groupNo: number): StandingRow[] {
  const entries = stage.entries.filter((entry) => entry.group_no === groupNo);
  const matches = stage.matches
    .filter((match) => match.group_no === groupNo)
    .map((match) => toMatchInput(match, stage.kind));
  return standings(entries.map((entry) => toParticipant(entry)), matches);
}

/** Все таблицы этапа: номер группы → строки. */
export function stageTables(stage: Stage): { no: number; title: string; rows: StandingRow[] }[] {
  return groupNumbers(stage.entries).map((groupNo) => ({
    no: groupNo,
    title: stageGroupTitle(stage, groupNo),
    rows: stageTable(stage, groupNo),
  }));
}

/** Места внутри сетки: финал А — 1–N, финал Б — N+1–M. */
function bracketPlaces(stage: Stage): Map<string, number> {
  const result = new Map<string, number>();
  let offset = 0;
  for (const bracketNo of groupNumbers(stage.entries)) {
    const list = stage.entries
      .filter((entry) => entry.group_no === bracketNo)
      .sort((a, b) => a.seed - b.seed);
    if (list.length < 2) continue;
    const planParticipants = list.map((entry, index) => toParticipant(entry, bracketNo, index + 1));
    // Места в плане сетки считаются внутри финала (1–N), поэтому у финала Б
    // отнимаем смещение, а к найденным местам прибавляем его обратно.
    const matches = stage.matches
      .filter((match) => match.group_no === bracketNo)
      .map((match) => ({
        ...toMatchInput(match, "bracket"),
        place_from: (match.place_from ?? 1) - offset,
        place_to: (match.place_to ?? 1) - offset,
      }));
    const plan = planBracket(planParticipants, matches);
    for (const [athleteId, place] of plan.places) result.set(athleteId, offset + place);
    offset += list.length;
  }
  return result;
}

function scored(match: StageMatch): boolean {
  return match.score_a !== null && match.score_b !== null;
}

function stageComplete(stage: Stage): boolean {
  if (stage.matches.length === 0) return false;
  if (!stage.matches.every(scored)) return false;
  if (stage.kind === "groups") return true;
  return bracketPlaces(stage).size === stage.entries.length;
}

interface Qualifier {
  groupNo: number;
  row: StandingRow;
}

/** Кто выходит из групп: сначала все первые места, затем все вторые и так далее. */
function qualifiedRows(previous: Stage): Qualifier[] {
  const advance = Math.max(1, previous.recipe.advance);
  const tables = groupNumbers(previous.entries).map((groupNo) => ({
    groupNo,
    rows: stageTable(previous, groupNo),
  }));
  const result: Qualifier[] = [];
  for (let place = 1; place <= advance; place += 1) {
    const bucket: Qualifier[] = [];
    for (const table of tables) {
      const row = table.rows[place - 1];
      if (row) bucket.push({ groupNo: table.groupNo, row });
    }
    bucket.sort(
      (a, b) =>
        b.row.points - a.row.points ||
        b.row.diff - a.row.diff ||
        b.row.rating_before - a.row.rating_before,
    );
    result.push(...bucket);
  }
  return result;
}

/** Остальные участники групп — для финала Б и для мест после сетки. */
function remainingRows(previous: Stage, taken: Set<string>): Qualifier[] {
  const result: Qualifier[] = [];
  for (const groupNo of groupNumbers(previous.entries)) {
    for (const row of stageTable(previous, groupNo)) {
      if (!taken.has(row.athlete_id)) result.push({ groupNo, row });
    }
  }
  result.sort(
    (a, b) =>
      a.row.place - b.row.place ||
      b.row.points - a.row.points ||
      b.row.diff - a.row.diff ||
      b.row.rating_before - a.row.rating_before,
  );
  return result;
}

function bracketEntry(item: Qualifier, index: number, bracketNo: number, stageNo: number): StageEntry {
  return {
    athlete_id: item.row.athlete_id,
    full_name: item.row.full_name,
    rating: item.row.rating_before,
    seed: index + 1,
    group_no: bracketNo,
    source_stage: stageNo,
    source_place: item.row.place,
    source_group: item.groupNo,
  };
}

/**
 * Состав следующего этапа. Для «группы + сетка» в сетку идут первые
 * `advance` человек из каждой группы, остальные получают места по таблицам.
 * Для «группы + два финала» финал А — те же сильнейшие, финал Б — все остальные.
 */
function advanceEntries(previous: Stage, next: SchemeStage): StageEntry[] {
  const qualified = qualifiedRows(previous);
  if (qualified.length < 2) return [];
  const taken = new Set(qualified.map((item) => item.row.athlete_id));
  if (next.finals > 1) {
    const rest = remainingRows(previous, taken);
    // Если на второй финал не хватает людей, играем один финал: двое — минимум.
    if (rest.length < 2) {
      return qualified.map((item, index) => bracketEntry(item, index, 1, previous.no));
    }
    return [
      ...qualified.map((item, index) => bracketEntry(item, index, 1, previous.no)),
      ...rest.map((item, index) => bracketEntry(item, index, 2, previous.no)),
    ];
  }
  return qualified.map((item, index) => bracketEntry(item, index, 1, previous.no));
}

/**
 * Приводит черновик в согласованный вид: пересобирает встречи сетки по
 * текущим результатам и создаёт следующий этап, когда предыдущий доигран.
 */
export function syncDraft(draft: CompetitionDraft): CompetitionDraft {
  const scheme = schemeById(draft.scheme_id);
  if (!scheme) return draft;
  const stages = draft.stages.map((stage) =>
    stage.kind === "bracket"
      ? { ...stage, matches: buildBracketMatches(stage.no, stage.entries, stage.matches) }
      : stage,
  );
  const next = scheme.stages[stages.length];
  if (!next) return { ...draft, stages };
  const previous = stages[stages.length - 1];
  if (!stageComplete(previous)) return { ...draft, stages };
  const entries = advanceEntries(previous, next);
  if (entries.length < 2) return { ...draft, stages };
  stages.push(makeStage(stages.length + 1, next, entries));
  return syncDraft({ ...draft, stages });
}

/** Проверка счёта встречи: победитель берёт нужное число партий, ничья невозможна. */
export function scoreError(draft: CompetitionDraft, scoreA: number, scoreB: number): string | null {
  const win = setsToWin(draft.best_of);
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) {
    return "Счёт — целое число партий.";
  }
  if (scoreA === scoreB) return "Нужен победитель: счёт не может быть равным.";
  if (Math.max(scoreA, scoreB) !== win || Math.min(scoreA, scoreB) >= win) {
    return `Встреча идёт до ${draft.best_of} партий: победитель берёт ${win}, соперник — меньше.`;
  }
  return null;
}

/**
 * Записывает счёт встречи. Если правят встречу прошлого этапа, следующие
 * этапы сбрасываются: состав сетки зависит от таблиц групп.
 */
export function applyScore(
  draft: CompetitionDraft,
  matchId: string,
  scoreA: number | null,
  scoreB: number | null,
): CompetitionDraft {
  const stageIndex = draft.stages.findIndex((stage) => stage.matches.some((match) => match.id === matchId));
  if (stageIndex < 0) return draft;
  const stages = draft.stages.slice(0, stageIndex + 1).map((stage) => ({
    ...stage,
    matches: stage.matches.map((match) =>
      match.id === matchId ? { ...match, score_a: scoreA, score_b: scoreB } : match,
    ),
  }));
  return syncDraft({ ...draft, stages });
}

export function matchDone(match: StageMatch): boolean {
  return scored(match);
}

/** Итоговые места турнира по последнему этапу. */
export function computePlaces(draft: CompetitionDraft): CompetitionPlace[] {
  const last = draft.stages[draft.stages.length - 1];
  if (!last) return [];
  const places = new Map<string, number>();
  const notes = new Map<string, string>();
  const names = new Map<string, string>();

  if (last.kind === "groups") {
    let next = 1;
    for (const table of stageTables(last)) {
      for (const row of table.rows) {
        places.set(row.athlete_id, next);
        notes.set(row.athlete_id, table.title);
        names.set(row.athlete_id, row.full_name);
        next += 1;
      }
    }
  } else {
    let offset = 0;
    for (const bracketNo of groupNumbers(last.entries)) {
      const list = last.entries
        .filter((entry) => entry.group_no === bracketNo)
        .sort((a, b) => a.seed - b.seed);
      if (list.length < 2) continue;
      const plan = planBracket(
        list.map((entry, index) => toParticipant(entry, bracketNo, index + 1)),
        last.matches
          .filter((match) => match.group_no === bracketNo)
          .map((match) => ({
            ...toMatchInput(match, "bracket"),
            place_from: (match.place_from ?? 1) - offset,
            place_to: (match.place_to ?? 1) - offset,
          })),
      );
      const title = stageGroupTitle(last, bracketNo);
      for (const [athleteId, place] of plan.places) {
        places.set(athleteId, offset + place);
        notes.set(athleteId, title);
        names.set(athleteId, list.find((entry) => entry.athlete_id === athleteId)?.full_name ?? "");
      }
      offset += list.length;
    }
    // У схемы «группы + сетка» часть участников в сетку не вышла — их места
    // идут сразу после сетки, по таблицам групп.
    const groupStage = draft.stages.find((stage) => stage.kind === "groups");
    if (groupStage && last.entries.length < groupStage.entries.length) {
      const taken = new Set(last.entries.map((entry) => entry.athlete_id));
      const rest = remainingRows(groupStage, taken);
      let next = last.entries.length + 1;
      for (const item of rest) {
        places.set(item.row.athlete_id, next);
        notes.set(item.row.athlete_id, `Группа ${groupLetter(item.groupNo)}`);
        names.set(item.row.athlete_id, item.row.full_name);
        next += 1;
      }
    }
  }

  const wins = new Map<string, number>();
  const losses = new Map<string, number>();
  for (const stage of draft.stages) {
    for (const match of stage.matches) {
      if (!matchDone(match)) continue;
      const winner = (match.score_a as number) > (match.score_b as number) ? match.player_a : match.player_b;
      const loser = winner === match.player_a ? match.player_b : match.player_a;
      wins.set(winner, (wins.get(winner) ?? 0) + 1);
      losses.set(loser, (losses.get(loser) ?? 0) + 1);
    }
  }

  return [...places.entries()]
    .map(([athleteId, place]) => ({
      athlete_id: athleteId,
      full_name: names.get(athleteId) ?? "",
      place,
      wins: wins.get(athleteId) ?? 0,
      losses: losses.get(athleteId) ?? 0,
      note: notes.get(athleteId) ?? "",
    }))
    .sort((a, b) => a.place - b.place);
}

/** Круги одного финала для показа сетки: подпись, диапазон мест и встречи. */
export function bracketRounds(stage: Stage, bracketNo: number): BracketRoundView[] {
  const list = stage.matches.filter((match) => match.group_no === bracketNo);
  const keys = [...new Set(list.map((match) => `${match.place_from ?? 1}:${match.round}`))];
  return keys
    .map((key) => {
      const [placeFrom, round] = key.split(":").map(Number);
      const matches = list.filter(
        (match) => (match.place_from ?? 1) === placeFrom && match.round === round,
      );
      const placeTo = Math.max(...matches.map((match) => match.place_to ?? placeFrom + 1));
      return {
        key,
        round,
        place_from: placeFrom,
        place_to: placeTo,
        label: bracketRoundLabel(placeFrom, placeTo, matches.length),
        matches,
      };
    })
    .sort((a, b) => a.round - b.round || a.place_from - b.place_from);
}

/** Соревнование доиграно: есть все этапы схемы и все встречи заполнены. */
export function draftFinished(draft: CompetitionDraft): boolean {
  const scheme = schemeById(draft.scheme_id);
  if (!scheme || draft.stages.length !== scheme.stages.length) return false;
  return draft.stages.every(stageComplete);
}

export function participantName(draft: CompetitionDraft, athleteId: string): string {
  for (const stage of draft.stages) {
    const entry = stage.entries.find((item) => item.athlete_id === athleteId);
    if (entry) return entry.full_name;
  }
  return athleteId;
}
