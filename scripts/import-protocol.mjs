#!/usr/bin/env node
/**
 * Импорт результатов из протоколов первенств ОСДЮШОР (xlsx) в базу сайта.
 *
 *   node scripts/import-protocol.mjs                      # папка protocols/, только отчёт
 *   node scripts/import-protocol.mjs --write              # записать в рабочую базу
 *   node scripts/import-protocol.mjs "protocols/2026.01.10 ОСДЮШОР 2007"
 *   node scripts/import-protocol.mjs --local              # сверяться с локальной базой
 *   node scripts/import-protocol.mjs --competition=<id|slug>
 *   node scripts/import-protocol.mjs --age=gender      # взрослые: «мужчины» / «женщины»
 *
 * Что читается: лист «Финальный этап» каждого файла — блоки «Места 1-8»,
 * «9-16», «17-24», колонка «Место», а также круговые финалы домашних
 * турниров («Одиночный разряд. Юноши. Финальный этап. Финал 1» с колонкой «М»)
 * и финальные таблицы, где место записано в столбце «Место» (ПГО, Кубок
 * Надежд, финалы областных спартакиад).
 * Предварительный этап и встречи не нужны:
 * на сайт попадает только итоговое место воспитанника, как в архиве из Notion.
 *
 * Соревнование берётся из календаря competitions: по --competition, иначе по
 * дате из имени папки и слову в названии. Пол не угадывается — он написан в
 * заголовке листа («Финальный этап.Юноши» / «.Девушки»).
 *
 * Фамилия сопоставляется с базой athletes по ФИО без учёта ё/е, регистра и
 * лишних пробелов; если однофамильцев несколько, строка не пишется и попадает
 * в отчёт. Повторный запуск обновляет те же строки (ключ импорта лежит в
 * notion_id), поэтому дублей не появляется.
 *
 * Без флага --write ничего не записывается: печатается разбор и отчёт.
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
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

// База по умолчанию рабочая: отчёт тоже должен сверяться с ней, иначе он
// покажет пустой календарь. Локальная база выбирается флагом --local.
const remote = !hasFlag("local");
const dryRun = !hasFlag("write") && !hasFlag("remote");
const DB_NAME = "osdushor-db";
const WRANGLER_CLI = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));

// ---------------------------------------------------------------------------
// Разбор протокола
// ---------------------------------------------------------------------------

// Фамилия и имя (или инициал с точкой): «Шульга Татьяна», «Маргина М.»
const NAME = /^[A-Za-zА-Яа-яЁёІіЇїЄє][A-Za-zА-Яа-яЁёІіЇїЄє'.-]+(\s+[A-Za-zА-Яа-яЁёІіЇїЄє][A-Za-zА-Яа-яЁёІіЇїЄє'.-]*\.?)+$/;
const BLOCK = /^Места\s*(\d+)\s*[-–—]\s*(\d+)/i;

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

/** Места из листа «Финальный этап»: имя в колонке 3, место — в колонке 31. */
function readFinalStage(rows) {
  let block = "";
  const entries = [];
  for (const row of rows) {
    const first = String(row[0] ?? "");
    const blockMatch = BLOCK.exec(first);
    if (blockMatch) {
      block = `${blockMatch[1]}-${blockMatch[2]}`;
      continue;
    }
    const name = cleanName(row[2]);
    const placeText = String(row[30] ?? "");
    if (!NAME.test(name) || !/^\d{1,3}$/.test(placeText)) continue;
    entries.push({ name, place: Number(placeText), block });
  }
  return entries;
}

// Взрослые чемпионаты подписаны «мужчины» / «женщины» вместо «юноши» / «девушки».
const genderOf = (text) =>
  /девуш|женщин/i.test(String(text ?? "")) ? "f" : /юнош|мужчин/i.test(String(text ?? "")) ? "m" : "";

/** Заголовок финального этапа с диапазоном мест: «… Финальный этап. 1-8 места», «… 9-19 место». */
const FINAL_TITLE = /Финальн[а-яё]*\s+этап[^\d]{0,40}?(\d{1,2})\s*[-–—]\s*(\d{1,2})\s+мест/i;

