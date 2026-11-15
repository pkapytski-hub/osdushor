/**
 * Автоматическая расстановка встреч по времени и столам.
 *
 * Встречи идут волнами: в одной волне не больше столов и ни один участник
 * не играет две встречи сразу. Круги не смешиваются — второй круг группы
 * не может начаться раньше первого. Дата — день турнира, если волны не
 * помещаются в сутки, продолжение переносится на следующие дни.
 */

export interface ScheduleMatch {
  id: string;
  stage: "group" | "playoff";
  group_no: number | null;
  round: number;
  slot: number;
  place_from?: number | null;
  player_a: string;
  player_b: string;
}

export interface ScheduleOptions {
  /** День турнира: ГГГГ-ММ-ДД. */
  date: string;
  /** Начало первой волны: ЧЧ:ММ. */
  start: string;
  /** Сколько столов занято одновременно. */
  tables: number;
  /** Длительность встречи в минутах. */
  minutes: number;
}

export interface ScheduledMatch {
  id: string;
  scheduled_at: string;
  table_no: number;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** «10:30», «9:05» → минуты от полуночи; мусор — null. */
export function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Минуты от полуночи → «10:30». */
function formatClock(total: number): string {
  const minutes = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** Дата плюс целые сутки, без зависимости от часового пояса машины. */
function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const stamp = new Date(Date.UTC(year, month - 1, day) + days * 86_400_000);
  return `${stamp.getUTCFullYear()}-${pad(stamp.getUTCMonth() + 1)}-${pad(stamp.getUTCDate())}`;
}

/** Время начала волны: волны идут подряд, через сутки — следующий день. */
function slotTime(date: string, minutes: number, startMinutes: number, wave: number): string {
  const total = startMinutes + wave * minutes;
  const day = Math.floor(total / 1440);
  return `${addDays(date, day)}T${formatClock(total)}`;
}

function overlaps(left: ScheduleMatch, right: ScheduleMatch): boolean {
  return (
    left.player_a === right.player_a ||
    left.player_a === right.player_b ||
    left.player_b === right.player_a ||
    left.player_b === right.player_b
  );
}

/**
 * Раскладывает встречи по волнам. Возвращает новое расписание для каждой
 * встречи; порядок результата совпадает с порядком входных встреч.
 */
export function buildSchedule(matches: ScheduleMatch[], options: ScheduleOptions): ScheduledMatch[] {
  const startMinutes = parseClock(options.start) ?? 630;
  const tables = Math.max(1, Math.round(options.tables));
  const minutes = Math.max(1, Math.round(options.minutes));

  const groups = matches
    .filter((match) => match.stage === "group")
    .sort((a, b) => a.round - b.round || (a.group_no ?? 0) - (b.group_no ?? 0) || a.slot - b.slot);
  const playoff = matches
    .filter((match) => match.stage === "playoff")
    .sort(
      (a, b) =>
        a.round - b.round ||
        (a.place_from ?? 0) - (b.place_from ?? 0) ||
        a.slot - b.slot,
    );

  // Круг — отдельный блок: встречи следующего круга не встают в одну волну
  // с предыдущим, даже если столы свободны.
  const blocks: ScheduleMatch[][] = [];
  for (const round of [...new Set(groups.map((match) => match.round))].sort((a, b) => a - b)) {
    blocks.push(groups.filter((match) => match.round === round));
  }
  for (const round of [...new Set(playoff.map((match) => match.round))].sort((a, b) => a - b)) {
    blocks.push(playoff.filter((match) => match.round === round));
  }

  const placed = new Map<string, { wave: number; table: number }>();
  let wave = 0;
  for (const block of blocks) {
    let current: ScheduleMatch[] = [];
    const flush = () => {
      if (current.length === 0) return;
      current.forEach((match, index) => placed.set(match.id, { wave, table: index + 1 }));
      current = [];
      wave += 1;
    };
    for (const match of block) {
      const busy = current.length >= tables || current.some((item) => overlaps(item, match));
      if (busy) flush();
      current.push(match);
    }
    flush();
  }

  return matches.map((match) => {
    const spot = placed.get(match.id) ?? { wave: 0, table: 1 };
    return {
      id: match.id,
      scheduled_at: slotTime(options.date, minutes, startMinutes, spot.wave),
      table_no: spot.table,
    };
  });
}
