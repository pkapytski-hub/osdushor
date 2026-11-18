#!/usr/bin/env node
/**
 * Обложки соревнований из папок протоколов.
 *
 *   node scripts/import-posters.mjs                  # отчёт по всем папкам protocols/
 *   node scripts/import-posters.mjs --write          # загрузить картинки и записать poster_path
 *   node scripts/import-posters.mjs --local          # локальная база вместо рабочей
 *   node scripts/import-posters.mjs "protocols/2026.09.28 Спартакиада ДЮСШ обл 2014"
 *   node scripts/import-posters.mjs "protocols/..." --competition=<slug>  # папка с датой, которой нет в календаре
 *
 * Картинка ищется в `медиа/` папки, если её нет — в самой папке. Порядок
 * предпочтения: «плакат/афиша/постер», затем «заставка/обложка», затем любой
 * файл, кроме сканов протоколов («Рисунок»), логотипов и смет. Соревнование
 * берётся из scripts/protocol-map.json, а для папок вне карты — по дате в имени,
 * как в import-protocol.mjs.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { findCover, uploadCover } from "./lib/covers.mjs";
import { readMap } from "./lib/protocol-map.mjs";

const argList = process.argv.slice(2);
const hasFlag = (name) => argList.includes(`--${name}`);
const option = (name) => argList.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1] ?? null;
const positional = argList.filter((arg) => !arg.startsWith("--"));

const remote = !hasFlag("local");
const write = hasFlag("write");
const forced = option("competition");
const DB_NAME = "osdushor-db";
const WRANGLER_CLI = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));

const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;

function wrangler(args, { capture = false } = {}) {
  const result = spawnSync(process.execPath, [WRANGLER_CLI, ...args], {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });
  if (result.status !== 0) throw new Error(`wrangler завершился с кодом ${result.status ?? "?"}`);
  return result.stdout ?? "";
}

function competitions() {
  const flag = remote ? "--remote" : "--local";
  const output = wrangler(["d1", "execute", DB_NAME, flag, "--json", "--command", "SELECT id, slug, starts_on, title FROM competitions"], {
    capture: true,
  });
  const start = output.indexOf("[");
  const end = output.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("Не удалось разобрать ответ wrangler.");
  return JSON.parse(output.slice(start, end + 1))[0]?.results ?? [];
}

/** Дата соревнования из имени папки: 2026.01.10. */
function dateFromName(name) {
  const found = /^(\d{4})\.(\d{2})\.(\d{2})/.exec(name);
  return found ? `${found[1]}-${found[2]}-${found[3]}` : "";
}

function executeSql(statements) {
  if (statements.length === 0) return;
  const dir = mkdtempSync(join(tmpdir(), "osdushor-posters-"));
  const path = join(dir, "posters.sql");
  writeFileSync(path, `${statements.join("\n")}\n`, "utf8");
  const args = remote ? ["--remote", "--file", path, "--yes"] : ["--local", "--file", path];
  const result = spawnSync(process.execPath, [WRANGLER_CLI, "d1", "execute", DB_NAME, ...args], { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    throw new Error(`wrangler завершился с кодом ${result.status ?? "?"}`);
  }
}

const folders = [];
for (const target of positional.length > 0 ? positional : [join(process.cwd(), "protocols")]) {
  if (!existsSync(target)) throw new Error(`Не найдено: ${target}`);
  if (statSync(target).isDirectory() && target.replace(/[\\/]+$/, "").endsWith("protocols")) {
    for (const name of readdirSync(target)) {
      const path = join(target, name);
      if (statSync(path).isDirectory()) folders.push(path);
    }
  } else {
    folders.push(target);
  }
}

const all = competitions();
const map = readMap();
const byDate = new Map();
for (const row of all) {
  const date = String(row.starts_on).slice(0, 10);
  byDate.set(date, [...(byDate.get(date) ?? []), row]);
}

const statements = [];
const missing = [];
const ambiguous = [];
const attached = [];

for (const dir of folders) {
  const name = dir.split(/[\\/]/).pop();
  const date = dateFromName(name);
  if (!date) {
    missing.push(`${name} — нет даты в имени`);
    continue;
  }
  const rows = byDate.get(date) ?? [];
  let competition;
  if (forced) {
    competition = all.find((row) => row.slug === forced || row.id === forced);
    if (!competition) {
      missing.push(`${name} — нет соревнования ${forced}`);
      continue;
    }
  } else if (map[name]) {
    competition = all.find((row) => row.slug === map[name]);
    if (!competition) {
      missing.push(`${name} — карта ведёт на ${map[name]}, его нет в календаре`);
      continue;
    }
  } else {
    const school = rows.filter((row) => /ОСДЮШОР/i.test(String(row.title)));
    const pick = school.length === 1 ? school : rows.length === 1 ? rows : null;
    if (!pick) {
      const reason = rows.length === 0 ? "нет в карте и нет в календаре" : "нет в карте, на дату несколько соревнований";
      missing.push(`${name} — ${reason}`);
      continue;
    }
    competition = pick[0];
    const shadowed = rows.filter((row) => row !== competition).map((row) => row.slug);
    if (shadowed.length > 0) ambiguous.push(`${name} → ${competition.slug} (ещё: ${shadowed.join(", ")})`);
  }
  const cover = findCover(dir);
  if (!cover) continue;

  if (!write) {
    attached.push(`${date} · ${name} · ${cover.name} (${Math.round(cover.size / 1024)} КБ)`);
    continue;
  }
  const key = uploadCover(cover.path, { remote });
  statements.push(`UPDATE competitions SET poster_path = ${quote(key)}, updated_at = datetime('now') WHERE id = ${quote(competition.id)};`);
  attached.push(`${date} · ${name} · ${cover.name} → ${key}`);
}

console.log(`Папок: ${folders.length} · соревнований в базе: ${all.length}`);
for (const line of attached) console.log(`  ${line}`);
if (missing.length > 0) {
  console.log(`\nБез привязки (${missing.length}):`);
  for (const line of missing) console.log(`  - ${line}`);
}
if (ambiguous.length > 0) {
  console.log(`\nНа дату несколько соревнований (${ambiguous.length}):`);
  for (const line of ambiguous) console.log(`  - ${line}`);
}

if (!write) {
  console.log(`\nЭто отчёт: картинки не загружены. Для записи добавьте --write.`);
  process.exit(0);
}

executeSql(statements);
console.log(`\nПривязано обложек: ${attached.length}.`);
