#!/usr/bin/env node
/**
 * Импорт календаря соревнований и архива результатов из Notion.
 *
 * Спортсменов создаёт и обновляет только «Книга учащихся»
 * (scripts/import-students.mjs), поэтому страницы базы «Спортсмены» здесь
 * читаются лишь для сопоставления: место привязывается к уже загруженному
 * воспитаннику по notion_id, затем по ФИО и году рождения. Несопоставленные
 * строки не записываются и попадают в отчёт.
 *
 *   node scripts/import-notion.mjs                  # локальная база
 *   node scripts/import-notion.mjs --remote         # рабочая база на Cloudflare
 *   node scripts/import-notion.mjs --dry-run        # только отчёт, без записи
 *   node scripts/import-notion.mjs --from-file=x.json  # офлайн-снимок страниц
 *   node scripts/import-notion.mjs --no-prune       # не удалять пропавшие места
 *
 * Токен берётся из переменной окружения NOTION_TOKEN или из .dev.vars.
 * Нужна внутренняя интеграция Notion, которой расшарены базы «Спортсмены»,
 * «Календарь соревнований» и «Результаты».
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const argList = process.argv.slice(2);
const hasFlag = (name) => argList.includes(`--${name}`);
const option = (name) => {
  const prefix = `--${name}=`;
  const found = argList.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
};

const remote = hasFlag("remote");
const dryRun = hasFlag("dry-run");
const noPrune = hasFlag("no-prune");
// По умолчанию заводим карточку спортсмену, которого нет в книге учащихся,
// но чьи места есть в Notion: иначе эти результаты некуда привязать.
const noCreateAthletes = hasFlag("no-create-athletes");
const fromFile = option("from-file");

const DB_NAME = "osdushor-db";
const NOTION_VERSION = "2022-06-28";
const DATABASES = {
  athletes: "12fce97e-9b70-816a-92f0-f77c8f3f852c",
  calendar: "12fce97e-9b70-81a4-b51a-f6cb2f08679e",
  results: "12fce97e-9b70-81f5-bb76-f1cafda75703",
};

const WRANGLER_CLI = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function wrangler(args, { capture = false } = {}) {
  const result = spawnSync(process.execPath, [WRANGLER_CLI, "d1", "execute", DB_NAME, ...args], {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });
  if (result.status !== 0) throw new Error(`wrangler завершился с кодом ${result.status ?? "?"}`);
  return result.stdout ?? "";
}

function queryJson(sql) {
  const args = remote ? ["--remote", "--command", sql, "--json"] : ["--local", "--command", sql, "--json"];
  const output = wrangler(args, { capture: true });
  const start = output.indexOf("[");
  const end = output.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("Не удалось разобрать ответ wrangler.");
  return JSON.parse(output.slice(start, end + 1))[0]?.results ?? [];
}

function queryRows(sql, { optional = false } = {}) {
  try {
    return queryJson(sql);
  } catch (error) {
    if (optional) return [];
    throw error;
  }
}

function runFile(args) {
  const result = spawnSync(process.execPath, [WRANGLER_CLI, "d1", "execute", DB_NAME, ...args], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    throw new Error(`wrangler завершился с кодом ${result.status ?? "?"}`);
  }
}

function executeSql(statements, label) {
  if (statements.length === 0) return;
  const dir = mkdtempSync(join(tmpdir(), "osdushor-results-"));
  const path = join(dir, `${label}.sql`);
  writeFileSync(path, `${statements.join("\n")}\n`, "utf8");
  runFile(remote ? ["--remote", "--file", path, "--yes"] : ["--local", "--file", path]);
}

const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;
const sqlValue = (value) => (value === null || value === undefined || value === "" ? "NULL" : quote(value));
const sqlNumber = (value) => (Number.isFinite(value) ? String(value) : "NULL");

// ---------------------------------------------------------------------------
// Notion API
// ---------------------------------------------------------------------------

function readToken() {
  const fromEnv = String(process.env.NOTION_TOKEN ?? "").trim();
  if (fromEnv) return fromEnv;
  if (!existsSync(".dev.vars")) return "";
  for (const line of readFileSync(".dev.vars", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*NOTION_TOKEN\s*=\s*["']?([^"'\s]+)["']?\s*$/);
    if (match) return match[1];
  }
  return "";
}

async function notionRequest(path, token, body) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`https://api.notion.com/v1/${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 429 || response.status >= 500) {
      await sleep(600 * (attempt + 1));
      continue;
    }
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error(`Notion ${response.status}: ${detail}`);
    }
    return response.json();
  }
  throw new Error("Notion не ответил после нескольких попыток.");
}

async function fetchDatabase(databaseId, token) {
  const pages = [];
  let cursor;
  do {
    const payload = await notionRequest(`databases/${databaseId}/query`, token, {
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    pages.push(...(payload.results ?? []));
    cursor = payload.has_more ? payload.next_cursor : undefined;
    // Notion ограничивает частоту: ~3 запроса в секунду.
    if (cursor) await sleep(360);
  } while (cursor);
  return pages;
}

// ---------------------------------------------------------------------------
// Разбор свойств страниц
// ---------------------------------------------------------------------------

const plain = (richText) => (richText ?? []).map((part) => part?.plain_text ?? "").join("").trim();
const property = (page, name) => page?.properties?.[name];

const titleOf = (page, name) => plain(property(page, name)?.title);
const selectOf = (page, name) => (property(page, name)?.select?.name ?? "").trim();
const multiOf = (page, name) =>
  (property(page, name)?.multi_select ?? []).map((item) => String(item?.name ?? "").trim()).filter(Boolean);
const dateRangeOf = (page, name) => {
  const value = property(page, name)?.date;
  return { start: (value?.start ?? "").slice(0, 10), end: (value?.end ?? "").slice(0, 10) };
};
const numberOf = (page, name) => {
  const value = property(page, name)?.number;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};
const relationOf = (page, name) => (property(page, name)?.relation ?? []).map((item) => item?.id).filter(Boolean);

const normalize = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .trim();

const keyOf = (name, extra) => `${normalize(name)}|${extra ?? ""}`;

const TRANSLITERATION = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function slugify(value) {
  return (
    String(value)
      .toLowerCase()
      .split("")
      .map((char) => TRANSLITERATION[char] ?? char)
      .join("")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "sorevnovanie"
  );
}

// ---------------------------------------------------------------------------
// Подготовка базы
// ---------------------------------------------------------------------------

if (!dryRun) {
  runFile(remote ? ["--remote", "--file", "worker/schema.sql", "--yes"] : ["--local", "--file", "worker/schema.sql"]);
  const competitionColumns = new Set(queryJson("PRAGMA table_info(competitions)").map((row) => row.name));
  const migration = [];
  if (!competitionColumns.has("notion_id")) migration.push("ALTER TABLE competitions ADD COLUMN notion_id TEXT;");
  migration.push("CREATE UNIQUE INDEX IF NOT EXISTS idx_competitions_notion ON competitions(notion_id);");
  executeSql(migration, "schema");
}

const today = new Date().toISOString().slice(0, 10);
const statusFor = (start, end) => {
  if (!start || start > today) return "upcoming";
  return (end || start) >= today ? "ongoing" : "finished";
};

// ---------------------------------------------------------------------------
// Чтение источников
// ---------------------------------------------------------------------------

let athletePages = [];
let calendarPages = [];
let resultsPages = [];

if (fromFile) {
  const snapshot = JSON.parse(readFileSync(fromFile, "utf8"));
  athletePages = snapshot.athletes ?? [];
  calendarPages = snapshot.calendar ?? [];
  resultsPages = snapshot.results ?? [];
} else {
  const token = readToken();
  if (!token) {
    console.error(
      "Не найден NOTION_TOKEN. Создайте внутреннюю интеграцию Notion, расшарьте ей базы\n" +
        "«Спортсмены», «Календарь соревнований» и «Результаты» и добавьте строку\n" +
        "NOTION_TOKEN=... в .dev.vars.",
    );
    process.exit(1);
  }
  athletePages = await fetchDatabase(DATABASES.athletes, token);
  calendarPages = await fetchDatabase(DATABASES.calendar, token);
  resultsPages = await fetchDatabase(DATABASES.results, token);
}

// ---------------------------------------------------------------------------
// Сопоставление спортсменов: только чтение, записи в athletes нет
// ---------------------------------------------------------------------------

const existingAthletes = queryRows("SELECT id, full_name, birth_year, notion_id FROM athletes");
const athleteByNotion = new Map(
  existingAthletes.filter((row) => row.notion_id).map((row) => [row.notion_id, row.id]),
);
const athleteByKey = new Map();
const athleteByName = new Map();
for (const row of existingAthletes) {
  if (row.birth_year) {
    const key = keyOf(row.full_name, Number(row.birth_year));
    if (!athleteByKey.has(key)) athleteByKey.set(key, row.id);
  }
  const name = normalize(row.full_name);
  const list = athleteByName.get(name) ?? [];
  list.push(row);
  athleteByName.set(name, list);
}

const athleteIdByPage = new Map();
const athletePageById = new Map(athletePages.map((page) => [page.id, page]));
const athleteStatements = [];
const warnings = [];
const unresolved = new Set();

// Разряд в базе Notion встречается и селектом, и текстом.
function rankOf(page) {
  for (const name of ["Разряд", "Спортивный разряд"]) {
    const prop = property(page, name);
    if (!prop) continue;
    const value =
      String(prop.select?.name ?? "").trim() || plain(prop.rich_text) || plain(prop.title) || "";
    if (value) return value;
  }
  return null;
}

function resolveAthlete(pageId, name, birthDate) {
  if (athleteIdByPage.has(pageId)) return athleteIdByPage.get(pageId);
  let id = athleteByNotion.get(pageId) ?? null;
  const year = birthDate ? Number(birthDate.slice(0, 4)) : null;
  if (!id && name && year) id = athleteByKey.get(keyOf(name, year)) ?? null;
  if (!id && name) {
    // Год рождения в Notion и в книге может расходиться, поэтому единственного
    // тёзку считаем тем же человеком.
    const sameName = athleteByName.get(normalize(name)) ?? [];
    if (sameName.length === 1) id = sameName[0].id;
    else if (sameName.length > 1 && year) {
      const byYear = sameName.filter((row) => Number(row.birth_year) === year);
      if (byYear.length === 1) id = byYear[0].id;
    }
  }
  if (!id && name && noCreateAthletes) {
    const key = normalize(name);
    if (!unresolved.has(key)) {
      unresolved.add(key);
      warnings.push(`в базе сайта нет воспитанника: ${name}${year ? ` ${year}` : ""}`);
    }
    return null;
  }
  if (!id && name) {
    // В книге учащихся такого воспитанника нет, но места в Notion есть:
    // заводим карточку по публичным полям — имя, год рождения, разряд.
    const newId = randomUUID();
    const birth = (birthDate ?? "").slice(0, 10);
    const rank = rankOf(athletePageById.get(pageId));
    athleteStatements.push(
      `INSERT INTO athletes (id, full_name, birth_date, birth_year, gender, rating, is_active, sport_rank, notion_id) VALUES (` +
        `${quote(newId)}, ${quote(name)}, ${sqlValue(birth || null)}, ${sqlNumber(year)}, '', 0, 1, ` +
        `${sqlValue(rank)}, ${quote(pageId)});`,
    );
    athleteByNotion.set(pageId, newId);
    if (year) athleteByKey.set(keyOf(name, year), newId);
    const key = normalize(name);
    athleteByName.set(key, [
      ...(athleteByName.get(key) ?? []),
      { id: newId, full_name: name, birth_year: year, notion_id: pageId },
    ]);
    athleteIdByPage.set(pageId, newId);
    stats.athletes_created += 1;
    return newId;
  }
  athleteIdByPage.set(pageId, id);
  return id;
}

// ---------------------------------------------------------------------------
// Календарь соревнований
// ---------------------------------------------------------------------------

const existingCompetitions = queryRows("SELECT id, slug, title, starts_on, notion_id FROM competitions");
const competitionByNotion = new Map(
  existingCompetitions.filter((row) => row.notion_id).map((row) => [row.notion_id, row.id]),
);
const competitionByKey = new Map(
  existingCompetitions.map((row) => [keyOf(row.title, String(row.starts_on ?? "").slice(0, 10)), row.id]),
);
const competitionByTitle = new Map();
for (const row of existingCompetitions) {
  const key = normalize(row.title);
  if (!competitionByTitle.has(key)) competitionByTitle.set(key, row.id);
}
const usedSlugs = new Set(existingCompetitions.map((row) => row.slug));
const competitionIdByNotion = new Map(competitionByNotion);
const competitionOwner = new Map();
for (const [notionId, id] of competitionIdByNotion) competitionOwner.set(id, notionId);
const competitionStatements = [];
const stats = {
  athletes_created: 0,
  competitions_created: 0,
  competitions_updated: 0,
  competitions_skipped: 0,
  results_created: 0,
  results_updated: 0,
  results_without_athlete: 0,
  results_without_competition: 0,
  results_pruned: 0,
  results_duplicates: 0,
};

function uniqueSlug(base) {
  let candidate = base;
  let index = 2;
  while (usedSlugs.has(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }
  usedSlugs.add(candidate);
  return candidate;
}

for (const page of calendarPages) {
  const notionId = page.id;
  const name = titleOf(page, "Вид спорта, наименование спортивного мероприятия");
  if (!name) {
    stats.competitions_skipped += 1;
    continue;
  }
  const range = dateRangeOf(page, "Сроки проведения");
  if (!range.start) {
    stats.competitions_skipped += 1;
    if (warnings.length < 20) warnings.push(`без даты: ${name}`);
    continue;
  }
  const location = selectOf(page, "Место проведения");
  const categories = multiOf(page, "Категория");
  const status = statusFor(range.start, range.end);
  const categoriesJson = JSON.stringify(categories);

  let id = competitionIdByNotion.get(notionId);
  if (!id) id = competitionByKey.get(keyOf(name, range.start));
  if (!id) id = competitionByTitle.get(normalize(name));
  const owner = id ? competitionOwner.get(id) : null;
  if (id && owner && owner !== notionId) id = null;

  if (id) {
    competitionIdByNotion.set(notionId, id);
    competitionOwner.set(id, notionId);
    // Пустые поля в Notion не стирают то, что уже заполнено на сайте.
    const sets = [
      `title = ${quote(name)}`,
      `starts_on = ${quote(range.start)}`,
      `status = ${quote(status)}`,
      `notion_id = ${quote(notionId)}`,
    ];
    if (location) sets.push(`location = ${quote(location)}`);
    if (range.end) sets.push(`ends_on = ${quote(range.end)}`);
    if (categories.length > 0) sets.push(`age_categories = ${quote(categoriesJson)}`);
    sets.push("updated_at = datetime('now')");
    competitionStatements.push(`UPDATE competitions SET ${sets.join(", ")} WHERE id = ${quote(id)};`);
    stats.competitions_updated += 1;
    continue;
  }

  const newId = randomUUID();
  competitionStatements.push(
    `INSERT INTO competitions (id, slug, title, description, location, starts_on, ends_on, age_categories, status, is_demo, is_published, notion_id) VALUES (` +
      `${quote(newId)}, ${quote(uniqueSlug(slugify(name)))}, ${quote(name)}, '', ${quote(location)}, ` +
      `${quote(range.start)}, ${sqlValue(range.end)}, ${quote(categoriesJson)}, ${quote(status)}, 0, 1, ${quote(notionId)});`,
  );
  competitionIdByNotion.set(notionId, newId);
  competitionOwner.set(newId, notionId);
  competitionByKey.set(keyOf(name, range.start), newId);
  if (!competitionByTitle.has(normalize(name))) competitionByTitle.set(normalize(name), newId);
  stats.competitions_created += 1;
}

// ---------------------------------------------------------------------------
// Архив результатов
// ---------------------------------------------------------------------------

// Имена нужны, чтобы понять, кто из спортсменов Notion соответствует записи
// сайта, загруженной из «Книги учащихся».
const athletePageInfo = new Map(
  athletePages.map((page) => [
    page.id,
    { name: titleOf(page, "Фамилия имя"), birth: dateRangeOf(page, "дата рождения").start },
  ]),
);

const existingResults = queryRows("SELECT id, notion_id FROM competition_results", { optional: true });
const resultByNotion = new Map(existingResults.filter((row) => row.notion_id).map((row) => [row.notion_id, row.id]));
const resultStatements = [];
const importedResultIds = [];
// Строки, которые повторяют друг друга полностью (человек, место, категория,
// вид): в Notion такие записи бывают задвоены. Вторую копию не импортируем,
// и она же попадёт в чистку как пропавшая.
const seenResults = new Set();

for (const page of resultsPages) {
  const sourceTitle = titleOf(page, "Соревнования");
  const place = numberOf(page, "Место");
  const ageCategory = selectOf(page, "Категория");
  const eventKind = selectOf(page, "Вид соревнований");
  const city = selectOf(page, "Город") || selectOf(page, "Город ");
  const athletePageIds = relationOf(page, "Спортсмены");
  const competitionPageIds = relationOf(page, "Соревнования ").concat(relationOf(page, "Соревнования"));

  if (athletePageIds.length === 0) {
    stats.results_without_athlete += 1;
    continue;
  }

  let competitionId = null;
  for (const competitionNotionId of competitionPageIds) {
    const local = competitionIdByNotion.get(competitionNotionId);
    if (local) {
      competitionId = local;
      break;
    }
  }
  const heldOn = dateRangeOf(page, "Дата").start;
  if (!competitionId && sourceTitle) {
    competitionId =
      competitionByKey.get(keyOf(sourceTitle, heldOn)) ?? competitionByTitle.get(normalize(sourceTitle)) ?? null;
  }
  if (!competitionId) stats.results_without_competition += 1;

  for (const athletePageId of athletePageIds) {
    const info = athletePageInfo.get(athletePageId) ?? { name: "", birth: "" };
    const athleteId = resolveAthlete(athletePageId, info.name, info.birth);
    if (!athleteId) {
      stats.results_without_athlete += 1;
      continue;
    }
    const notionId = athletePageIds.length === 1 ? page.id : `${page.id}:${athletePageId}`;
    const dedupeKey = [
      competitionId ?? sourceTitle,
      athleteId,
      place ?? "",
      ageCategory ?? "",
      eventKind ?? "",
      heldOn ?? "",
    ].join("|");
    if (seenResults.has(dedupeKey)) {
      stats.results_duplicates += 1;
      continue;
    }
    seenResults.add(dedupeKey);
    const existingId = resultByNotion.get(notionId);
    const values =
      `competition_id = ${competitionId ? quote(competitionId) : "NULL"}, ` +
      `athlete_id = ${quote(athleteId)}, held_on = ${sqlValue(heldOn)}, place = ${sqlNumber(place)}, ` +
      `age_category = ${sqlValue(ageCategory)}, event_kind = ${sqlValue(eventKind)}, ` +
      `city = ${sqlValue(city)}, source_title = ${quote(sourceTitle)}`;
    if (existingId) {
      resultStatements.push(
        `UPDATE competition_results SET ${values}, updated_at = datetime('now') WHERE notion_id = ${quote(notionId)};`,
      );
      stats.results_updated += 1;
    } else {
      resultStatements.push(
        `INSERT INTO competition_results (id, notion_id, competition_id, athlete_id, held_on, place, age_category, event_kind, city, source_title) VALUES (` +
          `${quote(randomUUID())}, ${quote(notionId)}, ${competitionId ? quote(competitionId) : "NULL"}, ` +
          `${quote(athleteId)}, ${sqlValue(heldOn)}, ${sqlNumber(place)}, ${sqlValue(ageCategory)}, ` +
          `${sqlValue(eventKind)}, ${sqlValue(city)}, ${quote(sourceTitle)});`,
      );
      resultByNotion.set(notionId, notionId);
      stats.results_created += 1;
    }
    importedResultIds.push(notionId);
  }
}

if (!fromFile && !noPrune && importedResultIds.length > 0) {
  const imported = new Set(importedResultIds);
  const stale = existingResults.filter((row) => row.notion_id && !imported.has(row.notion_id));
  if (stale.length > 0) {
    const ids = stale.map((row) => quote(row.notion_id)).join(", ");
    resultStatements.push(`DELETE FROM competition_results WHERE notion_id IN (${ids});`);
  }
  stats.results_pruned = stale.length;
}

// ---------------------------------------------------------------------------
// Запись и отчёт
// ---------------------------------------------------------------------------

if (!dryRun) {
  executeSql([...competitionStatements, ...athleteStatements, ...resultStatements], "import");
}

console.log(`\nNotion → ${remote ? "рабочая" : "локальная"} база${dryRun ? " (dry-run, без записи)" : ""}`);
console.log(
  `Календарь: создано ${stats.competitions_created}, обновлено ${stats.competitions_updated}, ` +
    `пропущено ${stats.competitions_skipped}`,
);
console.log(
  `Результаты: создано ${stats.results_created}, обновлено ${stats.results_updated}, ` +
    `без спортсмена ${stats.results_without_athlete}, без соревнования ${stats.results_without_competition}` +
    `${stats.results_pruned > 0 ? `, удалено пропавших ${stats.results_pruned}` : ""}` +
    `${stats.results_duplicates > 0 ? `, пропущено дублей ${stats.results_duplicates}` : ""}`,
);
if (stats.athletes_created > 0) {
  console.log(`Спортсмены: создано ${stats.athletes_created} карточек — их нет в книге учащихся, но места в Notion есть.`);
}
if (warnings.length > 0) {
  console.log("\nТребуют внимания:");
  for (const warning of warnings.slice(0, 20)) console.log(`  - ${warning}`);
}
if (dryRun) console.log("\nSQL не применялся.");
