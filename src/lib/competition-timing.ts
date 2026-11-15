/**
 * Расчёт времени соревнования по настольному теннису.
 *
 * Считает не «все матчи делить на столы», а волны по турам: в группе из 6 человек
 * семь туров, и на столах они идут последовательно. Финалы считаются по своей системе.
 * Дальше волны раскладываются по дням с учётом брифинга, перерыва и награждения.
 */

export type FinalSystem = "rr" | "ko1" | "ko2";

export const FINAL_SYSTEMS: { value: FinalSystem; label: string }[] = [
  { value: "rr", label: "круговая" },
  { value: "ko1", label: "олимпийская −1" },
  { value: "ko2", label: "олимпийская −2" },
];

export function finalSystemLabel(value: string): string {
  return FINAL_SYSTEMS.find((system) => system.value === value)?.label ?? value;
}

export interface FinalSetting {
  system: FinalSystem;
  /** 0 — забрать всех, кто ещё не распределён. */
  size: number;
}

export interface CategoryInput {
  participants: number;
  groups: number;
  extra: number;
  finals: FinalSetting[];
}

export interface DayWindow {
  start: string;
  end: string;
}

export interface PlannerInput {
  tables: number;
  start: string;
  deadline: string;
  extraDays: DayWindow[];
  prelimMinutes: number;
  finalMinutes: number;
  briefMinutes: number;
  pauseMinutes: number;
  awardsMinutes: number;
  includeGirls: boolean;
  /** Сколько столов отдано девушкам. 0 — общий пул, потоки идут по очереди. */
  girlsTables: number;
  boys: CategoryInput;
  girls: CategoryInput;
}

export const DEFAULT_PLANNER_INPUT: PlannerInput = {
  tables: 8,
  start: "10:30",
  deadline: "16:30",
  extraDays: [],
  prelimMinutes: 15,
  finalMinutes: 20,
  briefMinutes: 10,
  pauseMinutes: 15,
  awardsMinutes: 20,
  includeGirls: false,
  girlsTables: 0,
  boys: { participants: 0, groups: 0, extra: 0, finals: [] },
  girls: { participants: 0, groups: 0, extra: 0, finals: [] },
};

export interface GroupPlanRow {
  label: string;
  size: number;
  matches: number;
  rounds: number;
}

export interface FinalPlanRow {
  label: string;
  size: number;
  matches: number;
}

export interface CategoryDistribution {
  category: "boys" | "girls";
  participants: number;
  explicit: number;
  left: number;
  autoIndex: number;
  autoSize: number | null;
}

export interface TimelineEvent {
  from: string;
  to: string;
  title: string;
  note: string;
}

export interface TimelineDay {
  number: number;
  window: string;
  finish: string;
  events: TimelineEvent[];
}

export interface StageSummary {
  matches: number;
  rounds: number;
  waves: number;
  minutes: number;
}

export interface PlannerResult {
  blank: boolean;
  /** Во вводе есть ошибка: расчёт не строится, текст ошибки — в verdictText. */
  hasErrors: boolean;
  verdictTone: "ok" | "warn" | "bad" | "info";
  verdictText: string;
  matchesTotal: number;
  groupMatches: number;
  finalMatches: number;
  playMinutes: number;
  tableMinutes: number;
  finishMinutes: number;
  marginMinutes: number;
  daysUsed: number;
  groups: GroupPlanRow[];
  finals: FinalPlanRow[];
  preliminary: StageSummary;
  finalStage: { matches: number; waves: number; minutes: number; roundRobinMatches: number; olympicMatchesCount: number; extraMatches: number };
  distribution: CategoryDistribution[];
  timeline: TimelineDay[];
}

/** «10:30», «1030» и «930» — одно и то же время. */
export function toMinutes(value: string): number | null {
  const cleaned = String(value ?? "").trim().replace(/[^\d:]/g, "");
  if (!cleaned) return null;
  const withColon = /^(\d{1,2}):(\d{1,2})$/.exec(cleaned);
  if (withColon) {
    const hours = Number(withColon[1]);
    const minutes = Number(withColon[2]);
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
  }
  if (/^\d{3,4}$/.test(cleaned)) {
    const hours = Number(cleaned.slice(0, cleaned.length - 2));
    const minutes = Number(cleaned.slice(-2));
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
  }
  if (/^\d{1,2}$/.test(cleaned)) {
    const hours = Number(cleaned);
    if (hours > 23) return null;
    return hours * 60;
  }
  return null;
}

