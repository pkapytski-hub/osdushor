import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { ArchiveResult } from "@/lib/types";

/**
 * Места воспитанников, разложенные как в протоколе: сначала пол, внутри — возраст,
 * внутри возраста — вид программы. Пара и команда занимают одну строку на всех
 * своих участников: в базе они лежат по одной записи на человека с общим местом.
 */

type Gender = "m" | "f" | null;

/** Одна позиция протокола: личное место, пара или команда. */
type Position = {
  key: string;
  place: number | null;
  athletes: ArchiveResult[];
  /** Пол позиции: у смешанной пары или команды — «x». */
  gender: Gender | "x";
  age: string | null;
  kind: string | null;
};

type Group = { key: string; label: string; rank: [number, number, number]; positions: Position[] };

const KIND_LABELS: Record<string, string> = {
  Парные: "парные",
  Микст: "смешанные",
  Командные: "командные",
};

/** «2007» оставляем годом, «мужчины» — словом с заглавной буквы. */
function ageLabel(age: string | null): string {
  if (!age) return "";
  if (/^\d{4}$/.test(age)) return age;
  return age.charAt(0).toLocaleUpperCase("ru") + age.slice(1);
}

/** Взрослые категории сами называют пол. */
function impliedGender(age: string | null): Gender {
  if (age === "мужчины") return "m";
  if (age === "женщины") return "f";
  return null;
}

function rowGender(row: ArchiveResult): Gender {
  return row.gender === "m" ? "m" : row.gender === "f" ? "f" : null;
}

/** Пол позиции по её участникам: все одного пола — он, иначе смешанная. */
function positionGender(athletes: ArchiveResult[]): Gender | "x" {
  const known = new Set(athletes.map(rowGender).filter((value): value is "m" | "f" => value !== null));
  if (known.size === 0) return null;
  if (known.size === 1) return [...known][0];
  return "x";
}

/** Делит участников соревнования на позиции: личные, пары, смешанные пары, команды. */
function buildPositions(rows: ArchiveResult[]): Position[] {
  const buckets = new Map<string, ArchiveResult[]>();
  for (const row of rows) {
    const key = [row.age_category, row.event_kind, row.place].join("|");
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }

  const positions: Position[] = [];
  for (const [key, bucket] of buckets) {
    const kind = bucket[0].event_kind;
    if (kind === "Командные") {
      positions.push(makePosition(key, bucket));
    } else if (kind === "Парные") {
      positions.push(...splitByGender(key, bucket));
    } else if (kind === "Микст") {
      positions.push(...splitMixed(key, bucket));
    } else {
      bucket.forEach((row, index) => positions.push(makePosition(`${key}|${index}`, [row])));
    }
  }
  return positions;
}

function makePosition(key: string, athletes: ArchiveResult[]): Position {
  const sorted = [...athletes].sort((a, b) => a.full_name.localeCompare(b.full_name, "ru"));
  return {
    key,
    place: athletes[0].place,
    athletes: sorted,
    gender: positionGender(athletes),
    age: athletes[0].age_category,
    kind: athletes[0].event_kind,
  };
}

/** Парный разряд: в одной партии играют двое одного пола. */
function splitByGender(key: string, bucket: ArchiveResult[]): Position[] {
  const byGender = new Map<string, ArchiveResult[]>();
  for (const row of bucket) {
    const value = rowGender(row) ?? "?";
    const list = byGender.get(value);
    if (list) list.push(row);
    else byGender.set(value, [row]);
  }
  const positions: Position[] = [];
  for (const [value, list] of byGender) {
    for (let index = 0; index < list.length; index += 2) {
      positions.push(makePosition(`${key}|${value}|${index}`, list.slice(index, index + 2)));
    }
  }
  return positions;
}

/** Смешанный разряд: юноша и девушка в паре; без партнёра — одна строка. */
function splitMixed(key: string, bucket: ArchiveResult[]): Position[] {
  const girls = bucket.filter((row) => rowGender(row) === "f");
  const boys = bucket.filter((row) => rowGender(row) === "m");
  const rest = bucket.filter((row) => rowGender(row) === null);
  const positions: Position[] = [];
  const pairs = Math.min(girls.length, boys.length);
  for (let index = 0; index < pairs; index += 1) {
    positions.push(makePosition(`${key}|mix|${index}`, [girls[index], boys[index]]));
  }
  [...girls.slice(pairs), ...boys.slice(pairs), ...rest].forEach((row, index) =>
    positions.push(makePosition(`${key}|rest|${index}`, [row])),
  );
  return positions;
}

