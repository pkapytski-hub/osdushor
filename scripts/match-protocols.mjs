#!/usr/bin/env node
/**
 * Отчёт «папка протоколов → соревнование календаря». Ничего не пишет.
 *
 *   node scripts/match-protocols.mjs                 # все папки protocols/
 *   node scripts/match-protocols.mjs --year=2023     # только один год
 *   node scripts/match-protocols.mjs --save          # записать карту в scripts/protocol-map.json
 *   node scripts/match-protocols.mjs --verbose       # показать и пары из карты
 *
 * Папки из карты берут готовый slug и не сравниваются заново. Эвристика
 * работает только для новых папок; если пары нет — так и пишет.
 *
 * Сначала пробуем точную дату из имени папки. Если на дату ничего нет или
 * соревнований несколько — ищем по названию: сокращение в имени папки
 * (ПГО, ПРБ, КПРБ, КЧРБ, ЛЧРБ, ОДМ, РТСИ, ОСДЮШОР, «Кубок Надежд»,
 * фамилии турниров) сверяется с полным названием, плюс совпадение года
 * рождения и близость даты. Уверенность печатается, чтобы спорные пары
 * можно было проверить глазами.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { MAP_PATH, readMap, writeMap } from "./lib/protocol-map.mjs";
import { readSheets } from "./lib/xlsx.mjs";

const argList = process.argv.slice(2);
const hasFlag = (name) => argList.includes(`--${name}`);
const option = (name) => argList.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1] ?? null;
const yearFilter = option("year");
const save = hasFlag("save");
const map = readMap();
const WRANGLER_CLI = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));

const output = spawnSync(
  process.execPath,
  [WRANGLER_CLI, "d1", "execute", "osdushor-db", "--remote", "--json", "--command", "SELECT id, slug, starts_on, title FROM competitions"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
);
if (output.status !== 0) throw new Error("Не удалось прочитать календарь.");
const raw = output.stdout;
const competitions = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1))[0].results;

/** Вид соревнования по сокращению в папке или по полному названию. */
const KINDS = [
  ["первенство гродненской области", /пго|первенство гродненской/i],
  ["первенство республики беларусь", /прб|первенство республики/i],
  ["командное первенство республики беларусь", /кпрб|командное первенство/i],
  ["командный чемпионат республики беларусь", /кчрб|командный чемпионат/i],
  ["личный чемпионат республики беларусь", /лчрб|личный\s+чемпионат/i],
  ["чемпионат гродненской области", /чго|чемпионат гродненской/i],
  ["олимпийские дни молодёжи", /одм|олимпийские дни/i],
  ["турнир сильнейших", /ортси|ртси|турнир сильнейших/i],
  ["спартакиада дюсш", /дюсш|детско-юношеских\s+спортивных\s+школ/i],
  ["спартакиада школьников", /спартакиада школьников/i],
  ["первенство осдюшор", /осдюшор/i],
  ["кубок надежд", /кубок надежд/i],
  ["кубок области", /кубок области|кубок гродненской/i],
  ["суперфинал", /суперфинал/i],
  ["памяти культиясова", /культиясов/i],
  ["памяти никитина", /никитин/i],
  ["памяти шкалы", /шкал(а|ы)/i],
  ["барановичи", /баранович/i],
  ["ефремовой", /ефремов/i],
  ["хасиной", /хасин/i],
  ["смена", /смена/i],
];

// В календаре встречаются названия с длинными сериями пробелов.
const flat = (text) => String(text).replace(/\s+/g, " ").trim();
const kindsOf = (text) => KINDS.filter(([, re]) => re.test(flat(text))).map(([kind]) => kind);
const yearsOf = (text) => new Set(String(text).match(/\b20\d{2}\b/g) ?? []);
// Год в начале имени папки — это дата турнира, а не год рождения участников.
const birthYears = (name) => yearsOf(name.replace(/^\d{4}[.\-]\d{2}[.\-]\d{2}(?:[-\d]*)?/, ""));
/** Вид турнира в папке не противоречит названию в календаре. */
const sameKind = (text, competition) => {
  const folderKinds = kindsOf(text);
  return folderKinds.length === 0 || folderKinds.some((kind) => kindsOf(competition.title).includes(kind));
};
const dateOf = (text) => {
  const found = /(\d{4})\.(\d{2})\.(\d{2})/.exec(text);
  return found ? `${found[1]}-${found[2]}-${found[3]}` : "";
};
const daysBetween = (a, b) => Math.abs(new Date(a) - new Date(b)) / 86400000;

function score(folder, competition) {
  const folderKinds = kindsOf(folder);
  const titleKinds = kindsOf(competition.title);
  let value = 0;
  if (folderKinds.some((kind) => titleKinds.includes(kind))) value += 6;
  const folderYears = birthYears(flat(folder));
  const titleYears = yearsOf(competition.title);
  value += 3 * [...folderYears].filter((year) => titleYears.has(year)).length;
  const date = dateOf(folder);
  if (date) {
    const gap = daysBetween(date, String(competition.starts_on).slice(0, 10));
    // Точная дата сильнее любого совпадения слов — она и различает туры.
    value += gap <= 1 ? 8 : gap <= 7 ? 3 : gap <= 21 ? 2 : gap <= 45 ? 1 : 0;
  }
  return value;
}

/**
 * Название турнира из шапки первого xlsx: в протоколах оно полное,
 * а в имени папки — сокращение вроде «ПГО-2008».
 */