export function normalizeTime(value: string, fallback: string): string {
  const minutes = toMinutes(value);
  if (minutes === null) return fallback;
  return formatMinutes(minutes);
}

/** 630 → «10:30», 1500 → «+1 сут 01:00». */
export function formatMinutes(total: number): string {
  let minutes = Math.round(total);
  const days = Math.floor(minutes / 1440);
  minutes = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${days > 0 ? `+${days} сут ` : ""}${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/** 150 → «2 ч 30 мин». */
export function formatDuration(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = Math.round(total % 60);
  if (hours && minutes) return `${hours} ч ${minutes} мин`;
  if (hours) return `${hours} ч`;
  return `${minutes} мин`;
}

function plural(count: number, one: string, few: string, many: string): string {
  const tail = count % 100;
  if (tail >= 11 && tail <= 14) return many;
  const last = count % 10;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

const dayWord = (count: number) => plural(count, "день", "дня", "дней");
const waveWord = (count: number) => plural(count, "волна", "волны", "волн");

function distribute(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  const rest = total % parts;
  return Array.from({ length: parts }, (_, index) => base + (index < rest ? 1 : 0));
}

function roundsFor(size: number): number {
  return size < 2 ? 0 : size % 2 === 1 ? size : size - 1;
}

function matchesPerRound(size: number): number {
  return Math.floor(size / 2);
}

function pairCount(size: number): number {
  return size < 2 ? 0 : (size * (size - 1)) / 2;
}

function roundStage(sizes: number[], tables: number): { slots: number; matches: number; rounds: number } {
  const rounds = sizes.map(roundsFor);
  const maxRounds = rounds.length ? Math.max(...rounds) : 0;
  let slots = 0;
  let matches = 0;
  for (let round = 1; round <= maxRounds; round += 1) {
    let inRound = 0;
    for (let index = 0; index < sizes.length; index += 1) {
      if (rounds[index] >= round) inRound += matchesPerRound(sizes[index]);
    }
    if (!inRound) continue;
    slots += Math.ceil(inRound / tables);
    matches += inRound;
  }
  return { slots, matches, rounds: maxRounds };
}

/** Олимпийская система: −1 — все места, −2 — с дополнительной сеткой. */
function olympicMatches(size: number, type: "-1" | "-2"): number {
  if (size < 2) return 0;
  let base = 4;
  while (base < size) base *= 2;
  const levels = Math.round(Math.log(base) / Math.LN2);
  const total = type === "-2" ? (base * (levels + 1)) / 2 - 2 : (base * levels) / 2;
  const deducted = (type === "-2" ? levels + 1 : levels) * (base - size);
  return Math.max(1, Math.round(total - deducted));
}

function koStage(items: { size: number; type: "-1" | "-2" }[], tables: number): { matches: number; rounds: number; slots: number } {
  let matches = 0;
  let rounds = 0;
  items.forEach((item) => {
    matches += olympicMatches(item.size, item.type);
    if (item.size >= 2) rounds = Math.max(rounds, Math.ceil(Math.log(item.size) / Math.LN2));
  });
  return { matches, rounds, slots: Math.max(Math.ceil(matches / tables), rounds) };
}

function letters(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    if (index < 26) return String.fromCharCode(65 + index);
    return String.fromCharCode(65 + (index % 26)) + String(Math.floor(index / 26));
  });
}

interface FinalsDistribution {
  participants: number;
  explicit: number;
  left: number;
  autoIndex: number;
  autoSize: number | null;
  sizes: number[];
}

function finalsDistribution(category: CategoryInput): FinalsDistribution {
  const participants = Math.max(0, Math.round(category.participants || 0));
  const finals = category.finals ?? [];
  let explicit = 0;
  let autoIndex = -1;
  finals.forEach((final, index) => {
    const size = Math.round(final.size || 0);
    if (size > 0) explicit += size;
    else if (autoIndex < 0) autoIndex = index;
  });
  const sizes = finals.map((final) => Math.max(0, Math.round(final.size || 0)));
  let left = participants - explicit;
  let autoSize: number | null = null;
  if (autoIndex >= 0 && left > 0) {
    sizes[autoIndex] = left;
    autoSize = left;
    left = 0;
  }
  return { participants, explicit, left, autoIndex, autoSize, sizes };
}

interface StageEvent {
  kind: "brief" | "pause" | "awards" | "stage";
  from: number;
  to: number;
  name?: string;
  waves?: number;
  duration?: number;
  matches?: number;
  index?: number;
  count?: number;
  stream?: "boys" | "girls" | null;
}

interface DayPlan {
  start: number;
  deadline: number;
  cursor: number;
  events: StageEvent[];
}

function emptyResult(verdictTone: PlannerResult["verdictTone"], verdictText: string, blank: boolean): PlannerResult {
  return {
    blank,
    hasErrors: verdictTone === "bad",
    verdictTone,
    verdictText,
    matchesTotal: 0,
    groupMatches: 0,
    finalMatches: 0,
    playMinutes: 0,
    tableMinutes: 0,
    finishMinutes: 0,
    marginMinutes: 0,
    daysUsed: 0,
    groups: [],
    finals: [],
    preliminary: { matches: 0, rounds: 0, waves: 0, minutes: 0 },
    finalStage: { matches: 0, waves: 0, minutes: 0, roundRobinMatches: 0, olympicMatchesCount: 0, extraMatches: 0 },
    distribution: [],
    timeline: [],
  };
}

type Category = "boys" | "girls";

interface PoolPlan {
  tables: number;
  groups: GroupPlanRow[];
  finals: FinalPlanRow[];
  preliminary: { matches: number; rounds: number; waves: number; minutes: number };
  finalStage: {
    matches: number;
    waves: number;
    minutes: number;
    roundRobinMatches: number;
    olympicMatchesCount: number;
    extraMatches: number;
  };
  stages: { name: string; waves: number; duration: number; matches: number }[];
  groupMatches: number;
  finalMatches: number;
  tableMinutes: number;
  playMinutes: number;
  finalWaves: number;
}

/**
 * Один пул столов: категории играют по очереди на этих столах.
 * В параллельном режиме вызывается дважды — по пулу на каждый поток.
 */
function buildPool(
  categories: Category[],
  tables: number,
  prelimMinutes: number,
  finalMinutes: number,
  categoryInput: (category: Category) => CategoryInput,
  labelCategories: boolean,
): PoolPlan {
  const groupLists: number[][] = [];
  const roundRobinSizes: number[] = [];
  const olympicItems: { size: number; type: "-1" | "-2" }[] = [];
  const finalsPlan: Record<Category, { system: FinalSystem; size: number }[]> = { boys: [], girls: [] };
  let extraTotal = 0;

  categories.forEach((category) => {
    const categoryData = categoryInput(category);
    const info = finalsDistribution(categoryData);
    const groups = Math.max(0, Math.round(categoryData.groups || 0));
    // Ноль групп — олимпийская система без предварительного этапа.
    groupLists.push(groups > 0 ? distribute(info.participants, groups) : []);

    info.sizes.forEach((size, index) => {
      if (size <= 0) return;
      const final = categoryData.finals[index];
      if (!final) return;
      finalsPlan[category].push({ system: final.system, size });
      if (final.system === "rr") roundRobinSizes.push(size);
      else olympicItems.push({ size, type: final.system === "ko2" ? "-2" : "-1" });
    });

    extraTotal += Math.max(0, Math.round(categoryData.extra || 0));
  });

  const preliminary = roundStage(groupLists.flat(), tables);
  const roundRobin = roundStage(roundRobinSizes, tables);
  const olympic = koStage(olympicItems, tables);
  const extraWaves = extraTotal > 0 ? Math.ceil(extraTotal / tables) : 0;

  const finalWaves = roundRobin.slots + olympic.slots + extraWaves;
  const finalMatches = roundRobin.matches + olympic.matches + extraTotal;
  const preliminaryMinutes = preliminary.slots * prelimMinutes;
  const finalMinutesTotal = finalWaves * finalMinutes;

  const stages: PoolPlan["stages"] = [];
  if (preliminary.slots > 0) {
    stages.push({ name: "Групповой этап", waves: preliminary.slots, duration: prelimMinutes, matches: preliminary.matches });
  }
  if (finalWaves > 0) {
    stages.push({ name: "Финальный этап", waves: finalWaves, duration: finalMinutes, matches: finalMatches });
  }

  const categoryMark = (category: Category) => (category === "boys" ? "Юн." : "Дев.");
  const groupRows: GroupPlanRow[] = [];
  const maxGroups = groupLists.length ? Math.max(...groupLists.map((list) => list.length)) : 0;
  const groupLetters = letters(maxGroups);
  groupLists.forEach((sizes, categoryIndex) => {
    const prefix =
      categories.length > 1
        ? `${categoryIndex + 1} · `
        : labelCategories
          ? `${categoryMark(categories[categoryIndex])} `
          : "";
    sizes.forEach((size, groupIndex) => {
      groupRows.push({
        label: `${prefix}Группа ${groupLetters[groupIndex]}`,
        size,
        matches: pairCount(size),
        rounds: roundsFor(size),
      });
    });
  });

  const finalRows: FinalPlanRow[] = [];
  categories.forEach((category) => {
    const prefix = categories.length > 1 || labelCategories ? `${categoryMark(category)} ` : "";
    finalsPlan[category].forEach((final, index) => {
      finalRows.push({
        label: `${prefix}Финал ${index + 1} · ${finalSystemLabel(final.system)}`,
        size: final.size,
        matches: final.system === "rr" ? pairCount(final.size) : olympicMatches(final.size, final.system === "ko2" ? "-2" : "-1"),
      });
    });
    const extra = Math.max(0, Math.round(categoryInput(category).extra || 0));
    if (extra > 0) finalRows.push({ label: `${prefix}Стыковые матчи`, size: 0, matches: extra });
  });

  return {
    tables,
    groups: groupRows,
    finals: finalRows,
    preliminary: {
      matches: preliminary.matches,
      rounds: preliminary.rounds,
      waves: preliminary.slots,
      minutes: preliminaryMinutes,
    },
    finalStage: {
      matches: finalMatches,
      waves: finalWaves,
      minutes: finalMinutesTotal,
      roundRobinMatches: roundRobin.matches,
      olympicMatchesCount: olympic.matches,
      extraMatches: extraTotal,
    },
    stages,
    groupMatches: preliminary.matches,
    finalMatches,
    tableMinutes: preliminary.matches * prelimMinutes + finalMatches * finalMinutes,
    playMinutes: preliminaryMinutes + finalMinutesTotal,
    finalWaves,
  };
}

/** Раскладывает этапы одного пула по дням. */
function packStages(
  stages: { name: string; waves: number; duration: number; matches: number }[],
  windows: { start: number; deadline: number }[],
  briefMinutes: number,
  pauseMinutes: number,
  stream: Category | null,
): { days: DayPlan[]; stuck: boolean } {
  const days: DayPlan[] = [];
  let stuck = false;

  const openDay = (): DayPlan => {
    const window = windows[days.length] ?? windows[windows.length - 1];
    const day: DayPlan = { start: window.start, deadline: window.deadline, cursor: window.start + briefMinutes, events: [] };
    days.push(day);
    return day;
  };

  let current = openDay();

  stages.forEach((stage) => {
    let left = stage.waves;
    let firstChunk = true;
    const events: StageEvent[] = [];

    while (left > 0 && !stuck) {
      const hasStage = current.events.some((event) => event.kind === "stage");
      let fit = Math.floor((current.deadline - current.cursor) / stage.duration);

      if (fit <= 0) {
        if (!hasStage) {
          stuck = true;
          break;
        }
        current = openDay();
        continue;
      }

      if (firstChunk && hasStage) {
        const pauseFrom = current.cursor;
        current.cursor += pauseMinutes;
        if (pauseMinutes > 0) current.events.push({ kind: "pause", from: pauseFrom, to: current.cursor, stream });
        fit = Math.floor((current.deadline - current.cursor) / stage.duration);
        if (fit <= 0) {
          current = openDay();
          continue;
        }
      }

      const take = Math.min(fit, left);
      const from = current.cursor;
      current.cursor += take * stage.duration;
      const event: StageEvent = {
        kind: "stage",
        from,
        to: current.cursor,
        name: stage.name,
        waves: take,
        duration: stage.duration,
        matches: stage.matches,
        stream,
      };
      events.push(event);
      current.events.push(event);
      left -= take;
      firstChunk = false;
      if (left > 0) current = openDay();
    }

    events.forEach((event, index) => {
      event.index = index + 1;
      event.count = events.length;
    });
  });

  return { days, stuck };
}

/** Сводит дни потоков: в одном дне идут параллельные события обоих пулов. */
function mergeDays(
  packs: DayPlan[][],
  windows: { start: number; deadline: number }[],
  briefMinutes: number,
): DayPlan[] {
  const count = Math.max(...packs.map((days) => days.length));
  const merged: DayPlan[] = [];

  for (let index = 0; index < count; index += 1) {
    const window = windows[index] ?? windows[windows.length - 1];
    const events = packs.flatMap((days) => days[index]?.events ?? []);
    const cursors = packs
      .map((days) => days[index]?.cursor)
      .filter((cursor): cursor is number => typeof cursor === "number");

    merged.push({
      start: window.start,
      deadline: window.deadline,
      cursor: cursors.length ? Math.max(...cursors) : window.start + briefMinutes,
      events: events.sort((a, b) => a.from - b.from),
    });
  }

  return merged;
}

export function calculatePlan(input: PlannerInput): PlannerResult {
  const tables = Math.max(1, Math.round(input.tables || 0));
  const prelimMinutes = Math.max(1, Math.round(input.prelimMinutes || 1));
  const finalMinutes = Math.max(1, Math.round(input.finalMinutes || 1));
  const briefMinutes = Math.max(0, Math.round(input.briefMinutes || 0));
  const pauseMinutes = Math.max(0, Math.round(input.pauseMinutes || 0));
  const awardsMinutes = Math.max(0, Math.round(input.awardsMinutes || 0));

  const start = toMinutes(input.start) ?? 630;
  const deadline = toMinutes(input.deadline) ?? 990;
  const windows = [
    { start, deadline },
    ...input.extraDays.map((day) => ({
      start: toMinutes(day.start) ?? start,
      deadline: toMinutes(day.end) ?? deadline,
    })),
  ];

  const categories: Category[] = input.includeGirls ? ["boys", "girls"] : ["boys"];
  const categoryInput = (category: Category) => (category === "boys" ? input.boys : input.girls);

  const blank = categories.every((category) => Math.round(categoryInput(category).participants || 0) < 2);

  const distribution = categories.map((category) => {
    const info = finalsDistribution(categoryInput(category));
    return {
      category,
      participants: info.participants,
      explicit: info.explicit,
      left: info.left,
      autoIndex: info.autoIndex,
      autoSize: info.autoSize,
    };
  });

  if (blank) {
    return {
      ...emptyResult(
        "info",
        "Пока пусто. Впишите участников и группы — расчёт появится сразу. Дни добавляются кнопкой «Добавить день».",
        true,
      ),
      distribution,
    };
  }

  const girlsTablesWanted = Math.max(0, Math.round(input.girlsTables || 0));
  const parallel = categories.includes("girls") && girlsTablesWanted > 0;
  const girlsTables = parallel ? girlsTablesWanted : 0;
  const boysTables = parallel ? tables - girlsTables : tables;

  const problems: string[] = [];
  windows.forEach((window, index) => {
    if (window.deadline <= window.start) {
      problems.push(`${index === 0 ? "Первый день" : `День ${index + 1}`}: конец должен быть позже начала.`);
    }
  });

  categories.forEach((category) => {
    const prefix = categories.length > 1 ? (category === "boys" ? "Юноши: " : "Девушки: ") : "";
    const categoryData = categoryInput(category);
    const info = finalsDistribution(categoryData);
    if (info.participants < 2) problems.push(`${prefix}участников должно быть хотя бы двое.`);
    // Ноль групп допустим, когда все участники сразу уходят в финалы.
    const withoutPrelims = categoryData.groups === 0 && info.left === 0;
    if (!withoutPrelims && (categoryData.groups < 1 || categoryData.groups > info.participants)) {
      problems.push(`${prefix}групп должно быть от 1 до числа участников.`);
    }
    if (info.left < 0) {
      problems.push(`${prefix}в финалах ${info.explicit} мест, а участников ${info.participants}.`);
    }
  });

  if (parallel && boysTables < 1) {
    problems.push(`Девушкам отданы все ${tables} столов — юношам нужно оставить хотя бы один.`);
  }

  if (problems.length) {
    return {
      ...emptyResult("bad", problems.join(" "), false),
      distribution,
    };
  }

  const pools: PoolPlan[] = parallel
    ? [
        buildPool(["boys"], boysTables, prelimMinutes, finalMinutes, categoryInput, true),
        buildPool(["girls"], girlsTables, prelimMinutes, finalMinutes, categoryInput, true),
      ]
    : [buildPool(categories, tables, prelimMinutes, finalMinutes, categoryInput, false)];

  const packs = parallel
    ? [
        packStages(pools[0].stages, windows, briefMinutes, pauseMinutes, "boys"),
        packStages(pools[1].stages, windows, briefMinutes, pauseMinutes, "girls"),
      ]
    : [packStages(pools[0].stages, windows, briefMinutes, pauseMinutes, null)];

  const stuck = packs.some((pack) => pack.stuck);
  const days = mergeDays(
    packs.map((pack) => pack.days),
    windows,
    briefMinutes,
  );

  // Брифинг общий для потоков, поэтому добавляется один раз в начале каждого дня.
  days.forEach((day) => {
    if (briefMinutes > 0) day.events.unshift({ kind: "brief", from: day.start, to: day.start + briefMinutes });
  });

  const lastDay = days[days.length - 1];
  if (awardsMinutes > 0) {
    lastDay.events.push({ kind: "awards", from: lastDay.cursor, to: lastDay.cursor + awardsMinutes });
    lastDay.cursor += awardsMinutes;
  }

  const finishMinutes = lastDay.cursor;
  const marginMinutes = lastDay.deadline - finishMinutes;
  const daysWanted = windows.length;
  const daysUsed = days.length;

  const tableMinutes = pools.reduce((sum, pool) => sum + pool.tableMinutes, 0);
  const playMinutes = pools.reduce((sum, pool) => sum + pool.playMinutes, 0);
  const finalWaves = pools.reduce((sum, pool) => sum + pool.finalWaves, 0);
  const groupMatches = pools.reduce((sum, pool) => sum + pool.groupMatches, 0);
  const finalMatches = pools.reduce((sum, pool) => sum + pool.finalMatches, 0);

  let verdictTone: PlannerResult["verdictTone"] = "ok";
  let verdictText = "";

  if (stuck) {
    verdictTone = "bad";
    verdictText =
      `День слишком короткий: между ${formatMinutes(windows[0].start)} и ${formatMinutes(windows[0].deadline)} ` +
      "не помещается даже одна волна. Увеличьте рабочий день или укоротите матч.";
  } else if (marginMinutes < 0 || daysUsed > daysWanted) {
    verdictTone = "bad";
    let available = 0;
    windows.forEach((window) => {
      available += Math.max(0, window.deadline - window.start - briefMinutes - pauseMinutes - awardsMinutes);
    });
    const needTables = available > 0 ? Math.ceil(tableMinutes / available) : 0;
    const parts: string[] = [];
    if (daysUsed > daysWanted) {
      parts.push(
        `${daysWanted === 1 ? "В один день не укладываемся" : `За ${daysWanted} ${dayWord(daysWanted)} не укладываемся`} — ` +
          `понадобится ${daysUsed} ${dayWord(daysUsed)}.`,
      );
    }
    if (marginMinutes < 0) {
      parts.push(
        `Последний день заканчивается в ${formatMinutes(finishMinutes)} — перебор ${formatDuration(-marginMinutes)}.`,
      );
    }
    if (needTables > tables) {
      parts.push(`Чтобы уложиться, нужно примерно ${needTables} столов (сейчас ${tables}).`);
    }
    parts.push(`Финалы по 15 минут сэкономят около ${finalWaves * Math.max(0, finalMinutes - 15)} мин.`);
    verdictText = parts.join(" ");
  } else if (marginMinutes < 20) {
    verdictTone = "warn";
    verdictText =
      `Укладываемся, но почти без запаса${daysUsed > 1 ? ` за ${daysUsed} ${dayWord(daysUsed)}` : ""}: ` +
      `финиш ${formatMinutes(finishMinutes)}, в резерве ${formatDuration(marginMinutes)}. Один затянувшийся матч — и график поедет.`;
  } else {
    verdictTone = "ok";
    verdictText =
      `Укладываемся${daysUsed > 1 ? ` за ${daysUsed} ${dayWord(daysUsed)}` : ""} с запасом ${formatDuration(marginMinutes)}: ` +
      `финиш ${formatMinutes(finishMinutes)}, крайний срок ${formatMinutes(lastDay.deadline)}.` +
      (daysWanted - daysUsed > 0 ? ` Свободных дней: ${daysWanted - daysUsed} — можно заложить запас на непредвиденное.` : "");
  }

  const timeline: TimelineDay[] = days.map((day, dayIndex) => ({
    number: dayIndex + 1,
    window: `${formatMinutes(day.start)}–${formatMinutes(day.deadline)}`,
    finish: formatMinutes(day.cursor),
    events: day.events.map((event) => {
      const streamLabel = event.stream === "boys" ? "Юноши · " : event.stream === "girls" ? "Девушки · " : "";
      if (event.kind === "brief") {
        return {
          from: formatMinutes(event.from),
          to: formatMinutes(event.to),
          title: "Сбор, брифинг, публикация групп",
          note: `${briefMinutes} мин`,
        };
      }
      if (event.kind === "pause") {
        return {
          from: formatMinutes(event.from),
          to: formatMinutes(event.to),
          title: `${streamLabel}Перерыв, подсчёт, посев`,
          note: `${pauseMinutes} мин`,
        };
      }
      if (event.kind === "awards") {
        return {
          from: formatMinutes(event.from),
          to: formatMinutes(event.to),
          title: "Награждение, закрытие",
          note: `${awardsMinutes} мин`,
        };
      }
      const waves = event.waves ?? 0;
      return {
        from: formatMinutes(event.from),
        to: formatMinutes(event.to),
        title: `${streamLabel}${event.name ?? ""}${(event.index ?? 1) > 1 ? " — продолжение" : ""}`,
        note: `${waves} ${waveWord(waves)} по ${event.duration} мин${event.count === 1 ? `, матчей: ${event.matches}` : ""}`,
      };
    }),
  }));

  return {
    blank: false,
    hasErrors: false,
    verdictTone,
    verdictText,
    matchesTotal: groupMatches + finalMatches,
    groupMatches,
    finalMatches,
    playMinutes,
    tableMinutes,
    finishMinutes,
    marginMinutes,
    daysUsed,
    groups: pools.flatMap((pool) => pool.groups),
    finals: pools.flatMap((pool) => pool.finals),
    preliminary: {
      matches: pools.reduce((sum, pool) => sum + pool.preliminary.matches, 0),
      rounds: Math.max(...pools.map((pool) => pool.preliminary.rounds)),
      waves: pools.reduce((sum, pool) => sum + pool.preliminary.waves, 0),
      minutes: pools.reduce((sum, pool) => sum + pool.preliminary.minutes, 0),
    },
    finalStage: {
      matches: finalMatches,
      waves: finalWaves,
      minutes: pools.reduce((sum, pool) => sum + pool.finalStage.minutes, 0),
      roundRobinMatches: pools.reduce((sum, pool) => sum + pool.finalStage.roundRobinMatches, 0),
      olympicMatchesCount: pools.reduce((sum, pool) => sum + pool.finalStage.olympicMatchesCount, 0),
      extraMatches: pools.reduce((sum, pool) => sum + pool.finalStage.extraMatches, 0),
    },
    distribution,
    timeline,
  };
}