/** Подпись кругового финала с диапазоном мест: «1-8 место», «9-16 места». */
const PLACE_RANGE = /^(\d{1,2})\s*[-–—]\s*(\d{1,2})\s+мест/i;

/**
 * Круговой финал без слова «Финальный этап» (республиканские турниры, области):
 * подпись «1-8 место», ниже строки участников, где место — первая ячейка,
 * фамилия — третья. Место в этих таблицах записано текстом «1.0», «8.0»:
 * целые номера участников — уже другой формат, такой блок не трогаем.
 */
function readRangeFinal(rows, titleRow, from, to) {
  const entries = [];
  for (let row = titleRow + 1; row < rows.length; row += 1) {
    const cells = rows[row] ?? [];
    if (cells.some((cell) => PLACE_RANGE.test(String(cell ?? "").trim()))) break;
    const raw = String(cells[0] ?? "").trim();
    const name = cleanName(cells[2]);
    if (!/^\d{1,2}\.0+$/.test(raw) || !NAME.test(name)) continue;
    const place = Number.parseInt(raw, 10);
    if (place < from || place > to) continue;
    entries.push({ name, place });
  }
  const places = new Set(entries.map((entry) => entry.place));
  return entries.length >= 4 && places.size === entries.length
    ? entries.map((entry) => ({ ...entry, block: `${from}-${to}` }))
    : [];
}

/** Места 1-8: в листе есть столбец «М», место стоит прямо в строке участника. */
function readPlaceColumn(rows, titleRow) {
  let placeCol = -1;
  for (let row = titleRow + 1; row < Math.min(titleRow + 4, rows.length); row += 1) {
    const index = (rows[row] ?? []).findIndex((cell) => String(cell ?? "").trim() === "М");
    if (index >= 0) {
      placeCol = index;
      break;
    }
  }
  if (placeCol < 0) return [];
  const entries = [];
  for (let row = titleRow + 1; row < rows.length; row += 1) {
    const cells = rows[row] ?? [];
    if (cells.some((cell) => FINAL_TITLE.test(String(cell ?? "")))) break;
    const name = cleanName(cells[1]);
    const place = String(cells[placeCol] ?? "").trim();
    if (!NAME.test(name) || !/^\d{1,2}$/.test(place)) continue;
    entries.push({ name, place: Number(place), block: "1-8" });
  }
  return entries;
}

/** Целое из ячейки: «3» и «3.0» — одно и то же, всё остальное — не место. */
const numberCell = (value) => {
  const text = String(value ?? "").trim();
  return /^\d{1,2}(\.0+)?$/.test(text) ? Number.parseInt(text, 10) : null;
};

/** Групповой финал: «Одиночный разряд. Юноши. Финальный этап. Финал 1». */
const FINAL_GROUP_TITLE = /Одиночный\s+разряд\.?\s*(Юноши|Девушки)[^]{0,80}?Финальный\s+этап\.[^]{0,40}?Финал\s*(\d+)/i;

/**
 * Групповой финал (круговой, как в протоколах своей школы): шапка «# … О С М»,
 * строка участника — номер в столбце E, фамилия в F, место в столбце «М».
 */
function readGroupFinal(rows, titleRow) {
  let placeCol = -1;
  let numberCol = -1;
  for (let row = titleRow + 1; row < Math.min(titleRow + 4, rows.length); row += 1) {
    const cells = rows[row] ?? [];
    if (numberCol < 0) {
      const index = cells.findIndex((cell) => String(cell ?? "").trim() === "#");
      if (index >= 0) numberCol = index;
    }
    const placeIndex = cells.findIndex((cell) => String(cell ?? "").trim() === "М");
    if (placeIndex >= 0) {
      placeCol = placeIndex;
      break;
    }
  }
  if (placeCol < 0 || numberCol < 0) return [];
  const entries = [];
  for (let row = titleRow + 1; row < rows.length; row += 1) {
    const cells = rows[row] ?? [];
    if (cells.some((cell) => /Финальный\s+этап/i.test(String(cell ?? "")))) break;
    const name = cleanName(cells[numberCol + 1]);
    // Числа в этих таблицах записаны как 1.0, 2.0 — читаем только целые.
    const place = numberCell(cells[placeCol]);
    if (numberCell(cells[numberCol]) === null || !NAME.test(name) || place === null) continue;
    entries.push({ name, place, block: "" });
  }
  return entries;
}

