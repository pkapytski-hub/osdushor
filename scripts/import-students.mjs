#!/usr/bin/env node
/**
 * Импорт воспитанников из «КНИГИ УЧАЩИХСЯ» (xlsx) в базу сайта.
 *
 *   node scripts/import-students.mjs                  # локальная база
 *   node scripts/import-students.mjs --remote         # рабочая база на Cloudflare
 *   node scripts/import-students.mjs --dry-run        # только разбор файла и отчёт
 *   node scripts/import-students.mjs --file=путь.xlsx # файл вне папки проекта
 *
 * В базу попадают только имя, дата и год рождения, пол, разряд, группа и
 * тренер. Телефоны, адреса, приказы и медицинские справки не читаются вовсе.
 * xlsx разбирается встроенными средствами Node: ZIP — через zlib, лист —
 * обычным XML, без сторонних библиотек. Повторный запуск обновляет записи по
 * ФИО и дате рождения, поэтому дублей не появляется.
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const argList = process.argv.slice(2);
const hasFlag = (name) => argList.includes(`--${name}`);
const option = (name) => {
  const prefix = `--${name}=`;
  const found = argList.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
};

const remote = hasFlag("remote");
const dryRun = hasFlag("dry-run");
const DB_NAME = "osdushor-db";
const WRANGLER_CLI = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));

// ---------------------------------------------------------------------------
// Чтение xlsx
// ---------------------------------------------------------------------------

// xlsx — это обычный ZIP. Читаем центральный каталог и распаковываем нужные
// части через zlib: так скрипт обходится без сторонних библиотек.
function readZip(buffer) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 66_000); i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Файл не похож на xlsx: не найден конец ZIP-архива.");
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("Повреждён центральный каталог ZIP.");
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buffer.subarray(start, start + compressedSize);
    files.set(name, method === 0 ? raw : inflateRawSync(raw));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

const decodeXml = (value) =>
  String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const columnIndex = (letters) =>
  [...letters].reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1;

function parseSharedStrings(xml) {
  const list = [];
  for (const match of String(xml ?? "").matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    list.push(decodeXml([...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => part[1]).join("")));
  }
  return list;
}

function parseSheet(xml, shared) {
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cellMatch[1] ?? "";
      const inner = cellMatch[2] ?? "";
      const ref = /\br="([A-Z]+)\d+"/.exec(attrs);
      if (!ref) continue;
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1] ?? "";
      let value = "";
      if (type === "inlineStr") {
        value = decodeXml([...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => part[1]).join(""));
      } else {
        const raw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? "";
        value = type === "s" ? shared[Number(raw)] ?? "" : decodeXml(raw);
      }
      cells[columnIndex(ref[1])] = String(value).trim();
    }
    rows.push(cells);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Разбор таблицы
// ---------------------------------------------------------------------------

const HEADERS = {
  name: /фамил/i,
  birth: /дата\s*рождения/i,
  rank: /^разряд$/i,
  group: /^группа/i,
  coach: /тренер/i,
  gender: /^пол$/i,
};

// Порядок столбцов в книге: №, пол, ФИО, дата рождения, дата, возраст,
// учебное заведение, договор, медсправки (2), адрес, телефон, год поступления,
// приказ о разрядах, разряд, приказ о зачислении, группа, ФИО тренера.
const FALLBACK = { name: 2, birth: 3, rank: 14, group: 16, coach: 17, gender: 1 };

function findColumns(row) {
  const find = (pattern) => row.findIndex((cell) => pattern.test(String(cell ?? "").trim()));
  const name = find(HEADERS.name);
  if (name === -1) return null;
  const pick = (pattern, fallback) => {
    const index = find(pattern);
    return index === -1 ? fallback : index;
  };
  return {
    name,
    birth: pick(HEADERS.birth, FALLBACK.birth),
    rank: pick(HEADERS.rank, FALLBACK.rank),
    group: pick(HEADERS.group, FALLBACK.group),
    coach: pick(HEADERS.coach, FALLBACK.coach),
    gender: pick(HEADERS.gender, FALLBACK.gender),
  };
}

const pad = (value) => String(value).padStart(2, "0");

// В xlsx дата — число дней от 30.12.1899, но встречаются и текстовые даты.
function parseDate(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const serial = Number(text.replace(",", "."));
  if (Number.isFinite(serial) && serial > 1000 && serial < 80_000) {
    const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dotted = text.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/);
  if (dotted) {
    const year = dotted[3].length === 2 ? `20${dotted[3]}` : dotted[3];
    return `${year}-${pad(dotted[2])}-${pad(dotted[1])}`;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

// В книге встречаются пометки вроде «Микшута Богдан до 08.12.2026».
const cleanName = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+до\s+\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}\s*$/i, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();

const normalize = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .trim();

const genderOf = (value) => {
  const text = normalize(value);
  if (text === "м" || text === "m" || text === "муж" || text === "мужской") return "m";
  if (text === "ж" || text === "f" || text === "жен" || text === "женский") return "f";
  return "";
};

const rankOf = (value) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  const key = text.toLowerCase().replace(/\./g, "");
  if (key === "мс") return "МС";
  if (key === "кмс") return "КМС";
  return text;
};

const textOf = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------------------
// Чтение книги
// ---------------------------------------------------------------------------

function findWorkbookFile() {
  const fromOption = option("file");
  if (fromOption) return fromOption;
  const candidates = readdirSync(".").filter(
    (name) => /\.xlsx$/i.test(name) && !name.startsWith("~$"),
  );
  const book = candidates.find((name) => /книг|учащ/i.test(name));
  if (book) return book;
  if (candidates.length === 1) return candidates[0];
  throw new Error(
    "Не найден файл книги. Положите xlsx в папку проекта или укажите путь: --file=\"путь.xlsx\".",
  );
}

function readStudents(path) {
  const files = readZip(readFileSync(path));
  const shared = parseSharedStrings(files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "");
  const sheets = [...files.keys()]
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/(\d+)/)[1]) - Number(b.match(/(\d+)/)[1]));
  if (sheets.length === 0) throw new Error("В книге не найдено ни одного листа.");

  const students = [];
  const warnings = [];
  const seen = new Set();

  for (const sheetPath of sheets) {
    const rows = parseSheet(files.get(sheetPath).toString("utf8"), shared);
    const headerIndex = rows.findIndex((row) => findColumns(row) !== null);
    if (headerIndex === -1) continue;
    const columns = findColumns(rows[headerIndex]);

    for (const row of rows.slice(headerIndex + 1)) {
      const name = cleanName(row[columns.name]);
      // Строки «№ 1 СПС …» — заголовки групп, повторные шапки, примечания вида
      // «По состоянию на 01.10.2026» и пустые строки в базу не попадают.
      if (!name || /^№/.test(name) || /^фамил/i.test(name)) continue;
      if (/[0-9]/.test(name) || /^(по состоянию|итого|всего)\b/i.test(name)) continue;
      if (name.split(/\s+/).length < 2) continue;
      const birthDate = parseDate(row[columns.birth]);
      const key = `${normalize(name)}|${birthDate}`;
      if (seen.has(key)) {
        warnings.push(`повтор в книге: ${name}${birthDate ? ` (${birthDate})` : ""}`);
        continue;
      }
      seen.add(key);
      if (!birthDate) warnings.push(`без даты рождения: ${name}`);
      students.push({
        full_name: name,
        birth_date: birthDate,
        birth_year: birthDate ? Number(birthDate.slice(0, 4)) : null,
        gender: genderOf(row[columns.gender]),
        sport_rank: rankOf(row[columns.rank]),
        group_name: textOf(row[columns.group]),
        coach: textOf(row[columns.coach]),
      });
    }
  }
  return { students, warnings, sheets: sheets.length };
}

// ---------------------------------------------------------------------------
// Запись в базу
// ---------------------------------------------------------------------------

const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;
const sqlValue = (value) => (value === null || value === undefined || value === "" ? "NULL" : quote(value));
const sqlNumber = (value) => (Number.isFinite(value) ? String(value) : "NULL");

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

function tableColumns(table) {
  try {
    return new Set(queryJson(`PRAGMA table_info(${table})`).map((row) => row.name));
  } catch {
    return new Set();
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
  const dir = mkdtempSync(join(tmpdir(), "osdushor-students-"));
  const path = join(dir, `${label}.sql`);
  writeFileSync(path, `${statements.join("\n")}\n`, "utf8");
  runFile(remote ? ["--remote", "--file", path, "--yes"] : ["--local", "--file", path]);
}

const bookPath = findWorkbookFile();
if (!existsSync(bookPath)) throw new Error(`Файл не найден: ${bookPath}`);
const { students, warnings, sheets } = readStudents(bookPath);

if (students.length === 0) throw new Error("В книге не найдено ни одной строки спортсмена.");

if (dryRun) {
  console.log(`Разобрано строк: ${students.length} (листов: ${sheets})`);
  for (const student of students) {
    console.log(
      `  ${student.full_name} — ${student.birth_date || "дата не указана"} · ` +
        `${student.sport_rank || "разряд не указан"} · ${student.group_name || "без группы"}`,
    );
  }
  if (warnings.length > 0) {
    console.log("\nТребуют внимания:");
    for (const warning of warnings) console.log(`  - ${warning}`);
  }
  console.log("\nSQL не применялся.");
  process.exit(0);
}

// Схема и колонка с полной датой рождения (на уже развёрнутой базе её нет).
runFile(remote ? ["--remote", "--file", "worker/schema.sql", "--yes"] : ["--local", "--file", "worker/schema.sql"]);
const columns = tableColumns("athletes");
const migration = [];
if (!columns.has("birth_date")) migration.push("ALTER TABLE athletes ADD COLUMN birth_date TEXT;");
executeSql(migration, "schema");

const hasBirthDate = columns.has("birth_date") || migration.length > 0;
const existing = queryJson(
  `SELECT id, full_name, birth_year${hasBirthDate ? ", birth_date" : ""} FROM athletes`,
);

const byKey = new Map();
const byName = new Map();
for (const row of existing) {
  const name = normalize(row.full_name);
  if (row.birth_date) byKey.set(`${name}|${row.birth_date}`, row.id);
  if (row.birth_year) byKey.set(`${name}|${Number(row.birth_year)}`, row.id);
  const list = byName.get(name) ?? [];
  list.push(row);
  byName.set(name, list);
}

const used = new Set();
const statements = [];
const stats = { created: 0, updated: 0, duplicate: 0 };

for (const student of students) {
  const name = normalize(student.full_name);
  let id = (student.birth_date && byKey.get(`${name}|${student.birth_date}`)) ||
    (student.birth_year && byKey.get(`${name}|${student.birth_year}`)) ||
    null;

  if (!id) {
    // Единственный тёзка в базе — тот же человек: год в книге мог уточниться.
    const sameName = (byName.get(name) ?? []).filter((row) => !used.has(row.id));
    if (sameName.length === 1) id = sameName[0].id;
  }

  if (id && used.has(id)) {
    stats.duplicate += 1;
    warnings.push(`дубль строки: ${student.full_name}`);
    continue;
  }

  if (id) {
    used.add(id);
    statements.push(
      `UPDATE athletes SET full_name = ${quote(student.full_name)}, ` +
        `birth_date = ${sqlValue(student.birth_date)}, birth_year = ${sqlNumber(student.birth_year)}, ` +
        `gender = ${quote(student.gender)}, sport_rank = ${sqlValue(student.sport_rank)}, ` +
        `group_name = ${sqlValue(student.group_name)}, coach = ${sqlValue(student.coach)}, ` +
        `updated_at = datetime('now') WHERE id = ${quote(id)};`,
    );
    stats.updated += 1;
    continue;
  }

  const newId = randomUUID();
  used.add(newId);
  if (student.birth_date) byKey.set(`${name}|${student.birth_date}`, newId);
  statements.push(
    `INSERT INTO athletes (id, full_name, birth_date, birth_year, gender, rating, is_active, sport_rank, group_name, coach) VALUES (` +
      `${quote(newId)}, ${quote(student.full_name)}, ${sqlValue(student.birth_date)}, ${sqlNumber(student.birth_year)}, ` +
      `${quote(student.gender)}, 0, 1, ${sqlValue(student.sport_rank)}, ${sqlValue(student.group_name)}, ${sqlValue(student.coach)});`,
  );
  stats.created += 1;
}

executeSql(statements, "import");

console.log(`\nКНИГА УЧАЩИХСЯ → ${remote ? "рабочая" : "локальная"} база`);
console.log(`В файле: ${students.length} спортсменов (листов: ${sheets})`);
console.log(`Создано: ${stats.created}, обновлено: ${stats.updated}, дублей в файле пропущено: ${stats.duplicate}`);
if (warnings.length > 0) {
  console.log("\nТребуют внимания:");
  for (const warning of warnings) console.log(`  - ${warning}`);
}
