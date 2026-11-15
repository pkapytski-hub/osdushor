import { FINAL_SYSTEMS, type CategoryInput, type FinalSetting, type PlannerInput } from "./competition-timing";
import { splitIntoPlayoffs } from "./competition-format";
import { parseDate } from "./format";
import type { Competition, Tournament } from "./types";

/**
 * Предзаполнение планировщика: всё, что известно о турнире, передаётся в ссылке,
 * поэтому страница не делает лишний запрос к API и ссылкой можно поделиться.
 */
export interface PlannerCategorySeed {
  participants: number;
  groups: number;
  extra?: number;
  finals?: FinalSetting[];
}

export interface PlannerSeed {
  /** Сколько дней идёт соревнование. Без значения дни остаются как в планировщике. */
  days?: number;
  tables?: number;
  boys?: PlannerCategorySeed;
  girls?: PlannerCategorySeed;
}

function encodeFinals(finals: FinalSetting[]): string {
  return finals.map((final) => `${final.system}:${final.size}`).join(",");
}

function decodeFinals(raw: string | null): FinalSetting[] {
  if (!raw) return [];
  const result: FinalSetting[] = [];
  for (const chunk of raw.split(",")) {
    const [system, size] = chunk.split(":");
    if (!FINAL_SYSTEMS.some((item) => item.value === system)) continue;
    const parsed = Math.round(Number(size));
    if (!Number.isFinite(parsed)) continue;
    result.push({ system: system as FinalSetting["system"], size: Math.max(0, parsed) });
  }
  return result;
}

const numberParam = (params: URLSearchParams, key: string, fallback: number): number => {
  const raw = params.get(key);
  if (raw === null || raw === "") return fallback;
  const parsed = Math.round(Number(raw));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
};

export function plannerHref(seed: PlannerSeed): string {
  const params = new URLSearchParams();
  if (seed.days !== undefined) params.set("days", String(seed.days));
  if (seed.tables !== undefined) params.set("tables", String(seed.tables));
  for (const category of ["boys", "girls"] as const) {
    const value = seed[category];
    if (!value) continue;
    params.set(category, String(value.participants));
    params.set(`${category}Groups`, String(value.groups));
    if (value.extra) params.set(`${category}Extra`, String(value.extra));
    const finals = encodeFinals(value.finals ?? []);
    if (finals) params.set(`${category}Finals`, finals);
  }
  return `/planner?${params.toString()}`;
}

function readCategory(params: URLSearchParams, key: "boys" | "girls"): CategoryInput | null {
  if (!params.has(key)) return null;
  return {
    participants: numberParam(params, key, 0),
    groups: numberParam(params, `${key}Groups`, 0),
    extra: numberParam(params, `${key}Extra`, 0),
    finals: decodeFinals(params.get(`${key}Finals`)),
  };
}

/**
 * Применяет предзаполнение из адреса к текущим настройкам.
 * null — предзаполнения нет, планировщик открывается как обычно.
 */
export function applyPlannerSeed(base: PlannerInput, search: string): PlannerInput | null {
  const params = new URLSearchParams(search);
  if (!["days", "tables", "boys", "girls"].some((key) => params.has(key))) return null;

  const next: PlannerInput = { ...base };
  if (params.has("days")) {
    const days = Math.max(1, Math.min(7, numberParam(params, "days", 1)));
    next.extraDays = Array.from({ length: days - 1 }, () => ({ start: base.start, end: base.deadline }));
  }
  if (params.has("tables")) {
    next.tables = Math.max(1, numberParam(params, "tables", base.tables));
  }
  const boys = readCategory(params, "boys");
  const girls = readCategory(params, "girls");
  if (boys) {
    next.boys = boys;
    // Состав турнира — один поток: девушек из прежних настроек не подмешиваем.
    next.includeGirls = Boolean(girls);
  }
  if (girls) {
    next.girls = girls;
    next.includeGirls = true;
  }
  return next;
}

/**
 * Турнир хранит состав и формат, но не число столов. На групповом этапе
 * одновременно идёт по встрече в каждой группе, поэтому столов берём по числу групп.
 */
export function tournamentPlannerHref(item: Tournament): string | null {
  const participants = item.participants ?? 0;
  if (participants < 2) return null;
  const groupSize = Math.max(2, item.group_size || 6);
  const groups = item.format === "olympic" ? 0 : Math.max(1, Math.ceil(participants / groupSize));
  const finals: FinalSetting[] =
    item.format === "olympic"
      ? [{ system: "ko1", size: participants }]
      : item.format === "groups_playoff"
        ? splitIntoPlayoffs(participants, item.playoff_size)
        : [];
  return plannerHref({
    tables: groups > 0 ? groups : undefined,
    boys: { participants, groups, extra: 0, finals },
  });
}

function dateSpan(startsOn: string, endsOn: string | null): number {
  const start = parseDate(startsOn);
  const end = parseDate(endsOn ?? startsOn);
  if (!start || !end) return 1;
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.max(1, Math.min(7, days));
}

/** У соревнования в календаре известны только даты — подставляем число дней. */
export function competitionPlannerHref(item: Competition): string {
  return plannerHref({ days: dateSpan(item.starts_on, item.ends_on) });
}