/**
 * Места 9-19: сетка утешения. Подпись «9 место» стоит в столбце имени, а сам
 * участник записан строкой ниже в том же столбце.
 */
function readPlaceLabels(rows, from, to) {
  const found = new Map();
  rows.forEach((cells, row) => {
    (cells ?? []).forEach((cell, col) => {
      const match = /^(\d{1,2})\s*место$/i.exec(String(cell ?? "").trim());
      if (!match) return;
      const place = Number(match[1]);
      if (place < from || place > to || found.has(place)) return;
      const name = cleanName(rows[row + 1]?.[col]);
      if (!NAME.test(name)) return;
      found.set(place, { name, place, block: `${from}-${to}` });
    });
  });
  return [...found.values()].sort((a, b) => a.place - b.place);
}

/** Диапазон мест в подписи: «1-8 место», «(1-9 место)», «9-16 места». */
const RANGE_WORD = /(\d{1,2})\s*[-–—]\s*(\d{1,2})\s*мест/i;
const RANGE_PAREN = /\((\d{1,2})\s*[-–—]\s*(\d{1,2})\)/;

/** Подпись финала: «финал», «1 финал», «ФИНАЛЬНЫЙ РАУНД», «дев фин». */
const FINAL_MARK = /финал|фин(?![а-яё])/i;

/** Ближайший пол над таблицей: «ЮНОШИ» / «ДЕВУШКИ» в шапке листа. */
function genderAbove(rows, row) {
  for (let index = row - 1; index >= Math.max(0, row - 8); index -= 1) {
    for (const cell of rows[index] ?? []) {
      const gender = genderOf(cell);
      if (gender) return gender;
    }
  }
  return "";
}

/**
 * Финальная таблица с колонкой «Место»: номер участника в столбце B, фамилия
 * в C, место — в столбце под заголовком «Место». Так оформлены круговые
 * финалы ПГО, «Кубка Надежд» и областных спартакиад: диапазон мест стоит в
 * подписи над шапкой («1 финал (1-9 место)», «9-16 место»).
 *
 * Блок принимается только целиком: места должны попасть в объявленный
 * диапазон и не повторяться, иначе это групповой этап, а не финал.
 */
function readPlacedFinals(rows, sheetTitle) {
  const blocks = [];
  rows.forEach((cells, row) => {
    const header = Array.from(cells ?? []).map((cell) => String(cell ?? "").trim());
    const placeCol = header.findIndex((cell) => cell === "Место");
    if (placeCol < 0) return;
    if (!header.includes("№") || !header.some((cell) => /^Фамилия/i.test(cell))) return;

    // Диапазон и слово «финал» берём из подписей над шапкой или из имени листа.
    let range = null;
    let finalMark = FINAL_MARK.test(sheetTitle) ? sheetTitle : "";
    for (let index = row - 1; index >= Math.max(0, row - 8) && !range; index -= 1) {
      const line = (rows[index] ?? []).map((cell) => String(cell ?? "").trim()).filter(Boolean).join(" ");
      if (!line) continue;
      const match = RANGE_WORD.exec(line) || RANGE_PAREN.exec(line);
      if (!match) continue;
      range = match;
      if (FINAL_MARK.test(line)) finalMark = line;
      break;
    }
    if (!range || !finalMark) return;
    const from = Number(range[1]);
    const to = Number(range[2]);

    const entries = [];
    for (let index = row + 1; index < rows.length; index += 1) {
      const line = rows[index] ?? [];
      if (line.some((cell) => /Главный\s+судья/i.test(String(cell ?? "")))) break;
      const number = numberCell(line[1]);
      const name = cleanName(line[2]);
      if (number === null || !NAME.test(name)) continue;
      const place = numberCell(line[placeCol]);
      if (place === null || place < from || place > to) continue;
      entries.push({ name, place });
    }

    const places = new Set(entries.map((entry) => entry.place));
    if (entries.length < 3 || places.size !== entries.length) return;
    const gender = genderAbove(rows, row) || genderOf(sheetTitle);
    if (!gender) return;
    blocks.push({ gender, entries: entries.map((entry) => ({ ...entry, block: `${from}-${to}` })) });
  });
  return blocks;
}

