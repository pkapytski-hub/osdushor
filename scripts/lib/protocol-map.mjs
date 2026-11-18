/**
 * Карта «папка protocols/ → slug соревнования». Один раз подтверждённые
 * соответствия хранятся в scripts/protocol-map.json и не пересчитываются.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const MAP_PATH = fileURLToPath(new URL("../protocol-map.json", import.meta.url));

export function readMap() {
  if (!existsSync(MAP_PATH)) return {};
  try {
    return JSON.parse(readFileSync(MAP_PATH, "utf8"));
  } catch {
    return {};
  }
}

/** Записывает карту с сортировкой по имени папки и возвращает число записей. */
export function writeMap(map) {
  const sorted = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b, "ru")));
  writeFileSync(MAP_PATH, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
  return Object.keys(sorted).length;
}