/** Подпись группы: «Юноши 2007», «Юноши 2007 · парные», «Смешанные пары 2011», «Команды 2011». */
function groupLabel(position: Position): string {
  if (position.kind === "Командные") return ["Команды", ageLabel(position.age)].filter(Boolean).join(" ");
  if (position.kind === "Микст") return ["Смешанные пары", ageLabel(position.age)].filter(Boolean).join(" ");
  const implied = impliedGender(position.age);
  const gender = implied ?? position.gender;
  const who =
    implied || gender === "x" ? "" : gender === "f" ? "Девушки" : gender === "m" ? "Юноши" : "";
  const head = [who, ageLabel(position.age)].filter(Boolean).join(" ");
  const kind = position.kind ? KIND_LABELS[position.kind] ?? "" : "";
  const parts = [head, kind].filter(Boolean).join(" · ");
  // Пол остался неизвестным (нет карточки и не угадывается по имени) — так и пишем.
  if (!gender) return parts ? `${parts} (пол не указан)` : "Пол не указан";
  return parts;
}

function groupKey(position: Position): string {
  // Смешанные пары и команды не делим по полу: иначе одна и та же подпись
  // повторяется дважды — для полной пары и для участника без партнёра.
  const mixed = position.kind === "Микст" || position.kind === "Командные";
  const gender = mixed ? "" : impliedGender(position.age) ?? position.gender ?? "";
  return [position.age ?? "", gender, position.kind ?? ""].join("|");
}

function groupRank(position: Position): [number, number, number] {
  // В таблице сначала юноши, потом девушки — как в протоколах.
  const gender = impliedGender(position.age) ?? position.gender;
  const genderRank = gender === "m" ? 0 : gender === "f" ? 1 : 2;
  const ageRank =
    position.age && /^\d{4}$/.test(position.age) ? Number(position.age) : Number.MAX_SAFE_INTEGER;
  const kindRank =
    position.kind === "Личные" ? 0 : position.kind === "Парные" ? 1 : position.kind === "Микст" ? 2 : 3;
  return [genderRank, ageRank, kindRank];
}

function sortPositions(positions: Position[]): Position[] {
  return [...positions].sort(
    (a, b) => (a.place ?? 99) - (b.place ?? 99) || a.key.localeCompare(b.key),
  );
}

/** Раскладывает места по группам. onlyPrizes оставляет только 1–3 места. */
export function archiveLayout(
  rows: ArchiveResult[],
  options: { onlyPrizes?: boolean } = {},
): { groups: Group[]; shown: number } {
  let positions = buildPositions(rows);
  if (options.onlyPrizes) {
    positions = positions.filter((position) => position.place != null && position.place <= 3);
  }
  const groups = new Map<string, Group>();
  for (const position of positions) {
    const key = groupKey(position);
    let group = groups.get(key);
    if (!group) {
      group = { key, label: groupLabel(position), rank: groupRank(position), positions: [] };
      groups.set(key, group);
    }
    group.positions.push(position);
  }
  const sorted = [...groups.values()]
    .sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.rank[2] - b.rank[2])
    .map((group) => ({ ...group, positions: sortPositions(group.positions) }));
  return { groups: sorted, shown: positions.length };
}

/** Сколько призовых (1–3) мест у соревнования — чтобы не выводить пустые записи. */
export function prizeCount(rows: ArchiveResult[]): number {
  return archiveLayout(rows, { onlyPrizes: true }).shown;
}

/**
 * Места колонками: у каждой категории (пол, год рождения, вид программы) своя
 * таблица «место — фамилия», места идут сверху вниз по возрастанию. Блоки
 * выстраиваются в две-три колонки, поэтому широкой сетки с прочерками нет.
 * Пара занимает одну строку: «Фамилия / Фамилия».
 * onlyPrizes оставляет только первые три места — для общей страницы архива.
 */
export function ArchiveTable({
  rows,
  onlyPrizes = false,
}: {
  rows: ArchiveResult[];
  onlyPrizes?: boolean;
}) {
  const { groups } = archiveLayout(rows, { onlyPrizes });
  if (groups.length === 0) return null;

  return (
    <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => (
        <div key={group.key} className="min-w-0 border border-navy-100 bg-white">
          <p className="bg-mist px-3 py-2 text-[11px] font-medium leading-snug text-navy-900">
            {group.label}
          </p>
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">{group.label}: места по порядку</caption>
            <tbody>
              {group.positions.map((position) => (
                <tr key={position.key} className="border-t border-navy-100 first:border-t-0">
                  <th
                    scope="row"
                    className={cn(
                      "w-9 py-1.5 pl-3 pr-1 text-right align-top font-display text-base leading-6",
                      position.place === 1 ? "text-accent-600" : "text-navy-800",
                    )}
                  >
                    {position.place ?? "—"}
                  </th>
                  <td className="py-1.5 pl-2 pr-3 align-top leading-6 text-graphite-700">
                    {position.athletes.map((athlete, athleteIndex) => (
                      <span key={athlete.id}>
                        {athleteIndex > 0 && <span className="text-graphite-400"> / </span>}
                        <Link
                          to={`/sportsmeny/${athlete.athlete_id}`}
                          className="transition-colors hover:text-accent-600"
                        >
                          {athlete.full_name}
                        </Link>
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
