#!/usr/bin/env node
/**
 * Импорт личных встреч из протоколов (xlsx): соперник, его город, год рождения,
 * разряд и результат встречи. Эти данные дополняют место в карточке спортсмена.
 *
 *   node scripts/import-matches.mjs                      # папка protocols/, только отчёт
 *   node scripts/import-matches.mjs --write              # записать в рабочую базу
 *   node scripts/import-matches.mjs "protocols/2026.01.31 ЛЧГО"
 *   node scripts/import-matches.mjs --local              # сверяться с локальной базой
 *   node scripts/import-matches.mjs --competition=<id|slug>
 *   node scripts/import-matches.mjs --verbose            # печатать каждую встречу
 *
 * Что читается: сетки предварительного этапа — блок, где в заголовке столбцов
 * стоят номера участников 1…N, строки заняты участниками, а в столбце соперника
 * «2» означает победу и «1» — поражение. Счёт по сетам лежит в следующей строке
 * блока. Такая сетка есть и в листах «Группы…», и в листах «муж группы»,
 * «юн гр», «тур 1» и подобных.
 *
 * Соперник ищется в списке участников того же файла: оттуда берутся город,
 * год рождения и разряд. Если списка нет — город и год остаются из сетки.
 *
 * В базу попадают только встречи воспитанников школы: остальные участники
 * нужны лишь как соперники. Повторный запуск обновляет те же строки (ключ
 * импорта лежит в notion_id), поэтому дублей не появляется.
 *
 * Без флага --write ничего не записывается: печатается разбор и отчёт.
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readSheets } from "./lib/xlsx.mjs";

const argList = process.argv.slice(2);
const hasFlag = (name) => argList.includes(`--${name}`);
const option = (name) => {
  const prefix = `--${name}=`;
  const found = argList.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
};
const positional = argList.filter((arg) => !arg.startsWith("--"));

const remote = !hasFlag("local");
const dryRun = !hasFlag("write") && !hasFlag("remote");
const verbose = hasFlag("verbose");
const DB_NAME = "osdushor-db";
const WRANGLER_CLI = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));

// ---------------------------------------------------------------------------
// Имена и даты
// ---------------------------------------------------------------------------

// Фамилия и имя (или инициал с точкой): «Шульга Татьяна», «Маргина М.»
const NAME = /^[A-Za-zА-Яа-яЁёІіЇїЄє][A-Za-zА-Яа-яЁёІіЇїЄє'.-]+(\s+[A-Za-zА-Яа-яЁёІіЇїЄє][A-Za-zА-Яа-яЁёІіЇїЄє'.-]*\.?)+$/;
const HEADER_TITLE = /Групп|Тур\b|этап|разряд/i;
const SECTION = /СПИСОК|Главный|Секретарь/i;
// Служебные подписи бланка, которые тоже выглядят как «Фамилия Имя».
const SERVICE = /Фамилия|Имя\b|подпис|Победител|Команда|пара/i;

const cleanName = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s*\*+$/, "")
    .trim();

const normalize = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9іїє]+/gi, " ")
    .trim();

const slug = (value) => normalize(value).replace(/\s+/g, "-");

const genderOf = (text) =>
  /девуш|женщин/i.test(String(text ?? "")) ? "f" : /юнош|мужчин/i.test(String(text ?? "")) ? "m" : "";

const dateFromText = (value) => {
  const match = /\b(20\d\d)[.\-/\\ ](\d{1,2})[.\-/\\ ](\d{1,2})\b/.exec(String(value ?? ""));
  if (!match) return "";
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
};

// ---------------------------------------------------------------------------
// Чтение файлов
// ---------------------------------------------------------------------------

function collectFiles(targets) {
  const files = [];
  for (const target of targets) {
    if (!existsSync(target)) continue;
    const info = statSync(target);
    if (info.isFile()) {
      if (/\.xlsx$/i.test(target)) files.push(target);
      continue;
    }
    for (const entry of readdirSync(target)) {
      if (entry.startsWith("~$")) continue;
      files.push(...collectFiles([join(target, entry)]));
    }
  }
  return files.sort();
}

/** Столбцы заголовка сетки: номера участников 1…N с равным шагом между столбцами. */
function headerColumns(row) {
  const cells = [];
  (row ?? []).forEach((cell, col) => {
    const text = String(cell ?? "").trim().replace(/^(-?\d+)\.0+$/, "$1");
    if (!/^\d{1,2}$/.test(text)) return;
    cells.push({ col, value: Number(text) });
  });
  if (cells.length < 2) return null;
  let best = null;
  for (const step of [3, 2, 4]) {
    for (let start = 0; start < cells.length; start += 1) {
      if (cells[start].value !== 1) continue;
      const sequence = [cells[start]];
      for (let index = start + 1; index < cells.length; index += 1) {
        const last = sequence[sequence.length - 1];
        if (cells[index].col === last.col + step && cells[index].value === sequence.length + 1) {
          sequence.push(cells[index]);
        }
      }
      if (!best || sequence.length > best.length) best = sequence;
    }
  }
  return best && best.length >= 2 ? best.map((cell) => cell.col) : null;
}

