#!/usr/bin/env node
/**
 * Импорт результатов из протоколов первенств ОСДЮШОР (xlsx) в базу сайта.
 *
 *   node scripts/import-protocol.mjs                      # папка protocols/, только отчёт
 *   node scripts/import-protocol.mjs --write              # записать в рабочую базу
 *   node scripts/import-protocol.mjs --all                # отчёт по всем папкам из карты
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
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findCover, uploadCover } from "./lib/covers.mjs";
import { readMap } from "./lib/protocol-map.mjs";
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

/**
 * Места из листа «Финальный этап»: блоки «Места 1-8», «9-16» баранкой.
 *
 * В старых протоколах место всегда в 31-й колонке, в новых (ПГО, ОП ОСДЮШОР)
 * — в последней колонке таблицы без заголовка. Поэтому колонку ищем по данным:
 * значения должны быть целыми внутри объявленного диапазона и не повторяться.
 */
function readFinalStage(rows) {
  const entries = [];
  let block = null;

  const readBlock = () => {
    if (!block || block.lines.length === 0) return;
    const { from, to, lines } = block;
    let placeCol = -1;
    for (let index = 2; index < Math.max(...lines.map((line) => line.cells.length)); index += 1) {
      const places = lines.map((line) => numberCell(line.cells[index]));
      if (places.some((place) => place === null || place < from || place > to)) continue;
      if (new Set(places).size !== places.length) continue;
      placeCol = index;
    }
    if (placeCol < 0) return;
    for (const line of lines) {
      entries.push({ name: line.name, place: numberCell(line.cells[placeCol]), block: `${from}-${to}` });
    }
  };

  for (const row of rows) {
    // Подпись блока может стоять в любой колонке: в «мальчики.xlsx» она в второй.
    const blockMatch = row.map((cell) => BLOCK.exec(String(cell ?? ""))).find(Boolean);
    if (blockMatch) {
      readBlock();
      block = { from: Number(blockMatch[1]), to: Number(blockMatch[2]), lines: [] };
      continue;
    }
    if (!block) continue;
    // Строка участника начинается с номера: так отсекается шапка «№ | Фамилия Имя».
    if (numberCell(row[0]) === null) continue;
    // Имя — в первой колонке после номера; строки матчей без имени пропускаем.
    const nameIndex = [1, 2].find((index) => NAME.test(cleanName(row[index])));
    if (nameIndex === undefined) continue;
    block.lines.push({ name: cleanName(row[nameIndex]), cells: row });
  }
  readBlock();
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
 * Пол из имени листа или файла: кроме «Юноши»/«Девушки» встречаются
 * «юн фин», «дев пары», «мал финалы», «мальчики», «девочки».
 *
 * Граница слова задана явно: \b в JS считает словом только латиницу и цифры,
 * поэтому с кириллицей «\bдев» не совпадает никогда.
 */
function sheetGenderOf(title) {
  const direct = genderOf(title);
  if (direct) return direct;
  const text = String(title ?? "").toLowerCase();
  // Длинные основы — без правой границы («мальчики», «девочки»), одиночные
  // «м»/«ж» — только целым словом: «м 2015 ф».
  if (/(^|[^а-яё])(дев|девочк)/.test(text) || /(^|[^а-яё])ж(?=[^а-яё]|$)/.test(text)) return "f";
  if (/(^|[^а-яё])(юн|мал|мальчик)/.test(text) || /(^|[^а-яё])м(?=[^а-яё]|$)/.test(text)) return "m";
  return "";
}

/**
 * Один xlsx может содержать несколько финальных этапов: юноши 1-8, девушки 1-8,
 * сетки утешения 9-19 — поэтому возвращаем список блоков.
 */
function readProtocol(path) {
  const sheets = readSheets(path);
  const blocks = [];
  const problems = [];
  const dateCell = sheets
    .flatMap((sheet) => sheet.rows.flat())
    .map((cell) => String(cell ?? ""))
    .find((cell) => /\b\d{1,2}\s+\S+\s+\d{4}/.test(cell));

  // Один лист не должен отменять остальные: в файле рядом с одиночными финалами
  // часто лежат пары и микст, где пол не написан.
  for (const sheet of sheets) {
    try {
      blocks.push(...readSheetBlocks(path, sheet, dateCell));
    } catch (error) {
      problems.push(`лист «${sheet.title}»: ${String(error?.message ?? error)}`);
    }
  }

  if (blocks.length === 0) {
    if (problems.length > 0) throw new Error(`Ни один лист не разобран (${problems.join("; ")})`);
    throw new Error(`В файле нет финального этапа с местами: ${path}`);
  }
  return { blocks, problems };
}

/** Финальные блоки одного листа: таблица с «Место», сетка с подписями, круговой финал. */
function readSheetBlocks(path, sheet, dateCell) {
  const blocks = [];

  // Финальная таблица с колонкой «Место» читается первой: в ней номер
  // участника в столбце B, и старый разбор принял бы его за место.
  const placed = readPlacedFinals(sheet.rows, sheet.title);
  if (placed.length > 0) return placed.map((block) => ({ ...block, dateCell }));

  // Сетка с подписью «N место» и фамилией справа от неё.
  const captioned = readPlaceCaptions(sheet.rows, sheet.title);
  if (captioned.length > 0) return captioned.map((block) => ({ ...block, dateCell }));

  const hasBlocks = sheet.rows.some((row) => row.some((cell) => BLOCK.test(String(cell ?? ""))));
  if (hasBlocks) {
    // Старый формат: лист «Финальный этап.Юноши» с блоками «Места 1-8», «9-16»…
    const stageCell = sheet.rows
      .flat()
      .map((cell) => String(cell ?? ""))
      .find((cell) => /Финальный\s+этап/i.test(cell));
    // В заголовке соревнования есть «юношей и девушек», поэтому пол берём
    // из подзаголовка над блоком мест или из имени листа: «юн фин», «дев фин».
    const blockRow = sheet.rows.findIndex((row) => row.some((cell) => BLOCK.test(String(cell ?? ""))));
    const gender =
      genderOf(stageCell) ||
      genderAbove(sheet.rows, blockRow) ||
      sheetGenderOf(sheet.title) ||
      sheetGenderOf(basename(path));
    if (!gender) throw new Error("Не удалось понять пол участников: в листе нет «Юноши» или «Девушки».");
    const entries = readFinalStage(sheet.rows);
    if (entries.length === 0) throw new Error("на листе есть блоки «Места», но ни одна колонка не похожа на места");
    return [{ gender, entries, dateCell }];
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
    // Выгрузка всех соревнований и результатов не влезает в стандартный 1 МБ.
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`wrangler завершился с кодом ${result.status ?? "?"}`);
  return result.stdout ?? "";
}

/** Пауза между повторами: busy-wait, потому что весь скрипт синхронный. */
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

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
      sleep(1500);
    }
  }
  throw lastError ?? new Error("Запрос к базе не выполнился.");
}