/** Подпись места у игрока в сетке: «1 место», «17 место». */
const PLACE_CAPTION = /^(\d{1,2})\s*место$/i;

/**
 * Сетка с подписью места рядом с игроком: строка матча за первое место
 * содержит «1 место», а справа от подписи — фамилия занявшего его игрока.
 * Так оформлены выгрузки из Google Sheets (ПРБ, спартакиады).
 *
 * Имя берём только из той же строки справа; подпись без имени (вторая,
 * незаполненная копия сетки на листе) пропускается.
 */
function readPlaceCaptions(rows, sheetTitle) {
  if (!FINAL_MARK.test(sheetTitle)) return [];
  const found = new Map();
  rows.forEach((cells, row) => {
    (cells ?? []).forEach((cell, col) => {
      const match = PLACE_CAPTION.exec(String(cell ?? "").trim());
      if (!match) return;
      const place = Number(match[1]);
      if (found.has(place)) return;
      for (let next = col + 1; next <= col + 3; next += 1) {
        const name = cleanName(cells[next]);
        if (!NAME.test(name)) continue;
        found.set(place, { name, place, row });
        break;
      }
    });
  });
  const entries = [...found.values()].sort((a, b) => a.place - b.place);
  if (entries.length < 3 || new Set(entries.map((entry) => entry.place)).size !== entries.length) return [];
  const gender = genderOf(sheetTitle) || genderAbove(rows, entries[0].row);
  if (!gender) return [];
  const block = `${entries[0].place}-${entries[entries.length - 1].place}`;
  return [
    {
      gender,
      entries: entries.map((entry) => ({ name: entry.name, place: entry.place, block })),
    },
  ];
}

/**
 * Один xlsx может содержать несколько финальных этапов: юноши 1-8, девушки 1-8,
 * сетки утешения 9-19 — поэтому возвращаем список блоков.
 */
