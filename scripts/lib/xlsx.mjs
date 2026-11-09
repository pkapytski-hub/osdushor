/**
 * Чтение xlsx без сторонних библиотек: ZIP через zlib, лист — обычный XML.
 * Значения ячеек разложены по столбцам (A → 0, B → 1 …), пустых ячеек в
 * массиве строки нет — на их месте остаются дырки.
 */
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

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

/** Названия листов в порядке вкладок: файл листа → заголовок из workbook.xml. */
function sheetTitles(files) {
  const workbook = files.get("xl/workbook.xml")?.toString("utf8") ?? "";
  const rels = files.get("xl/_rels/workbook.xml.rels")?.toString("utf8") ?? "";
  const targets = new Map();
  for (const match of rels.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g)) {
    const target = match[2].replace(/^\//, "").replace(/^xl\//, "");
    targets.set(match[1], `xl/${target}`);
  }
  const titles = new Map();
  for (const match of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    const attrs = match[0];
    const name = /\bname="([^"]*)"/.exec(attrs)?.[1] ?? "";
    const rid = /\br:id="([^"]*)"/.exec(attrs)?.[1] ?? "";
    const target = targets.get(rid);
    if (target) titles.set(target, decodeXml(name));
  }
  return titles;
}

export function readSheets(path) {
  const files = readZip(readFileSync(path));
  const shared = parseSharedStrings(files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "");
  const titles = sheetTitles(files);
  return [...files.keys()]
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/(\d+)/)[1]) - Number(b.match(/(\d+)/)[1]))
    .map((name) => ({
      name,
      title: titles.get(name) ?? name.split("/").pop(),
      rows: parseSheet(files.get(name).toString("utf8"), shared),
    }));
}