function passportOf(dir) {
  const files = [];
  const walk = (path) => {
    for (const name of readdirSync(path)) {
      const full = join(path, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.xlsx$/i.test(name) && !name.startsWith("~$")) files.push(full);
    }
  };
  walk(dir);
  for (const file of files) {
    try {
      const lines = readSheets(file)
        .flatMap((sheet) => sheet.rows.map((row) => row.map((cell) => String(cell ?? "").trim())))
        .map((row) => row.filter(Boolean).join(" ").replace(/\s+/g, " ").trim())
        .filter(Boolean);
      const skip = /^(протокол|таблица|список|групп|финал|итог|дата\b|№|директор|управление|усу\b|главный)/i;
      const title = lines
        .slice(0, 8)
        .filter((line) => line.length > 12 && !skip.test(line))
        .slice(0, 2)
        .join(" ");
      if (title) return title.slice(0, 180);
    } catch {
      // Битый файл не должен ломать отчёт — переходим к следующему.
    }
  }
  return "";
}

const folders = readdirSync("protocols")
  .filter((name) => statSync(join("protocols", name)).isDirectory())
  .filter((name) => !yearFilter || name.startsWith(`${yearFilter}.`));

const rows = [];
for (const name of folders) {
  const date = dateOf(name);

  const mappedSlug = map[name];
  if (mappedSlug) {
    const row = competitions.find((item) => item.slug === mappedSlug);
    rows.push({ name, date, passport: "", pick: row ?? null, how: row ? "карта" : "карта: нет в календаре", alternatives: [] });
    continue;
  }

  // Дальше — только новые папки: читаем шапку протокола и сравниваем с календарём.
  const passport = passportOf(join("protocols", name));
  const text = passport ? `${name} ${passport}` : name;

  const sameDate = competitions.filter((row) => String(row.starts_on).slice(0, 10) === date);
  // На одну дату могут стоять два разных турнира — тогда решает название.
  if (sameDate.length === 1 && sameKind(text, sameDate[0])) {
    rows.push({ name, date, passport, pick: sameDate[0], how: "дата", alternatives: [] });
    continue;
  }
  const year = date.slice(0, 4);
  const pool = competitions.filter((row) => String(row.starts_on).startsWith(year));
  const scored = pool
    .map((row) => ({ row, value: score(text, row) }))
    .sort(
      (a, b) =>
        b.value - a.value ||
        daysBetween(date, String(a.row.starts_on).slice(0, 10)) - daysBetween(date, String(b.row.starts_on).slice(0, 10)),
    );
  const best = scored[0];
  const runnerUp = scored[1];
  // Если ближайшее соревнование в календаре дальше полутора месяцев —
  // это уже другой турнир, даже если вид и годы совпали.
  const found = Boolean(best && best.value >= 5 && daysBetween(date, String(best.row.starts_on).slice(0, 10)) <= 45);
  // Дата и год рождения — то, что видно в имени папки; если они расходятся
  // с календарём, пару показываем, но помечаем для проверки.
  const gap = best ? daysBetween(date, String(best.row.starts_on).slice(0, 10)) : 0;
  const folderYears = birthYears(text);
  const titleYears = best ? yearsOf(best.row.title) : new Set();
  const yearsOk =
    folderYears.size === 0 || titleYears.size === 0 || [...folderYears].some((year) => titleYears.has(year));
  const confident =
    found && best.value >= 7 && gap <= 14 && yearsOk && (!runnerUp || best.value - runnerUp.value >= 3);
  rows.push({
    name,
    date,
    passport,
    pick: found ? best.row : null,
    how: !found ? "не найдено" : sameDate.length > 1 ? "название (дата занята)" : confident ? "название" : "проверить",
    alternatives: scored.slice(1, 3).filter((item) => item.value > 0).map((item) => `${String(item.row.starts_on).slice(0, 10)} ${item.row.title.slice(0, 70)}`),
  });
}

const byHow = (how) => rows.filter((row) => row.how.startsWith(how));
const TITLES = {
  "карта": "из карты",
  "дата": "по дате (новые)",
  "название": "по названию (новые)",
  "проверить": "требует проверки",
  "карта: нет в календаре": "карта ведёт на несуществующее соревнование",
  "не найдено": "новые папки без пары",
};
for (const how of ["карта", "дата", "название", "проверить", "карта: нет в календаре", "не найдено"]) {
  const list = byHow(how);
  if (list.length === 0) continue;
  if (how === "карта" && !hasFlag("verbose")) continue;
  console.log(`\n=== ${TITLES[how]} (${list.length}) ===`);
  for (const row of list) {
    console.log(`${row.name}`);
    if (row.passport) console.log(`  в протоколе: ${row.passport.slice(0, 120)}`);
    console.log(`  → ${row.pick ? `${String(row.pick.starts_on).slice(0, 10)} · ${row.pick.title.replace(/\s+/g, " ").slice(0, 100)}` : "не найдено"}`);
    if (row.alternatives?.length) console.log(`     ещё: ${row.alternatives.join(" | ")}`);
  }
}
console.log(
  `\nВсего папок: ${rows.length} · найдено: ${rows.filter((row) => row.pick).length}` +
    ` · из карты: ${byHow("карта").length} · по дате: ${byHow("дата").length}` +
    ` · по названию: ${byHow("название").length} · проверить: ${byHow("проверить").length}` +
    ` · нет пары: ${byHow("не найдено").length + byHow("карта: нет в календаре").length}`,
);

if (save) {
  const next = { ...map };
  for (const row of rows) {
    if (row.pick && (row.how.startsWith("дата") || row.how.startsWith("название"))) next[row.name] = row.pick.slug;
  }
  console.log(`\nКарта сохранена: ${MAP_PATH} · записей ${writeMap(next)}`);
  const pending = rows.filter((row) => row.how === "проверить");
  if (pending.length > 0) {
    console.log(`Не сохранено (требует проверки, ${pending.length}): ${pending.map((row) => row.name).join(", ")}`);
  }
}