// Числа Excel приходят как «1.0»: в сетке это просто «1».
const cell = (rows, row, col) => String(rows[row]?.[col] ?? "").trim().replace(/^(-?\d+)\.0+$/, "$1");

/** Заголовок сетки подтверждается значениями «1»/«2» в столбцах счёта под ним. */
function scoreHeader(rows, head, cols) {
  let hits = 0;
  for (let row = head + 1; row < Math.min(rows.length, head + 2 * cols.length + 2); row += 1) {
    for (const col of cols) {
      if (cell(rows, row, col + 1) === "1" || cell(rows, row, col + 1) === "2") hits += 1;
    }
  }
  return hits >= cols.length;
}

/** Счёт по сетам «3 - 1» → [3, 1]; списки вида «6,9,10» — разница мячей, не счёт. */
const setScore = (text) => {
  const match = /^(\d)\s*[-–—:]\s*(\d)$/.exec(String(text ?? "").trim());
  return match ? [Number(match[1]), Number(match[2])] : null;
};

/**
 * Сетки предварительного этапа в листе: блоки с заголовком «1 2 3 … N».
 * Возвращает участников и встречи; встречи описаны номером строки участника,
 * поэтому пара находится и по «2», и по зеркальному «1».
 */
function readGroups(sheet) {
  const rows = sheet.rows;
  // В командном протоколе сетки нет: там встречаются игроки разных команд,
  // а «2»/«1» — счёт команды, а не личная победа.
  if (rows.slice(0, 10).some((row) => (row ?? []).some((value) => /КОМАНДН/i.test(String(value ?? ""))))) return [];
  const heads = [];
  for (let row = 0; row < rows.length; row += 1) {
    const cols = headerColumns(rows[row]);
    if (cols && scoreHeader(rows, row, cols)) heads.push({ row, cols });
  }
  const blocks = [];
  for (let index = 0; index < heads.length; index += 1) {
    const { row: head, cols } = heads[index];
    const stop = heads[index + 1]?.row ?? rows.length;
    const limit = Math.min(stop, head + 2 * (cols.length + 2));
    let end = limit;
    for (let row = head + 1; row < limit; row += 1) {
      if (HEADER_TITLE.test(cell(rows, row, 0)) && /Групп/i.test(cell(rows, row, 0))) {
        end = row;
        break;
      }
    }
    // Столбец с фамилиями — тот, где их больше всего; столбцы счёта исключаем.
    const skip = new Set(cols.flatMap((col) => [col, col + 1]));
    let nameCol = -1;
    let bestCount = 0;
    for (let col = 0; col < 30; col += 1) {
      if (skip.has(col)) continue;
      let count = 0;
      for (let row = head + 1; row < end; row += 1) {
        if (NAME.test(cleanName(cell(rows, row, col)))) count += 1;
      }
      if (count > bestCount) {
        bestCount = count;
        nameCol = col;
      }
    }
    if (nameCol < 0 || bestCount < 2) continue;
    const players = [];
    let pairs = 0;
    for (let row = head + 1; row < end; row += 1) {
      const name = cleanName(cell(rows, row, nameCol));
      const neighbour = cleanName(cell(rows, row, nameCol + 1));
      // Построчный протокол встреч («Иванов А. | Петров Б.» в одной строке)
      // не сетка: там каждый ряд — отдельная встреча, а не участник.
      if (NAME.test(neighbour) && !SERVICE.test(neighbour)) pairs += 1;
      if (!NAME.test(name) || SERVICE.test(name)) continue;
      players.push({ row, name });
    }
    let stage = "";
    for (let row = head - 1; row >= Math.max(0, head - 12) && !stage; row -= 1) {
      const text = (rows[row] ?? []).map((value) => String(value ?? "")).find((value) => HEADER_TITLE.test(value));
      if (text) stage = cleanName(text);
    }
    if (!stage) stage = sheet.title;
    // Читаем только групповой этап: командные протоколы и пары дают ложные
    // «сетки», где соперник — подпись бланка или название команды.
    if (players.length < 2 || pairs * 2 >= players.length) continue;
    const context = `${stage} ${sheet.title}`;
    if (!/груп|гр(?![а-яё])|финал/i.test(context) || /команд/i.test(context)) continue;
    const gender = genderOf(stage) || genderOf(sheet.title);
    // Соперник i-го участника — столбец с его номером: в строке участника
    // «2» за победу и «1» за поражение, строкой ниже — счёт по сетам.
    const matches = [];
    for (let a = 0; a < players.length; a += 1) {
      for (let b = a + 1; b < players.length; b += 1) {
        if (b >= cols.length) break;
        const pointsA = cell(rows, players[a].row, cols[b] + 1);
        const pointsB = cell(rows, players[b].row, cols[a] + 1);
        let winner = "";
        if (pointsA === "2" || pointsB === "1") winner = "a";
        else if (pointsA === "1" || pointsB === "2") winner = "b";
        if (!winner) continue;
        const nextA = players[a + 1]?.row ?? end;
        const nextB = players[b + 1]?.row ?? end;
        let score = null;
        if (players[a].row + 1 < nextA) score = setScore(cell(rows, players[a].row + 1, cols[b]));
        if (!score && players[b].row + 1 < nextB) {
          const mirrored = setScore(cell(rows, players[b].row + 1, cols[a]));
          if (mirrored) score = [mirrored[1], mirrored[0]];
        }
        matches.push({ a, b, winner, score });
      }
    }
    if (matches.length > 0) {
      blocks.push({ stage: stage || sheet.title, gender, players, matches, cityCol: nameCol + 3 });
    }
  }
  return blocks;
}

