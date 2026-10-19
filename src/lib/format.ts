const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const dateShortFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

const weekdayFormatter = new Intl.DateTimeFormat("ru-RU", { weekday: "long" });

export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | null | undefined, fallback = "Дата уточняется"): string {
  const date = parseDate(value);
  return date ? dateFormatter.format(date) : fallback;
}

export function formatDateShort(value: string | null | undefined, fallback = "—"): string {
  const date = parseDate(value);
  return date ? dateShortFormatter.format(date) : fallback;
}

export function formatDateTime(value: string | null | undefined, fallback = "Дата и время уточняются"): string {
  const date = parseDate(value);
  if (!date) return fallback;
  return `${dateFormatter.format(date)}, ${timeFormatter.format(date)}`;
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "";
  const plain = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (plain) return `${plain[1].padStart(2, "0")}:${plain[2]}`;
  const date = parseDate(value);
  return date ? timeFormatter.format(date) : "";
}

export function formatDateRange(starts: string, ends: string | null): string {
  const start = parseDate(starts);
  if (!start) return "Дата уточняется";
  if (!ends) return formatDate(starts);
  const end = parseDate(ends);
  if (!end) return formatDate(starts);
  if (dateShortFormatter.format(start) === dateShortFormatter.format(end)) return formatDate(starts);
  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth()
  ) {
    return `${start.getDate()}–${new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(end)}`;
  }
  if (start.getFullYear() === end.getFullYear()) {
    const left = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(start);
    const right = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(end);
    return `${left} — ${right} ${end.getFullYear()} г.`;
  }
  return `${formatDate(starts)} — ${formatDate(ends)}`;
}

export function monthShort(value: string): string {
  const date = parseDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("ru-RU", { month: "short" }).format(date).replace(".", "");
}

export function dayOfMonth(value: string): string {
  const date = parseDate(value);
  return date ? String(date.getDate()).padStart(2, "0") : "—";
}

export function weekdayLabel(value: string): string {
  const date = parseDate(value);
  return date ? weekdayFormatter.format(date) : "";
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function toDateTimeInput(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function nowDateTimeInput(): string {
  return toDateTimeInput(new Date().toISOString());
}

export function todayInput(): string {
  return toDateTimeInput(new Date().toISOString()).slice(0, 10);
}
