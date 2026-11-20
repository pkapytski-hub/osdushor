// Справочник схем проведения соревнований — как в программе Tournament Manager
// (RTTF). Схема задаёт последовательность этапов; параметры этапов повторяют
// PredefinedSchemas.xml: Type=Group|Bracket, MaxGroupCount, MaxPlayerCount,
// BuildingMode, SequenceMethod, SubStages.
//
// Названия и порядок этапов держим простыми: у схемы не больше двух этапов,
// а всё, что относится к подсчёту, живёт в worker/lib/stages.ts.

/** Пять схем, которые программа предлагает в «Экспорте результатов». */
export type SchemeId =
  | "round_robin"
  | "round_robin_2"
  | "bracket"
  | "groups_bracket"
  | "groups_two_finals";

export type StageKind = "groups" | "bracket";

export interface SchemeStage {
  kind: StageKind;
  /** Заголовок этапа в интерфейсе и протоколе. */
  title: string;
  /** Группы: 1 — каждый с каждым один раз, 2 — в два круга. */
  rounds: 1 | 2;
  /** Группы: сколько человек в группе; 0 — все участники в одной группе. */
  groupSize: number;
  /** Группы: сколько человек выходит из каждой группы на следующий этап. */
  advance: number;
  /** Сетка: 1 — одна сетка, 2 — финал А и финал Б. */
  finals: 1 | 2;
  /** Сетка: доигрываются ли все места (олимпийская система). */
  allPlaces: boolean;
}

export interface Scheme {
  id: SchemeId;
  title: string;
  /** Короткая подпись для карточки выбора. */
  short: string;
  description: string;
  /** Как выглядят этапы: «Группы → сетка». */
  flow: string;
  stages: SchemeStage[];
}

const groups = (options: {
  title: string;
  rounds?: 1 | 2;
  groupSize?: number;
  advance?: number;
}): SchemeStage => ({
  kind: "groups",
  title: options.title,
  rounds: options.rounds ?? 1,
  groupSize: options.groupSize ?? 6,
  advance: options.advance ?? 0,
  finals: 1,
  allPlaces: false,
});

const bracket = (options: {
  title: string;
  finals?: 1 | 2;
  allPlaces?: boolean;
}): SchemeStage => ({
  kind: "bracket",
  title: options.title,
  rounds: 1,
  groupSize: 0,
  advance: 0,
  finals: options.finals ?? 1,
  allPlaces: options.allPlaces ?? true,
});

export const SCHEMES: Scheme[] = [
  {
    id: "round_robin",
    title: "Круговая (каждый с каждым)",
    short: "Круговая",
    description:
      "Все участники в одной группе и играют каждый с каждым один раз. Места — по таблице группы: очки, затем личные встречи и партии.",
    flow: "Одна группа · один круг",
    stages: [groups({ title: "Круговая", groupSize: 0 })],
  },
  {
    id: "round_robin_2",
    title: "Круговая в 2 круга",
    short: "2 круга",
    description:
      "Каждая пара встречается дважды, второй круг — с переменой сторон. Места считаются по общей таблице, как в одном круге.",
    flow: "Одна группа · два круга",
    stages: [groups({ title: "Круговая в 2 круга", rounds: 2, groupSize: 0 })],
  },
  {
    id: "bracket",
    title: "Сетка (все места)",
    short: "Сетка",
    description:
      "Олимпийская система: проигравший не выбывает из турнира, а переходит в сетку за места пониже. Итоговое место получает каждый участник.",
    flow: "Сетка на вылет · все места",
    stages: [bracket({ title: "Сетка" })],
  },
  {
    id: "groups_bracket",
    title: "Группы + Сетка",
    short: "Группы + сетка",
    description:
      "Группы по 5–6 человек, из каждой выходят двое сильнейших. Они играют сетку на вылет за первые места, остальные места — по таблицам групп.",
    flow: "Группы → сетка",
    stages: [
      groups({ title: "Групповой этап", groupSize: 6, advance: 2 }),
      bracket({ title: "Сетка" }),
    ],
  },
  {
    id: "groups_two_finals",
    title: "Группы + два финала",
    short: "Два финала",
    description:
      "Группы по 5–6 человек: двое сильнейших из каждой играют финал А, остальные — финал Б. В каждом финале сетка на вылет со всеми местами.",
    flow: "Группы → финал А и финал Б",
    stages: [
      groups({ title: "Групповой этап", groupSize: 6, advance: 2 }),
      bracket({ title: "Финалы", finals: 2 }),
    ],
  },
];

export const DEFAULT_SCHEME: SchemeId = "groups_bracket";

export function schemeById(id: string): Scheme | null {
  return SCHEMES.find((scheme) => scheme.id === id) ?? null;
}

/** Схема по старому формату турнира — для турниров, заведённых до конструктора. */
export function schemeForLegacyFormat(format: string): SchemeId {
  if (format === "olympic") return "bracket";
  if (format === "groups_playoff") return "groups_bracket";
  return "round_robin";
}

/**
 * Старый формат турнира для колонки tournaments.format: по ней работают
 * публичные страницы и прежний подсчёт рейтинга. Схема конструктора хранится
 * рядом в scheme_id и остаётся главной.
 */
export function legacyFormatForScheme(id: SchemeId): "round_robin" | "groups_playoff" | "olympic" {
  if (id === "bracket") return "olympic";
  if (id === "groups_bracket" || id === "groups_two_finals") return "groups_playoff";
  return "round_robin";
}