/** Участники и их карточки из листов «Список участников». */
function readRoster(sheets) {
  const roster = new Map();
  for (const sheet of sheets) {
    const rows = sheet.rows;
    for (let head = 0; head < rows.length; head += 1) {
      const header = rows[head] ?? [];
      const nameCol = header.findIndex((value) => /ФАМИЛИЯ/i.test(String(value ?? "")));
      if (nameCol < 0) continue;
      const yearCol = header.findIndex((value) => /Год|Дата/i.test(String(value ?? "")));
      const rankCol = header.findIndex((value) => /Разр/i.test(String(value ?? "")));
      const cityCol = header.findIndex((value) => /Город|Территория/i.test(String(value ?? "")));
      for (let row = head + 1; row < rows.length; row += 1) {
        const first = (rows[row] ?? []).map((value) => String(value ?? "")).find(Boolean) ?? "";
        if (SECTION.test(first)) break;
        const name = cleanName(cell(rows, row, nameCol));
        if (!NAME.test(name) || SERVICE.test(name)) continue;
        const year = Number.parseInt(cell(rows, row, yearCol), 10);
        const rank = rankCol >= 0 ? cell(rows, row, rankCol) : "";
        const city = cityCol >= 0 ? cell(rows, row, cityCol) : "";
        roster.set(normalize(name), {
          city: /^\D/.test(city) ? city : "",
          birthYear: Number.isFinite(year) && year > 1900 ? year : null,
          // «0» — не разряд, а незаполненная ячейка рейтинга.
          rank: rank && rank !== "0" ? rank : "",
        });
      }
    }
  }
  return roster;
}

// ---------------------------------------------------------------------------
// База
// ---------------------------------------------------------------------------

const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;
const sqlValue = (value) => (value === null || value === undefined || value === "" ? "NULL" : quote(value));

function wrangler(args, { capture = false } = {}) {
  const result = spawnSync(process.execPath, [WRANGLER_CLI, "d1", "execute", DB_NAME, ...args], {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });
  if (result.status !== 0) throw new Error(`wrangler завершился с кодом ${result.status ?? "?"}`);
  return result.stdout ?? "";
}

/** D1 иногда отвечает 7403 на первый запрос — повторяем пару раз. */
function queryJson(sql) {
  const flag = remote ? "--remote" : "--local";
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const output = wrangler([flag, "--command", sql, "--json"], { capture: true });
      const start = output.indexOf("[");
      const end = output.lastIndexOf("]");
      if (start === -1 || end === -1) throw new Error("Не удалось разобрать ответ wrangler.");
      return JSON.parse(output.slice(start, end + 1))[0]?.results ?? [];
    } catch (error) {
      lastError = error;
      spawnSync(process.execPath, ["-e", "setTimeout(() => {}, 1500)"]);
    }
  }
  throw lastError ?? new Error("Запрос к базе не выполнился.");
}

