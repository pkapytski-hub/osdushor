/**
 * Подбор системы проведения соревнования по числу участников и окну времени.
 *
 * Модуль перебирает варианты (круговая, группы 5–6 с сетками по местам,
 * олимпийская −1 и −2) и оценивает каждый существующим расчётом времени:
 * тот же calculatePlan, что и планировщик. Экрана пока нет — это движок.
 */
import {
  calculatePlan,
  formatMinutes,
  type CategoryInput,
  type DayWindow,
  type FinalSetting,
  type FinalSystem,
  type PlannerInput,
  type PlannerResult,
} from "./competition-timing";

export type FormatKind = "round_robin" | "groups_playoffs" | "olympic_1" | "olympic_2";

export interface FormatSearchInput {
  participants: number;
  tables: number;
  start: string;
  deadline: string;
  extraDays?: DayWindow[];
  prelimMinutes?: number;
  finalMinutes?: number;
  briefMinutes?: number;
  pauseMinutes?: number;
  awardsMinutes?: number;
  /** Сколько вариантов вернуть. По умолчанию три. */
  limit?: number;
}

export interface FormatOption {
  kind: FormatKind;
  title: string;
  summary: string;
  plan: PlannerResult;
  /** Сколько дней занимает вариант при заданном окне. */
  days: number;
  /** Уложились в окно и в заданное число дней. */
  fits: boolean;
  /** Матчей на участника: минимум и максимум по сеткам. */
  matches: { min: number; max: number };
  matchesText: string;
  finish: string;
}

/**
 * Делит участников на несколько сеток размера плей-офф без остатка:
 * 29 и плей-офф на 8 — это 8, 7, 7, 7, а не 8 и «осталось 21».
 */
export function splitIntoPlayoffs(participants: number, playoffSize: number): FinalSetting[] {
  const size = Math.max(2, Math.min(participants, Math.round(playoffSize) || participants));
  let grids = Math.max(1, Math.ceil(participants / size));
  // Сетка из одного человека не нужна — лучше одна сетка чуть больше плей-офф.
  while (grids > 1 && Math.floor(participants / grids) < 2) grids -= 1;
  const base = Math.floor(participants / grids);
  const bigger = participants % grids;
  return Array.from({ length: grids }, (_, index) => ({
    system: "ko1" as const,
    size: index < bigger ? base + 1 : base,
  }));
}

function plural(count: number, one: string, few: string, many: string): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

interface Draft {
  kind: FormatKind;
  title: string;
  summary: string;
  category: CategoryInput;
}

/** Кандидаты перебираются грубо: расчёт всё равно отбросит нереальные. */
function drafts(participants: number): Draft[] {
  const result: Draft[] = [
    {
      kind: "round_robin",
      title: "Круговая, все со всеми",
      summary: `Одна группа на ${participants} человек, каждый играет с каждым.`,
      category: { participants, groups: 1, extra: 0, finals: [] },
    },
    {
      kind: "olympic_1",
      title: "Олимпийская −1",
      summary: "Одна сетка на всех: проигравший не выбывает, а доигрывает места ниже.",
      category: { participants, groups: 0, extra: 0, finals: [{ system: "ko1", size: participants }] },
    },
    {
      kind: "olympic_2",
      title: "Олимпийская −2",
      summary: "Две сетки: за первые места и за остальные.",
      category: { participants, groups: 0, extra: 0, finals: [{ system: "ko2", size: participants }] },
    },
  ];

  // Группы 5–6 человек плюс сетки по местам, чтобы никто не остался без игр.
  for (const groupSize of [6, 5]) {
    const groups = Math.max(1, Math.ceil(participants / groupSize));
    const grids: { finals: FinalSetting[]; label: string; note: string }[] = [
      {
        finals: [{ system: "ko1", size: participants }],
        label: "общая сетка на всех",
        note: `затем олимпийская −1 на ${participants} мест.`,
      },
    ];
    for (const gridSize of [8, 4]) {
      const finals = splitIntoPlayoffs(participants, gridSize);
      if (finals.length > 6) continue;
      grids.push({
        finals,
        label: `${finals.length} ${plural(finals.length, "сетка", "сетки", "сеток")} по местам`,
        note: `затем ${plural(finals.length, "сетка", "сетки", "сеток")} на ${finals.map((final) => final.size).join("/")}.`,
      });
    }
    for (const grid of grids) {
      result.push({
        kind: "groups_playoffs",
        title: `Группы по ${groupSize} + ${grid.label}`,
        summary: `${plural(groups, "Группа", "Группы", "Групп")} по ${groupSize}, ${grid.note}`,
        category: { participants, groups, extra: 0, finals: grid.finals },
      });
    }
  }

  return result;
}

/**
 * Минимум матчей в олимпийской −1: участник проигрывает первый же матч
 * и дальше тоже выбывает первым, пока не доберётся до своего места.
 */
function bracketMin(size: number): number {
  if (size < 2) return 0;
  let base = 2;
  while (base < size) base *= 2;
  const levels = Math.round(Math.log2(base));
  const playIn = Math.max(0, size - base / 2);
  const throughLoss = 1 + bracketMin(playIn);
  const throughBye = size < base ? levels - 1 : Infinity;
  return Math.min(throughLoss, throughBye);
}