/** Обложка из папки протокола (то же правило, что у import-posters). */
function findPoster(files, date) {
  const dirs = new Set();
  for (const file of files) {
    const fileDir = dirname(file);
    dirs.add(fileDir);
    dirs.add(dirname(fileDir));
  }
  for (const base of dirs) {
    const baseDate = dateFromText(base);
    if (baseDate && baseDate !== date) continue;
    const cover = findCover(base);
    if (cover) return cover.path;
  }
  return null;
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

const allMode = hasFlag("all");
if (allMode && !dryRun) {
  throw new Error("--all — только отчёт: по всем папкам сразу ничего не записывается. Для записи запускайте импорт по одной папке с --write.");
}
// Флаги одного запуска в --all не имеют смысла: --date или --competition
// подменили бы данные сразу всем папкам, поэтому лучше упасть, а не угадывать.
const perRunFlags = ["competition", "date", "city", "age", "source"].filter((name) => option(name) !== null);
if (allMode && perRunFlags.length > 0) {
  throw new Error(`--all не сочетается с ${perRunFlags.map((name) => `--${name}`).join(", ")}: это флаги одного запуска.`);
}

const map = readMap();
const targets = positional.length > 0 ? positional : ["protocols"];

// Общие данные — один раз на весь прогон: иначе отчёт по 118 папкам сделает
// сотни запросов к D1.
const competitions = queryJson("SELECT id, slug, title, starts_on FROM competitions");
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
const resultsByCompetition = new Map();
for (const row of queryJson("SELECT id, athlete_id, notion_id, competition_id FROM competition_results")) {
  const list = resultsByCompetition.get(row.competition_id) ?? new Map();
  list.set(row.athlete_id, row);
  resultsByCompetition.set(row.competition_id, list);
}

/** Один проход по папке: разбор протоколов, выбор соревнования, сопоставление имён. */
function processFolder(folderTargets) {
  const out = {
    files: [],
    parsed: [],
    skipped: [],
    places: 0,
    competition: null,
    date: "",
    rows: [],
    unmatched: [],
    ambiguous: [],
    ties: [],
    issues: [],
    statements: [],
    created: 0,
    updated: 0,
    city: "",
    ageOption: "",
  };
  try {
    out.files = collectFiles(folderTargets);
  } catch (error) {
    out.issues.push(String(error?.message ?? error));
    return out;
  }
  if (out.files.length === 0) {
    out.issues.push("нет xlsx-протоколов");
    return out;
  }

  // В папке могут лежать и протоколы предварительных раундов без мест — их
  // пропускаем, чтобы один такой файл не отменял импорт всей папки.
  for (const path of out.files) {
    try {
      const { blocks, problems } = readProtocol(path);
      out.parsed.push(...blocks.map((block) => ({ path, ...block })));
      // Проблемный лист — пометка, а не отказ от всего файла.
      for (const problem of problems) out.issues.push(`${basename(path)}: ${problem}`);
    } catch (error) {
      const message = String(error?.message ?? error);
      if (/нет финального этапа/.test(message)) {
        out.skipped.push(path);
        continue;
      }
      const issue = `${basename(path)}: ${message}`;
      out.issues.push(issue);
      // В отчёте это пометка, а в записи — стоп: иначе в базу уедет неполный
      // импорт папки и никто об этом не узнает.
      if (!dryRun) {
        throw new Error(
          `Файл не разобран, запись остановлена: ${issue}\n` +
            "Исправьте протокол или уберите его из папки. Полный список проблем — без --write.",
        );
      }
    }
  }
  out.places = out.parsed.reduce((sum, protocol) => sum + protocol.entries.length, 0);
  if (out.parsed.length === 0) {
    out.issues.push("нет финального этапа с местами");
    return out;
  }
  if (out.places === 0) out.issues.push("лист найден, но строк с местами в нём нет (командные таблицы?)");

  // «??» здесь не годится: dateFromText возвращает пустую строку, а не null.
  const date =
    option("date") ||
    dateFromText(out.parsed[0].path) ||
    dateFromText(folderTargets[0]) ||
    dateFromText(out.parsed[0].dateCell);
  if (!date) {
    out.issues.push("не удалось определить дату соревнования");
    return out;
  }
  out.date = date;

  const explicit = option("competition");
  // Папка из карты получает свой slug без сверки дат и названий.
  const folderName = folderTargets.length === 1 && statSync(folderTargets[0]).isDirectory() ? basename(folderTargets[0]) : "";
  const mapped = folderName ? map[folderName] : null;
  if (explicit) {
    out.competition = competitions.find((row) => row.id === explicit || row.slug === explicit) ?? null;
    if (!out.competition) out.issues.push(`соревнование не найдено: ${explicit}`);
  } else if (mapped) {
    out.competition = competitions.find((row) => row.slug === mapped) ?? null;
    if (!out.competition) out.issues.push(`карта ведёт на «${mapped}», но такого соревнования нет в календаре`);
  } else {
    const rows = competitions.filter((row) => row.starts_on === date);
    const school = rows.filter((row) => /ОСДЮШОР/i.test(String(row.title)));
    out.competition = school.length === 1 ? school[0] : rows.length === 1 ? rows[0] : null;
    if (!out.competition) {
      const list = rows.map((row) => `  ${row.id}  ${row.starts_on}  ${row.title}`).join("\n");
      out.issues.push(
        `не удалось однозначно выбрать соревнование на ${date}.\n${list || "  (в календаре на эту дату ничего нет)"}\n` +
          "Укажите его: --competition=<id> или добавьте папку в scripts/protocol-map.json " +
          "(node scripts/match-protocols.mjs --save).",
      );
    }
  }
  if (!out.competition) return out;
  const competition = out.competition;

  const city = (out.city = option("city") ?? "Гродно");
  const ageOption = (out.ageOption = option("age") ?? (/20\d\d/.exec(competition.title)?.[0] ?? ""));
  const sourceTitle = option("source") ?? String(competition.title).replace(/\s*\(.*$/, "").trim();

  const existingByAthlete = resultsByCompetition.get(competition.id) ?? new Map();

  const statements = out.statements;
  const usedAthletes = new Map();

  for (const protocol of out.parsed) {
    const places = new Map();
    for (const entry of protocol.entries) places.set(entry.place, [...(places.get(entry.place) ?? []), entry.name]);
    const label = `${protocol.gender === "f" ? "девушки" : "юноши"}, места ${protocol.entries[0]?.block ?? ""}`;
    // --age=gender: у взрослых чемпионатов категория — пол участника.
    const ageCategory = ageOption === "gender" ? (protocol.gender === "f" ? "женщины" : "мужчины") : ageOption;
    for (const [place, names] of places) {
      if (names.length > 1) out.ties.push(`${place} место (${label}) — ${names.join(", ")}`);
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
        out.unmatched.push(`${entry.name} (${entry.place} место, ${basename(protocol.path)})`);
        continue;
      }
      if (sameGender.length > 1 || sameGender.length === 0) {
        out.ambiguous.push(`${entry.name} — ${candidates.map((row) => row.full_name).join(", ")}`);
        continue;
      }
      const athlete = sameGender[0];
      if (usedAthletes.has(athlete.id)) {
        out.ambiguous.push(`${entry.name} — уже был в протоколе как ${usedAthletes.get(athlete.id)}`);
        continue;
      }
      usedAthletes.set(athlete.id, entry.name);

      const same = existingByAthlete.get(athlete.id);
      // Фамилии в протоколах часто с инициалом — показываем, кого выбрали в базе.
      const matched = normalize(athlete.full_name) === key ? "" : ` как ${athlete.full_name}`;
      const eventKind = "Личные";
      if (same) {
        statements.push(
          `UPDATE competition_results SET place = ${entry.place}, age_category = ${sqlValue(ageCategory)}, ` +
            `event_kind = ${quote(eventKind)}, city = ${quote(city)}, held_on = ${quote(date)}, ` +
            `source_title = ${quote(sourceTitle)}, updated_at = datetime('now') WHERE id = ${quote(same.id)};`,
        );
        out.updated += 1;
        out.rows.push(`${entry.name} — ${entry.place} место (${label})${matched} → обновлена существующая строка`);
      } else {
        const notionId = `protocol:${date}:${competition.slug}:${key.replace(/\s+/g, "-")}`;
        statements.push(
          `INSERT INTO competition_results (id, notion_id, competition_id, athlete_id, held_on, place, ` +
            `age_category, event_kind, city, source_title) VALUES (${quote(randomUUID())}, ${quote(notionId)}, ` +
            `${quote(competition.id)}, ${quote(athlete.id)}, ${quote(date)}, ${entry.place}, ` +
            `${sqlValue(ageCategory)}, ${quote(eventKind)}, ${quote(city)}, ${quote(sourceTitle)});`,
        );
        out.created += 1;
        out.rows.push(`${entry.name} — ${entry.place} место (${label})${matched}`);
      }
    }
  }

  return out;
}

/** Подробный разбор одной папки (обычный запуск импорта). */
function printFolder(out) {
  const competition = out.competition;
  console.log(`Соревнование: ${competition.title}`);
  console.log(
    `  ${competition.id} · ${competition.starts_on} · ${out.city} · возраст ` +
      `${out.ageOption === "gender" ? "по полу" : out.ageOption || "не указан"}`,
  );
  console.log(`Протоколов: ${out.parsed.length} (${out.files.map((path) => basename(path)).join(", ")})`);
  for (const path of out.skipped) console.log(`  пропущен (нет мест): ${basename(path)}`);
  for (const protocol of out.parsed) {
    console.log(
      `  ${basename(protocol.path)}: ${protocol.entries.length} мест ` +
        `(${protocol.gender === "f" ? "девушки" : "юноши"}, ${protocol.entries[0]?.block ?? ""})`,
    );
  }
  console.log(`\nРазобрано мест: ${out.places}`);
  for (const line of out.rows) console.log(`  ${line}`);

  if (out.unmatched.length > 0) {
    console.log(`\nНет в базе спортсменов (${out.unmatched.length}) — строки не записаны:`);
    for (const line of out.unmatched) console.log(`  - ${line}`);
  }
  if (out.ambiguous.length > 0) {
    console.log(`\nСпорные совпадения (${out.ambiguous.length}) — строки не записаны:`);
    for (const line of out.ambiguous) console.log(`  - ${line}`);
  }
  if (out.ties.length > 0) {
    console.log(`\nДелёж мест в протоколе (${out.ties.length}) — записано как в протоколе:`);
    for (const line of out.ties) console.log(`  - ${line}`);
  }
  // В записи те же цифры напечатает строка «Записано» в конце.
  if (dryRun) console.log(`\nВ базу: добавится ${out.created}, обновится ${out.updated}.`);
}

// ---------------------------------------------------------------------------
// Режимы запуска
// ---------------------------------------------------------------------------

if (allMode) {
  const folders = Object.keys(map)
    .sort()
    .map((name) => ({ label: name, targets: [join("protocols", name)] }));
  let withPlaces = 0;
  let withRows = 0;

  for (const folder of folders) {
    const out = processFolder(folder.targets);
    if (out.places > 0) withPlaces += 1;
    if (out.rows.length > 0) withRows += 1;
    const missing = out.unmatched.length + out.ambiguous.length;

    if (out.rows.length > 0) {
      console.log(
        `${folder.label} · мест ${out.places} · в базу ${out.rows.length}` + (missing > 0 ? ` · не сопоставлено ${missing}` : ""),
      );
      continue;
    }

    console.log(`${folder.label} · мест ${out.places} · результатов нет`);
    for (const issue of out.issues) console.log(`    ${issue.split("\n")[0]}`);
    if (missing > 0) console.log(`    не сопоставлено ${missing} из ${out.places}: нет в списке спортсменов или спорные однофамильцы`);
  }

  console.log(
    `\nПапок: ${folders.length} · с разобранными местами: ${withPlaces} · ` +
      `результаты есть: ${withRows} · без результатов: ${folders.length - withRows}`,
  );
  console.log("\nЭто был отчёт: в базу ничего не записано.");
  process.exit(0);
}

const out = processFolder(targets);

if (!out.competition) {
  for (const issue of out.issues) console.log(`  ${issue}`);
  // Отчёт не падает из-за проблемной папки: причины уже напечатаны.
  if (dryRun) {
    console.log("\nЭто был отчёт: разбирать нечего, в базу ничего не записано.");
    process.exit(0);
  }
  throw new Error(out.issues.join("\n") || "Не удалось разобрать протоколы.");
}

for (const issue of out.issues) console.log(`  ${issue}`);
printFolder(out);

const poster = findPoster(out.files, out.date);
if (poster) console.log(`\nПлакат для страницы: ${basename(poster)}`);

if (dryRun) {
  console.log("\nЭто был отчёт: в базу ничего не записано. Для записи добавьте --write (или --remote).");
  process.exit(0);
}

if (poster) {
  const key = uploadCover(poster, { remote });
  out.statements.push(
    `UPDATE competitions SET poster_path = ${quote(key)}, updated_at = datetime('now') WHERE id = ${quote(out.competition.id)};`,
  );
  console.log(`\nПлакат: ${basename(poster)} → ${key}`);
}

executeSql(out.statements);
console.log(`\nЗаписано: добавлено ${out.created}, обновлено ${out.updated}.`);