function executeSql(statements) {
  if (statements.length === 0) return;
  const dir = mkdtempSync(join(tmpdir(), "osdushor-matches-"));
  const path = join(dir, "matches.sql");
  writeFileSync(path, `${statements.join("\n")}\n`, "utf8");
  const args = remote ? ["--remote", "--file", path, "--yes"] : ["--local", "--file", path];
  const result = spawnSync(process.execPath, [WRANGLER_CLI, "d1", "execute", DB_NAME, ...args], { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    throw new Error(`wrangler завершился с кодом ${result.status ?? "?"}`);
  }
}

// ---------------------------------------------------------------------------
// Основной проход
// ---------------------------------------------------------------------------

const targets = positional.length > 0 ? positional : ["protocols"];
const files = collectFiles(targets);
if (files.length === 0) throw new Error("В указанных путях нет xlsx-протоколов.");

const explicit = option("competition");
const competitions = queryJson("SELECT id, slug, title, starts_on FROM competitions");
if (explicit) {
  const found = competitions.find((row) => row.id === explicit || row.slug === explicit);
  if (!found) throw new Error(`Соревнование не найдено: ${explicit}`);
}
const byDate = new Map();
for (const row of competitions) {
  byDate.set(row.starts_on, [...(byDate.get(row.starts_on) ?? []), row]);
}

const athletes = queryJson("SELECT id, full_name, gender FROM athletes");
const byFullName = new Map();
const bySurname = new Map();
for (const athlete of athletes) {
  const key = normalize(athlete.full_name);
  byFullName.set(key, [...(byFullName.get(key) ?? []), athlete]);
  const surname = key.split(" ")[0];
  bySurname.set(surname, [...(bySurname.get(surname) ?? []), athlete]);
}

function findAthlete(name, gender) {
  const key = normalize(name);
  const parts = key.split(" ");
  const candidates =
    byFullName.get(key) ??
    bySurname.get(parts[0])?.filter((row) => normalize(row.full_name).split(" ")[1]?.[0] === parts[1]?.[0]) ??
    [];
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) return null;
  const sameGender = gender ? candidates.filter((row) => row.gender === gender) : candidates;
  return sameGender.length === 1 ? sameGender[0] : null;
}

const athleteNames = new Map(athletes.map((row) => [row.id, row.full_name]));

const existing = new Set(
  queryJson("SELECT notion_id FROM competition_matches WHERE notion_id IS NOT NULL").map((row) => row.notion_id),
);

const report = [];
const rows = [];
const seen = new Set();
const ambiguous = new Set();
let blocksFound = 0;
const unresolvedCompetitions = new Set();