function readProtocol(path) {
  const sheets = readSheets(path);
  const blocks = [];
  const dateCell = sheets
    .flatMap((sheet) => sheet.rows.flat())
    .map((cell) => String(cell ?? ""))
    .find((cell) => /\b\d{1,2}\s+\S+\s+\d{4}/.test(cell));

  for (const sheet of sheets) {
    // Финальная таблица с колонкой «Место» читается первой: в ней номер
    // участника в столбце B, и старый разбор принял бы его за место.
    const placed = readPlacedFinals(sheet.rows, sheet.title);
    if (placed.length > 0) {
      for (const block of placed) blocks.push({ ...block, dateCell });
      continue;
    }

    // Сетка с подписью «N место» и фамилией справа от неё.
    const captioned = readPlaceCaptions(sheet.rows, sheet.title);
    if (captioned.length > 0) {
      for (const block of captioned) blocks.push({ ...block, dateCell });
      continue;
    }

    const hasBlocks = sheet.rows.some((row) => row.some((cell) => BLOCK.test(String(cell ?? ""))));
    if (hasBlocks) {
      // Старый формат: лист «Финальный этап.Юноши» с блоками «Места 1-8», «9-16»…
      const stageCell = sheet.rows
        .flat()
        .map((cell) => String(cell ?? ""))
        .find((cell) => /Финальный\s+этап/i.test(cell));
      // В заголовке соревнования есть «юношей и девушек», поэтому пол берём
      // только из подзаголовка листа: «Финальный этап.Юноши».
      const gender = genderOf(stageCell) || genderOf(path.split(/[\\/]/).pop());
      if (!gender) throw new Error("Не удалось понять пол участников: в заголовке листа нет «Юноши» или «Девушки».");
      blocks.push({ gender, entries: readFinalStage(sheet.rows), dateCell });
      continue;
    }
    sheet.rows.forEach((cells, row) => {
      (cells ?? []).forEach((cell) => {
        const title = String(cell ?? "");
        const rangeMatch = PLACE_RANGE.exec(title.trim());
        if (rangeMatch) {
          // Пол в таких таблицах — подзаголовок «ЮНОШИ» / «ДЕВУШКИ» над блоком.
          const gender = genderOf(sheet.rows.slice(0, row).flat().map((value) => String(value ?? "")).reverse().find((value) => genderOf(value)));
          const entries = gender
            ? readRangeFinal(sheet.rows, row, Number(rangeMatch[1]), Number(rangeMatch[2]))
            : [];
          if (entries.length > 0) blocks.push({ gender, entries, dateCell });
          return;
        }
        const groupMatch = FINAL_GROUP_TITLE.exec(title);
        if (groupMatch) {
          const entries = readGroupFinal(sheet.rows, row);
          const gender = genderOf(groupMatch[1]);
          if (entries.length > 0 && gender) {
            const block = `Финал ${groupMatch[2]}`;
            blocks.push({ gender, entries: entries.map((entry) => ({ ...entry, block })), dateCell });
          }
          return;
        }
        const match = FINAL_TITLE.exec(title);
        if (!match) return;
        const gender = genderOf(title);
        if (!gender) return;
        const from = Number(match[1]);
        const to = Number(match[2]);
        // Сетки взрослых чемпионатов подписаны «N место» и для первых мест тоже.
        const labeled = readPlaceLabels(sheet.rows, from, to);
        const entries = labeled.length > 0 ? labeled : from === 1 ? readPlaceColumn(sheet.rows, row) : [];
        if (entries.length > 0) blocks.push({ gender, entries, dateCell });
      });
    });
  }

  if (blocks.length === 0) throw new Error(`В файле нет финального этапа с местами: ${path}`);
  return blocks;
}

/** Дата из имени папки/файла: 2026.01.10, 10.01.2026 или 10 января 2026. */
const MONTHS = [
  "январ", "феврал", "март", "апрел", "ма", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр",
];
function dateFromText(text) {
  const iso = /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const dotted = /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/.exec(text);
  if (dotted) return `${dotted[3]}-${dotted[2].padStart(2, "0")}-${dotted[1].padStart(2, "0")}`;
  const words = /(\d{1,2})\s+([а-яё]+)\s+(\d{4})/i.exec(text);
  if (words) {
    const stem = words[2].toLowerCase().replace(/я$/, "").slice(0, 6);
    // «мая» и «март» начинаются одинаково — сверяем по первым буквам месяца.
    const index = MONTHS.findIndex((month) => stem.startsWith(month.slice(0, 4)));
    if (index >= 0) return `${words[3]}-${String(index + 1).padStart(2, "0")}-${words[1].padStart(2, "0")}`;
  }
  return "";
}

