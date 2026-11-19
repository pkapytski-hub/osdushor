/**
 * «Список участников» турнира (xlsx): фамилия с инициалом или полное имя,
 * год рождения и город.
 *
 * Списки раскладывают по-разному: «№ | Фамилия Имя | Год рождения | Разряд |
 * Рейтинг | Город», «№ | Рейтинг | Фамилия, имя | Год рождения | Разряд |
 * Организация», отдельные листы «Юноши» / «Девушки». Поэтому колонки ищутся
 * по заголовкам, а не по номерам, и таблица перечитывается на каждом листе.
 *
 * Год рождения в этих файлах бывает двух видов: «2013» и дата в Excel-сериале
 * («40593» — это 2011 год). Оба читаются как год.
 */
import { basename } from "node:path";
import { readSheets } from "./xlsx.mjs";

/** Пол по заголовку блока или листа. */
const genderOf = (text) =>
  /девуш|женщин/i.test(String(text ?? "")) ? "f" : /юнош|мужчин|мальчик/i.test(String(text ?? "")) ? "m" : "";

/** Год из ячейки: «2013», 40593 (дата в Excel-сериале) или «12.05.2013». */
export function yearOf(value) {
  const text = String(value ?? "").trim();
  if (!text) return 0;
  if (/^(19|20)\d{2}$/.test(text)) return Number(text);
  const serial = /^\d{4,5}(\.\d+)?$/.exec(text);
  if (serial) {
    const days = Math.round(Number(text));
    if (days > 20000 && days < 60000) {
      // Excel считает дни от 30.12.1899; високосный баг 1900 года на эти даты
      // уже не влияет.
      return new Date(Date.UTC(1899, 11, 30) + days * 86_400_000).getUTCFullYear();
    }
    return 0;
  }
  const dotted = /(\d{1,2})[.\-/](\d{1,2})[.\-/]((?:19|20)\d{2})/.exec(text);
  return dotted ? Number(dotted[3]) : 0;
}

/** Город из ячейки: «г. Гродно» → «Гродно»; названия клубов городом не считаем. */
function cleanCity(value) {
  // «г. Гродно» → «Гродно»: точку требуем, иначе от «Гомеля» отрежется первая буква.
  const text = String(value ?? "").trim().replace(/^г\.\s*/i, "").trim();
  if (text.length < 3 || text.length > 25) return "";
  if (!/^[А-ЯЁA-Z][А-Яа-яЁёA-Za-z'.\-\s]*$/.test(text)) return "";
  return text;
}

/** Строка похожа на человека, а не на шапку или итог. */
const isPerson = (value) => {
  const text = String(value ?? "").trim();
  if (text.length < 3 || text.length > 60) return false;
  if (/фамили|год\s*рожд|итого|всего|главный|судья|секретарь/i.test(text)) return false;
  return /^[A-Za-zА-Яа-яЁёІіЇїЄє][A-Za-zА-Яа-яЁёІіЇїЄє'.\-\s]+$/.test(text);
};

function readSheet(sheet, path, out) {
  let columns = null;
  let gender = genderOf(sheet.title);
  for (const cells of sheet.rows) {
    const row = (cells ?? []).map((cell) => String(cell ?? "").trim());
    const genderHere = row.map(genderOf).find(Boolean);
    if (genderHere) gender = genderHere;

    const nameCol = row.findIndex((cell) => /^фамили/i.test(cell));
    const yearCol = row.findIndex((cell) => /^(год\s*рожд|г\.?\s*р\b)/i.test(cell));
    if (nameCol >= 0 && yearCol >= 0) {
      columns = { nameCol, yearCol, cityCol: row.findIndex((cell) => /^город/i.test(cell)) };
      continue;
    }
    if (!columns) continue;

    const name = row[columns.nameCol] ?? "";
    const year = yearOf(row[columns.yearCol]);
    if (!isPerson(name) || !year) continue;
    out.push({
      name,
      year,
      city: columns.cityCol >= 0 ? cleanCity(row[columns.cityCol]) : "",
      gender,
      file: path,
    });
  }
}

/**
 * Участники из файлов-списков. Битый файл — пометка в problems, а не отказ:
 * без списка импорт просто вернётся к сопоставлению по фамилии.
 */
export function readParticipants(paths) {
  const entries = [];
  const problems = [];
  for (const path of paths) {
    try {
      for (const sheet of readSheets(path)) readSheet(sheet, path, entries);
    } catch (error) {
      problems.push(`${basename(path)}: ${String(error?.message ?? error)}`);
    }
  }
  return { entries, problems };
}
