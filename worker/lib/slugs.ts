import { ApiProblem, str } from "./http";

const TRANSLITERATION: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .split("")
    .map((char) => TRANSLITERATION[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "material";
}

const ALLOWED_TABLES = new Set(["news", "competitions"]);

export async function uniqueSlug(
  db: D1Database,
  table: "news" | "competitions",
  requested: string,
  fallback: string,
  excludeId?: string,
): Promise<string> {
  if (!ALLOWED_TABLES.has(table)) throw new ApiProblem(500, "invalid_table", "Внутренняя ошибка.");
  const base = slugify(str(requested, 90) || fallback);
  let candidate = base;
  for (let i = 2; i < 60; i += 1) {
    const row = excludeId
      ? await db.prepare(`SELECT id FROM ${table} WHERE slug = ? AND id <> ?`).bind(candidate, excludeId).first()
      : await db.prepare(`SELECT id FROM ${table} WHERE slug = ?`).bind(candidate).first();
    if (!row) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}