for (const path of files) {
  const heldOn = dateFromText(path);
  let competition = explicit ? competitions.find((row) => row.id === explicit || row.slug === explicit) : null;
  if (!competition && heldOn) {
    const candidates = byDate.get(heldOn) ?? [];
    const school = candidates.filter((row) => /ОСДЮШОР/i.test(String(row.title)));
    competition = school.length === 1 ? school[0] : candidates.length === 1 ? candidates[0] : null;
  }
  const sourceTitle = competition
    ? String(competition.title).replace(/\s*\(.*$/, "").trim()
    : (path.split(/[\\/]/)[1] ?? "").replace(/^\d{4}[.\-/]\d{2}[.\-/]\d{2}\s*/, "");
  if (!competition) unresolvedCompetitions.add(`${heldOn || "без даты"} · ${sourceTitle}`);

  let sheets;
  try {
    sheets = readSheets(path);
  } catch (error) {
    report.push(`  ! ${path}: ${error.message}`);
    continue;
  }
  const roster = readRoster(sheets);
  let fileMatches = 0;
  let fileRows = 0;
  let fileBlocks = 0;
  for (const sheet of sheets) {
    for (const block of readGroups(sheet)) {
      blocksFound += 1;
      fileBlocks += 1;
      fileMatches += block.matches.length;
      for (const match of block.matches) {
        const a = block.players[match.a];
        const b = block.players[match.b];
        const sides = [
          { self: a, other: b, won: match.winner === "a" },
          { self: b, other: a, won: match.winner === "b" },
        ];
        for (const side of sides) {
          const athlete = findAthlete(side.self.name, block.gender);
          if (!athlete) continue;
          const opponentKey = normalize(side.other.name);
          if (opponentKey === normalize(side.self.name)) continue;
          const info = roster.get(opponentKey) ?? {};
          const blockCity = cell(sheet.rows, side.other.row, block.cityCol);
          const blockYear = Number.parseInt(cell(sheet.rows, side.other.row + 1, block.cityCol), 10);
          const selfIsA = side.self === a;
          // Счёт записан со стороны первого участника пары.
          let own = match.score ? (selfIsA ? match.score : [match.score[1], match.score[0]]) : null;
          // Если счёт противоречит исходу, значит он записан с другой стороны.
          if (own && own[0] > own[1] !== side.won) own = [own[1], own[0]];
          const score = own ? `${own[0]}:${own[1]}` : null;
          // Одна встреча в копиях одного файла должна дать одну строку,
          // поэтому этап в ключ не входит: у копий разные названия листов.
          const notionId = [
            "match",
            heldOn || "no-date",
            competition?.slug ?? slug(sourceTitle),
            slug(side.self.name),
            slug(side.other.name),
            side.won ? "win" : "loss",
            score ?? "x",
          ].join(":");
          if (seen.has(notionId)) continue;
          seen.add(notionId);
          fileRows += 1;
          rows.push({
            notionId,
            competitionId: competition?.id ?? null,
            athleteId: athlete.id,
            heldOn: heldOn || null,
            stage: block.stage,
            opponentName: side.other.name,
            opponentCity: info.city || (blockCity && !/^\d+$/.test(blockCity) ? blockCity : null),
            opponentBirthYear: info.birthYear ?? (Number.isFinite(blockYear) && blockYear > 1900 ? blockYear : null),
            opponentRank: info.rank || null,
            result: side.won ? "win" : "loss",
            score,
            sourceTitle,
          });
        }
      }
    }
  }
  if (fileRows > 0 || fileMatches > 0) {
    report.push(
      `  ${heldOn || "—"} · ${sourceTitle}: сеток ${fileBlocks}, встреч ${fileMatches}, наших строк ${fileRows}`,
    );
  }
  // Соперники без карточки в списке — только предупреждение в отчёт.
  for (const row of rows) {
    if (!row.opponentCity && !row.opponentBirthYear) ambiguous.add(row.opponentName);
  }
}

const statements = rows.map(
  (row) =>
    `INSERT INTO competition_matches (id, notion_id, competition_id, athlete_id, held_on, stage, opponent_name, ` +
    `opponent_city, opponent_birth_year, opponent_rank, result, score, source_title) VALUES (` +
    [
      quote(randomUUID()),
      quote(row.notionId),
      sqlValue(row.competitionId),
      quote(row.athleteId),
      sqlValue(row.heldOn),
      sqlValue(row.stage),
      quote(row.opponentName),
      sqlValue(row.opponentCity),
      sqlValue(row.opponentBirthYear),
      sqlValue(row.opponentRank),
      quote(row.result),
      sqlValue(row.score),
      quote(row.sourceTitle),
    ].join(", ") +
    `) ON CONFLICT(notion_id) DO UPDATE SET stage = excluded.stage, opponent_name = excluded.opponent_name, ` +
    `opponent_city = excluded.opponent_city, opponent_birth_year = excluded.opponent_birth_year, ` +
    `opponent_rank = excluded.opponent_rank, result = excluded.result, score = excluded.score, ` +
    `held_on = excluded.held_on, source_title = excluded.source_title, updated_at = datetime('now');`,
);

console.log(`Файлов: ${files.length}, сеток: ${blocksFound}`);
for (const line of report) console.log(line);
const added = rows.filter((row) => !existing.has(row.notionId)).length;
console.log(`\nВстреч наших спортсменов: ${rows.length} (новых ${added}, обновить ${rows.length - added})`);
if (unresolvedCompetitions.size > 0) {
  console.log(`\nБез соревнования в календаре (${unresolvedCompetitions.size}):`);
  for (const line of unresolvedCompetitions) console.log(`  - ${line}`);
}
if (ambiguous.size > 0) {
  console.log(`\nСоперники без города и года в списках (${ambiguous.size}): ${[...ambiguous].slice(0, 20).join(", ")}`);
}
if (verbose) {
  console.log("\nВстречи:");
  for (const row of rows.slice(0, 300)) {
    console.log(
      `  ${row.heldOn} · ${athleteNames.get(row.athleteId)} — ${row.opponentName} (${row.opponentCity ?? "?"}, ` +
        `${row.opponentBirthYear ?? "?"}, ${row.opponentRank ?? "?"}) · ` +
        `${row.result === "win" ? "победа" : "поражение"} ${row.score ?? ""} · ${row.stage}`,
    );
  }
}
if (dryRun) {
  console.log("\nЭто был отчёт: в базу ничего не записано. Для записи добавьте --write (или --remote).");
} else {
  executeSql(statements);
  console.log(`\nЗаписано: ${rows.length} строк.`);
}
