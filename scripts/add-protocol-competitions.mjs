// Добавляет в календарь соревнования, для которых есть папки протоколов,
// но нет записи в competitions. Даты взяты из заявок и отчётов ГСК в этих
// папках, поэтому интервал покрывает и день из имени папки — по нему
// import-matches.mjs привязывает встречи к соревнованию.
//
//   node scripts/add-protocol-competitions.mjs            # локальная база
//   node scripts/add-protocol-competitions.mjs --remote   # рабочая база

import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const DB_NAME = "osdushor-db";
const WRANGLER_CLI = "node_modules/wrangler/bin/wrangler.js";
const remote = process.argv.includes("--remote");

const competitions = [
  {
    slug: "otkrytoe-pervenstvo-sdyushor-smena-2015",
    title: "Открытое первенство СДЮШОР «Смена» по настольному теннису (юноши, девушки 2015 г.р. и моложе)",
    location: "Минск",
    starts_on: "2026-04-13",
    ends_on: "2026-04-15",
  },
  {
    slug: "otkrytoe-pervenstvo-sdyushor-smena-den-fizkultury-2016",
    title:
      "Открытое первенство СДЮШОР «Смена», посвящённое Дню работников физической культуры и спорта (юноши, девушки 2016 г.р. и моложе)",
    location: "Минск",
    starts_on: "2026-05-07",
    ends_on: "2026-05-08",
  },
  {
    slug: "uts-respublikanskaya-spartakiada-shkolnikov-2026",
    title: "Учебно-тренировочный сбор по подготовке к Республиканской спартакиаде школьников",
    location: "Гродно",
    starts_on: "2026-06-13",
    ends_on: "2026-06-14",
  },
  {
    slug: "kubok-grodnenskoy-oblasti-muzhchiny-zhenschiny",
    title: "Кубок Гродненской области по настольному теннису (мужчины, женщины)",
    location: "Гродно",
    starts_on: "2026-08-30",
    ends_on: "2026-08-31",
  },
  {
    slug: "pervenstvo-grodnenskoy-oblasti-olimpiyskie-dni-molodezhi",
    title:
      "Первенство Гродненской области по настольному теннису в программе Олимпийских дней молодёжи Республики Беларусь",
    location: "Гродно",
    starts_on: "2026-09-22",
    ends_on: "2026-09-23",
  },
  {
    slug: "spartakiada-dyussh-grodnenskoy-oblasti-2014",
    title: "Спартакиада ДЮСШ Гродненской области по настольному теннису (юноши, девушки 2014 г.р. и моложе)",
    location: "Гродно",
    starts_on: "2026-09-28",
    ends_on: "2026-09-29",
  },
  {
    slug: "respublikanskaya-spartakiada-dyussh-2013",
    title:
      "Республиканская спартакиада детско-юношеских спортивных школ по настольному теннису (юноши, девушки 2013 г.р. и моложе)",
    location: "",
    starts_on: "2026-10-20",
    ends_on: "2026-10-23",
  },
];

const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;

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

const existing = new Set(queryJson("SELECT slug FROM competitions").map((row) => row.slug));
const statements = [];
for (const row of competitions) {
  if (existing.has(row.slug)) continue;
  statements.push(
    "INSERT OR IGNORE INTO competitions (id, slug, title, description, location, starts_on, ends_on, age_categories, status, is_demo, is_published) VALUES (" +
      [
        quote(randomUUID()),
        quote(row.slug),
        quote(row.title),
        quote(""),
        quote(row.location),
        quote(row.starts_on),
        quote(row.ends_on),
        quote("[]"),
        quote("finished"),
        "0",
        "1",
      ].join(", ") +
      ");",
  );
}

if (statements.length === 0) {
  console.log("Все соревнования уже в календаре.");
} else {
  const file = `tmp-competitions-${Date.now()}.sql`;
  const { writeFileSync, unlinkSync } = await import("node:fs");
  writeFileSync(file, `${statements.join("\n")}\n`, "utf8");
  try {
    wrangler(remote ? ["--remote", "--file", file, "--yes"] : ["--local", "--file", file, "--yes"]);
  } finally {
    unlinkSync(file);
  }
  console.log(`Добавлено соревнований: ${statements.length} (${remote ? "рабочая база" : "локальная база"}).`);
}