function collectFiles(targets) {
  const found = [];
  for (const target of targets) {
    if (!existsSync(target)) throw new Error(`Не найдено: ${target}`);
    if (statSync(target).isDirectory()) {
      // Папки раскладывают по соревнованиям, поэтому проходим вглубь.
      for (const name of readdirSync(target)) {
        const path = join(target, name);
        if (statSync(path).isDirectory()) found.push(...collectFiles([path]));
        else if (/\.xlsx$/i.test(name) && !name.startsWith("~$")) found.push(path);
      }
    } else {
      found.push(target);
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Запись в базу
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
  const dir = mkdtempSync(join(tmpdir(), "osdushor-protocol-"));
  const path = join(dir, "protocol.sql");
  writeFileSync(path, `${statements.join("\n")}\n`, "utf8");
  const args = remote ? ["--remote", "--file", path, "--yes"] : ["--local", "--file", path];
  const result = spawnSync(process.execPath, [WRANGLER_CLI, "d1", "execute", DB_NAME, ...args], {
    encoding: "utf8",
  });
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

// В папке могут лежать и протоколы предварительных раундов без мест — их
// пропускаем, чтобы один такой файл не отменял импорт всей папки.
const parsed = [];
const skipped = [];
for (const path of files) {
  try {
    parsed.push(...readProtocol(path).map((block) => ({ path, ...block })));
  } catch (error) {
    if (!/нет финального этапа/.test(String(error?.message))) throw error;
    skipped.push(path);
  }
}
if (parsed.length === 0) {
  throw new Error(`Ни в одном протоколе нет финального этапа с местами: ${files.join(", ")}`);
}
for (const path of skipped) console.log(`  пропущен (нет мест): ${path.split(/[\\/]/).pop()}`);

// «??» здесь не годится: dateFromText возвращает пустую строку, а не null.
const date =
  option("date") ||
  dateFromText(parsed[0].path) ||
  dateFromText(targets[0]) ||
  dateFromText(parsed[0].dateCell);
if (!date) throw new Error("Не удалось определить дату соревнования. Укажите её: --date=2026-01-10.");

let competition = null;
const explicit = option("competition");
if (explicit) {
  const rows = queryJson(
    `SELECT id, slug, title, starts_on FROM competitions WHERE id = ${quote(explicit)} OR slug = ${quote(explicit)}`,
  );
  competition = rows[0] ?? null;
  if (!competition) throw new Error(`Соревнование не найдено: ${explicit}`);
} else {
  const rows = queryJson(`SELECT id, slug, title, starts_on FROM competitions WHERE starts_on = ${quote(date)}`);
  const school = rows.filter((row) => /ОСДЮШОР/i.test(String(row.title)));
  const pick = school.length === 1 ? school : rows.length === 1 ? rows : null;
  if (!pick) {
    const list = rows.map((row) => `  ${row.id}  ${row.starts_on}  ${row.title}`).join("\n");
    throw new Error(
      `Не удалось однозначно выбрать соревнование на ${date}.\n${list || "  (в календаре на эту дату ничего нет)"}\n` +
        "Укажите его: --competition=<id>.",
    );
  }
  competition = pick[0];
}

const city = option("city") ?? "Гродно";
const ageOption = option("age") ?? (/20\d\d/.exec(competition.title)?.[0] ?? "");
const sourceTitle = option("source") ?? String(competition.title).replace(/\s*\(.*$/, "").trim();

const athletes = queryJson("SELECT id, full_name, gender FROM athletes");
const byName = new Map();
for (const athlete of athletes) {
  const key = normalize(athlete.full_name);
  const list = byName.get(key) ?? [];
  list.push(athlete);
  byName.set(key, list);
}
const bySurname = new Map();
for (const athlete of athletes) {
  const surname = normalize(athlete.full_name).split(" ")[0];
  const list = bySurname.get(surname) ?? [];
  list.push(athlete);
  bySurname.set(surname, list);
}

const existing = queryJson(
  `SELECT id, athlete_id, notion_id FROM competition_results WHERE competition_id = ${quote(competition.id)}`,
);
const existingByAthlete = new Map(existing.map((row) => [row.athlete_id, row]));

const statements = [];
const report = [];
const unmatched = [];
const ambiguous = [];
const ties = [];
const usedAthletes = new Map();
let created = 0;
let updated = 0;

for (const protocol of parsed) {
  const places = new Map();
  for (const entry of protocol.entries) places.set(entry.place, [...(places.get(entry.place) ?? []), entry.name]);
  const label = `${protocol.gender === "f" ? "девушки" : "юноши"}, места ${protocol.entries[0]?.block ?? ""}`;
  // --age=gender: у взрослых чемпионатов категория — пол участника.
  const ageCategory = ageOption === "gender" ? (protocol.gender === "f" ? "женщины" : "мужчины") : ageOption;
  for (const [place, names] of places) {
    if (names.length > 1) ties.push(`${place} место (${label}) — ${names.join(", ")}`);
  }
  for (const entry of protocol.entries) {
    const key = normalize(entry.name);
    const candidates =
      byName.get(key) ?? bySurname.get(key.split(" ")[0])?.filter((row) => normalize(row.full_name).split(" ")[1]?.[0] === key.split(" ")[1]?.[0]) ?? [];
    // Однофамильцев в протоколе различает пол блока: «Девушки» / «Юноши».
    const sameGender =
      candidates.length > 1 && protocol.gender
        ? candidates.filter((row) => row.gender === protocol.gender)
        : candidates;
    if (candidates.length === 0) {
      unmatched.push(`${entry.name} (${entry.place} место, ${protocol.path})`);
      continue;
    }
    if (sameGender.length > 1 || sameGender.length === 0) {
      ambiguous.push(`${entry.name} — ${candidates.map((row) => row.full_name).join(", ")}`);
      continue;
    }
    const athlete = sameGender[0];
    if (usedAthletes.has(athlete.id)) {
      ambiguous.push(`${entry.name} — уже был в протоколе как ${usedAthletes.get(athlete.id)}`);
      continue;
    }
    usedAthletes.set(athlete.id, entry.name);

    const same = existingByAthlete.get(athlete.id);
    // Фамилии в протоколах часто с инициалом — показываем, кого выбрали в базе.
    const matched =
      normalize(athlete.full_name) === key ? "" : ` как ${athlete.full_name}`;
    const eventKind = "Личные";
    if (same) {
      statements.push(
        `UPDATE competition_results SET place = ${entry.place}, age_category = ${sqlValue(ageCategory)}, ` +
          `event_kind = ${quote(eventKind)}, city = ${quote(city)}, held_on = ${quote(date)}, ` +
          `source_title = ${quote(sourceTitle)}, updated_at = datetime('now') WHERE id = ${quote(same.id)};`,
      );
      updated += 1;
      report.push(`${entry.name} — ${entry.place} место (${label})${matched} → обновлена существующая строка`);
    } else {
      const notionId = `protocol:${date}:${competition.slug}:${key.replace(/\s+/g, "-")}`;
      statements.push(
        `INSERT INTO competition_results (id, notion_id, competition_id, athlete_id, held_on, place, ` +
          `age_category, event_kind, city, source_title) VALUES (${quote(randomUUID())}, ${quote(notionId)}, ` +
          `${quote(competition.id)}, ${quote(athlete.id)}, ${quote(date)}, ${entry.place}, ` +
          `${sqlValue(ageCategory)}, ${quote(eventKind)}, ${quote(city)}, ${quote(sourceTitle)});`,
      );
      created += 1;
      report.push(`${entry.name} — ${entry.place} место (${label})${matched}`);
    }
  }
}

console.log(`Соревнование: ${competition.title}`);
console.log(`  ${competition.id} · ${competition.starts_on} · ${city} · возраст ${ageOption === "gender" ? "по полу" : ageOption || "не указан"}`);
console.log(`Протоколов: ${parsed.length} (${files.map((path) => path.split(/[\\/]/).pop()).join(", ")})`);
for (const protocol of parsed) {
  const name = protocol.path.split(/[\\/]/).pop();
  console.log(
    `  ${name}: ${protocol.entries.length} мест (${protocol.gender === "f" ? "девушки" : "юноши"}, ` +
      `${protocol.entries[0]?.block ?? ""})`,
  );
}
console.log(`\nРазобрано мест: ${parsed.reduce((sum, protocol) => sum + protocol.entries.length, 0)}`);
for (const line of report) console.log(`  ${line}`);

if (unmatched.length > 0) {
  console.log(`\nНет в базе спортсменов (${unmatched.length}) — строки не записаны:`);
  for (const line of unmatched) console.log(`  - ${line}`);
}
if (ambiguous.length > 0) {
  console.log(`\nСпорные совпадения (${ambiguous.length}) — строки не записаны:`);
  for (const line of ambiguous) console.log(`  - ${line}`);
}
if (ties.length > 0) {
  console.log(`\nДелёж мест в протоколе (${ties.length}) — записано как в протоколе:`);
  for (const line of ties) console.log(`  - ${line}`);
}

if (dryRun) {
  console.log("\nЭто был отчёт: в базу ничего не записано. Для записи добавьте --write (или --remote).");
  process.exit(0);
}

executeSql(statements);
console.log(`\nЗаписано: добавлено ${created}, обновлено ${updated}.`);
