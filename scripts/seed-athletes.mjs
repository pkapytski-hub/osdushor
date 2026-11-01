#!/usr/bin/env node
/**
 * Заливка настоящего списка спортсменов школы с рейтингами.
 *
 * Данные лежат в worker/seed/athletes.json — это выгрузка из тренерской
 * таблицы «РЕЙТИНГ.xlsx» (лист текущего турнира). Скрипт сопоставляет записи
 * по фамилии и году рождения, поэтому повторный запуск не создаёт дублей.
 *
 *   node scripts/seed-athletes.mjs                # локальная база
 *   node scripts/seed-athletes.mjs --remote       # рабочая база на Cloudflare
 *   node scripts/seed-athletes.mjs --prune-demo   # убрать заглушки «Спортсмен NN»
 *   node scripts/seed-athletes.mjs --force-ratings # перезаписать рейтинг у найденных
 *
 * По умолчанию у уже существующего спортсмена рейтинг не трогается: он мог
 * измениться после турниров, а файл хранит исходные значения.
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const args = new Set(process.argv.slice(2));
const remote = args.has("--remote");
const pruneDemo = args.has("--prune-demo");
const forceRatings = args.has("--force-ratings");

const DB_NAME = "osdushor-db";
const seed = JSON.parse(readFileSync("worker/seed/athletes.json", "utf8"));
const athletes = seed.athletes ?? [];

if (athletes.length === 0) {
  console.error("В worker/seed/athletes.json нет записей.");
  process.exit(1);
}

// Запускаем локальный wrangler напрямую через node: shell не нужен, а значит
// SQL с пробелами и кавычками доходит до CLI без искажений.
const WRANGLER_CLI = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));

function wrangler(extraArgs, { capture = false } = {}) {
  const result = spawnSync(process.execPath, [WRANGLER_CLI, "d1", "execute", DB_NAME, ...extraArgs], {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`wrangler завершился с кодом ${result.status ?? "?"}`);
  }
  return result.stdout ?? "";
}

function queryJson(sql) {
  const output = wrangler(remote ? ["--remote", "--command", sql, "--json"] : ["--local", "--command", sql, "--json"], {
    capture: true,
  });
  const start = output.indexOf("[");
  const end = output.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("Не удалось разобрать ответ wrangler.");
  const parsed = JSON.parse(output.slice(start, end + 1));
  return parsed[0]?.results ?? [];
}

const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;

const existing = queryJson("SELECT id, full_name, birth_year FROM athletes");
const keyOf = (name, year) => `${String(name).trim().toLowerCase()}|${year ?? ""}`;
const byKey = new Map(existing.map((row) => [keyOf(row.full_name, row.birth_year), row.id]));

const statements = [];
let inserted = 0;
let updated = 0;
const seen = new Set();

for (const athlete of athletes) {
  const name = String(athlete.full_name ?? "").trim();
  if (!name) continue;
  const year = athlete.birth_year ?? null;
  const rating = Number(athlete.rating ?? 0);
  const gender = String(athlete.gender ?? "").trim();
  const key = keyOf(name, year);
  if (seen.has(key)) continue;
  seen.add(key);
  const id = byKey.get(key);
  if (id) {
    updated += 1;
    const assignments = [];
    if (gender) assignments.push(`gender = ${quote(gender)}`);
    if (forceRatings) assignments.push(`rating = ${rating}`);
    assignments.push("is_active = 1");
    statements.push(`UPDATE athletes SET ${assignments.join(", ")} WHERE id = ${quote(id)};`);
  } else {
    inserted += 1;
    statements.push(
      `INSERT INTO athletes (id, full_name, birth_year, gender, rating, is_active) VALUES (${quote(randomUUID())}, ${quote(name)}, ${year ?? "NULL"}, ${quote(gender)}, ${rating}, 1);`,
    );
  }
}

if (pruneDemo) {
  // Заглушки «Спортсмен NN» создаёт демо-режим. Встречи ссылаются на
  // спортсменов без каскада, поэтому связанные строки убираем по порядку.
  const demo = "SELECT id FROM athletes WHERE full_name LIKE 'Спортсмен %'";
  statements.push(
    `DELETE FROM tournament_matches WHERE player_a IN (${demo}) OR player_b IN (${demo});`,
    `DELETE FROM tournament_participants WHERE athlete_id IN (${demo});`,
    `DELETE FROM rating_history WHERE athlete_id IN (${demo});`,
    `DELETE FROM athletes WHERE full_name LIKE 'Спортсмен %';`,
    // Турниры, где играли только заглушки, остались бы пустыми.
    "DELETE FROM tournaments WHERE id NOT IN (SELECT DISTINCT tournament_id FROM tournament_participants);",
  );
}

const dir = mkdtempSync(join(tmpdir(), "osdushor-athletes-"));
const sqlPath = join(dir, "athletes.sql");
writeFileSync(sqlPath, `${statements.join("\n")}\n`, "utf8");

wrangler(remote ? ["--remote", "--file", sqlPath, "--yes"] : ["--local", "--file", sqlPath]);

console.log(
  `\n${remote ? "Рабочая" : "Локальная"} база: добавлено ${inserted}, уже было ${updated}` +
    `${pruneDemo ? ", демо-заглушки удалены" : ""}. Всего в файле: ${athletes.length}.`,
);