/**
 * Матчи одного участника в сетке — по числу раундов.
 * −1 разыгрывает все места: минимум зависит от проходов и bye (при 17
 * участниках кто-то играет всего один матч), максимум — победитель.
 * −2 добавляет нижнюю сетку: рано проигравший играет rounds + 1.
 */
function gridMatches(size: number, system: FinalSystem): { min: number; max: number } {
  if (size < 2) return { min: 0, max: 0 };
  if (system === "rr") return { min: size - 1, max: size - 1 };
  const rounds = Math.ceil(Math.log2(size));
  if (system === "ko1") return { min: bracketMin(size), max: rounds };
  // Больше, чем матчей в сетке, участник провести не может (например, двое).
  return { min: Math.max(1, rounds - 1), max: Math.min(rounds + 1, Math.max(1, size - 1)) };
}

/** Матчи на участника: группа плюс ровно одна сетка — участник играет только в своей. */
function matchesPerParticipant(category: CategoryInput, plan: PlannerResult): { min: number; max: number } {
  const sizes = plan.groups.map((group) => group.size);
  const groupMin = sizes.length > 0 ? Math.min(...sizes) - 1 : 0;
  const groupMax = sizes.length > 0 ? Math.max(...sizes) - 1 : 0;
  let gridMin = Infinity;
  let gridMax = -Infinity;
  for (const final of category.finals) {
    if (final.size < 2) continue;
    const matches = gridMatches(final.size, final.system);
    gridMin = Math.min(gridMin, matches.min);
    gridMax = Math.max(gridMax, matches.max);
  }
  return {
    min: Math.max(0, groupMin + (Number.isFinite(gridMin) ? gridMin : 0)),
    max: Math.max(0, groupMax + (Number.isFinite(gridMax) ? gridMax : 0)),
  };
}

function evaluate(draft: Draft, input: FormatSearchInput, base: PlannerInput): FormatOption | null {
  const plannerInput: PlannerInput = {
    ...base,
    tables: input.tables,
    start: input.start,
    deadline: input.deadline,
    extraDays: input.extraDays ?? [],
    includeGirls: false,
    girlsTables: 0,
    boys: draft.category,
  };
  const plan = calculatePlan(plannerInput);
  if (plan.blank || plan.hasErrors) return null;

  const matches = matchesPerParticipant(draft.category, plan);
  return {
    kind: draft.kind,
    title: draft.title,
    summary: draft.summary,
    plan,
    days: plan.daysUsed,
    fits: plan.daysUsed <= plannerInput.extraDays.length + 1 && plan.marginMinutes >= 0,
    matches,
    matchesText: matches.min === matches.max ? String(matches.min) : `${matches.min}–${matches.max}`,
    finish: formatMinutes(plan.finishMinutes),
  };
}

const KIND_ORDER: Record<FormatKind, number> = {
  groups_playoffs: 0,
  olympic_1: 1,
  olympic_2: 2,
  round_robin: 3,
};

/**
 * Лучше тот, кто уложился в окно, затем кто занимает меньше дней,
 * затем кто даёт больше матчей, затем кто раньше финиширует.
 */
function compare(left: FormatOption, right: FormatOption): number {
  if (left.fits !== right.fits) return left.fits ? -1 : 1;
  if (left.days !== right.days) return left.days - right.days;
  if (left.matches.min !== right.matches.min) return right.matches.min - left.matches.min;
  if (left.plan.finishMinutes !== right.plan.finishMinutes) {
    return left.plan.finishMinutes - right.plan.finishMinutes;
  }
  return KIND_ORDER[left.kind] - KIND_ORDER[right.kind];
}

/**
 * Перебирает варианты и возвращает лучшие: по одному из каждой системы,
 * чтобы можно было сравнить подходы, а не три похожих раскладки групп.
 */
export function searchFormats(input: FormatSearchInput): FormatOption[] {
  if (input.participants < 2) return [];
  const base: PlannerInput = {
    tables: input.tables,
    start: input.start,
    deadline: input.deadline,
    extraDays: input.extraDays ?? [],
    prelimMinutes: input.prelimMinutes ?? 15,
    finalMinutes: input.finalMinutes ?? 20,
    briefMinutes: input.briefMinutes ?? 10,
    pauseMinutes: input.pauseMinutes ?? 15,
    awardsMinutes: input.awardsMinutes ?? 20,
    includeGirls: false,
    girlsTables: 0,
    boys: { participants: input.participants, groups: 1, extra: 0, finals: [] },
    girls: { participants: 0, groups: 0, extra: 0, finals: [] },
  };

  const best = new Map<FormatKind, FormatOption>();
  for (const draft of drafts(input.participants)) {
    const option = evaluate(draft, input, base);
    if (!option) continue;
    const current = best.get(option.kind);
    if (!current || compare(option, current) < 0) best.set(option.kind, option);
  }

  return [...best.values()].sort(compare).slice(0, Math.max(1, input.limit ?? 3));
}
