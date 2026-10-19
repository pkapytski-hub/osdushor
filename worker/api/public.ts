import { fail, ipHash, nowIso, ok, rateLimit, readJson, str, bool } from "../lib/http";
import { toCompetition, toNews, toBooleanRow } from "../lib/rows";
import { verifyTurnstile } from "../lib/turnstile";

const NEWS_CATEGORIES = new Set([
  "school",
  "competitions",
  "results",
  "announcements",
  "enrollment",
  "congratulations",
]);

const COMPETITION_STATUSES = new Set(["upcoming", "ongoing", "finished"]);
const DOCUMENT_CATEGORIES = new Set(["normative", "activity", "personal-data", "other"]);

function demoCondition(env: Env, alias = ""): string {
  const prefix = alias ? `${alias}.` : "";
  return env.DEMO_DATA === "true" ? "1 = 1" : `${prefix}is_demo = 0`;
}

function pageParams(url: URL): { limit: number; offset: number } {
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20) || 20, 1), 100);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0);
  return { limit, offset };
}

function listResponse(items: unknown[], total: number, limit: number, offset: number) {
  return ok({ items, total, limit, offset, has_more: offset + items.length < total });
}

export async function getSettings(env: Env): Promise<Record<string, string>> {
  const { results } = await env.DB.prepare("SELECT key, value FROM site_settings").all<{
    key: string;
    value: string;
  }>();
  const settings: Record<string, string> = {};
  for (const row of results ?? []) settings[row.key] = row.value;
  return settings;
}

export async function publicSettings(env: Env): Promise<Response> {
  const settings = await getSettings(env);
  return ok({ settings, turnstile_sitekey: env.TURNSTILE_SITEKEY ?? "" });
}

export async function listNews(env: Env, url: URL): Promise<Response> {
  const { limit, offset } = pageParams(url);
  const category = url.searchParams.get("category") ?? "";
  const query = str(url.searchParams.get("q") ?? "", 120);
  const where: string[] = ["is_published = 1", demoCondition(env)];
  const params: unknown[] = [];
  if (category && NEWS_CATEGORIES.has(category)) {
    where.push("category = ?");
    params.push(category);
  }
  if (query) {
    where.push("(title LIKE ? OR summary LIKE ? OR body LIKE ?)");
    params.push(`%${query}%`, `%${query}%`, `%${query}%`);
  }
  const clause = where.join(" AND ");
  const [rows, count] = await Promise.all([
    env.DB.prepare(
      `SELECT id, slug, title, summary, category, cover_path, is_demo, is_published, published_at
       FROM news WHERE ${clause} ORDER BY published_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(...params, limit, offset)
      .all(),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM news WHERE ${clause}`)
      .bind(...params)
      .first<{ count: number }>(),
  ]);
  return listResponse((rows.results ?? []).map(toNews), count?.count ?? 0, limit, offset);
}

export async function getNews(env: Env, slug: string): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT * FROM news WHERE slug = ? AND is_published = 1 AND ${demoCondition(env)}`,
  )
    .bind(slug)
    .first<Record<string, unknown>>();
  if (!row) return fail(404, "not_found", "Новость не найдена или ещё не опубликована.");
  return ok({ item: toNews(row) });
}

export async function listCompetitions(env: Env, url: URL): Promise<Response> {
  const { limit, offset } = pageParams(url);
  const status = url.searchParams.get("status") ?? "";
  const query = str(url.searchParams.get("q") ?? "", 120);
  const from = str(url.searchParams.get("from") ?? "", 20);
  const to = str(url.searchParams.get("to") ?? "", 20);
  const age = str(url.searchParams.get("age") ?? "", 80);
  const sort = url.searchParams.get("sort") === "date_desc" ? "DESC" : "ASC";
  const where: string[] = ["is_published = 1", demoCondition(env)];
  const params: unknown[] = [];
  if (status && COMPETITION_STATUSES.has(status)) {
    where.push("status = ?");
    params.push(status);
  }
  if (query) {
    where.push("(title LIKE ? OR description LIKE ? OR location LIKE ?)");
    params.push(`%${query}%`, `%${query}%`, `%${query}%`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    where.push("date(COALESCE(ends_on, starts_on)) >= date(?)");
    params.push(from);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    where.push("date(starts_on) <= date(?)");
    params.push(to);
  }
  if (age) {
    where.push("age_categories LIKE ?");
    params.push(`%${age}%`);
  }
  const clause = where.join(" AND ");
  const [rows, count] = await Promise.all([
    env.DB.prepare(
      `SELECT * FROM competitions WHERE ${clause} ORDER BY starts_on ${sort} LIMIT ? OFFSET ?`,
    )
      .bind(...params, limit, offset)
      .all(),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM competitions WHERE ${clause}`)
      .bind(...params)
      .first<{ count: number }>(),
  ]);
  return listResponse((rows.results ?? []).map(toCompetition), count?.count ?? 0, limit, offset);
}

export async function getCompetition(env: Env, slug: string): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT * FROM competitions WHERE slug = ? AND is_published = 1 AND ${demoCondition(env)}`,
  )
    .bind(slug)
    .first<Record<string, unknown>>();
  if (!row) return fail(404, "not_found", "Соревнование не найдено или ещё не опубликовано.");
  return ok({ item: toCompetition(row) });
}

export async function listCoaches(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM coaches WHERE is_published = 1 ORDER BY sort_order, full_name",
  ).all<Record<string, unknown>>();
  return ok({ items: (results ?? []).map(toBooleanRow) });
}

export async function listAchievements(env: Env, url: URL): Promise<Response> {
  const level = url.searchParams.get("level") ?? "";
  const year = str(url.searchParams.get("year") ?? "", 10);
  const where = ["is_published = 1"];
  const params: unknown[] = [];
  if (["oblast", "respublika", "international"].includes(level)) {
    where.push("level = ?");
    params.push(level);
  }
  if (/^\d{4}$/.test(year)) {
    where.push("year = ?");
    params.push(year);
  }
  const { results } = await env.DB.prepare(
    `SELECT * FROM achievements WHERE ${where.join(" AND ")} ORDER BY year DESC, sort_order, title`,
  )
    .bind(...params)
    .all<Record<string, unknown>>();
  return ok({ items: (results ?? []).map(toBooleanRow) });
}

export async function listGallery(env: Env, url: URL): Promise<Response> {
  const category = str(url.searchParams.get("category") ?? "", 60);
  const where = ["is_published = 1", demoCondition(env)];
  const params: unknown[] = [];
  if (category) {
    where.push("category = ?");
    params.push(category);
  }
  const { results } = await env.DB.prepare(
    `SELECT * FROM gallery_items WHERE ${where.join(" AND ")} ORDER BY sort_order, created_at DESC`,
  )
    .bind(...params)
    .all<Record<string, unknown>>();
  return ok({ items: (results ?? []).map(toBooleanRow) });
}

export async function listDocuments(env: Env, url: URL): Promise<Response> {
  const category = url.searchParams.get("category") ?? "";
  const where = ["is_published = 1"];
  const params: unknown[] = [];
  if (category && DOCUMENT_CATEGORIES.has(category)) {
    where.push("category = ?");
    params.push(category);
  }
  const { results } = await env.DB.prepare(
    `SELECT * FROM documents WHERE ${where.join(" AND ")} ORDER BY category, sort_order, title`,
  )
    .bind(...params)
    .all<Record<string, unknown>>();
  return ok({ items: (results ?? []).map(toBooleanRow) });
}

export async function listLocations(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM locations WHERE is_published = 1 ORDER BY sort_order, name",
  ).all<Record<string, unknown>>();
  return ok({ items: (results ?? []).map(toBooleanRow) });
}

export async function listSchedule(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT s.*, l.name AS location_name, l.address AS location_address
     FROM schedule_entries s LEFT JOIN locations l ON l.id = s.location_id
     WHERE s.is_published = 1 ORDER BY s.sort_order, s.time_start`,
  ).all<Record<string, unknown>>();
  return ok({ items: (results ?? []).map(toBooleanRow) });
}

export async function listHistory(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM history_events WHERE is_published = 1 ORDER BY CAST(year AS INTEGER), sort_order, year",
  ).all<Record<string, unknown>>();
  return ok({ items: (results ?? []).map(toBooleanRow) });
}

export async function listResults(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT * FROM competitions
     WHERE is_published = 1 AND ${demoCondition(env)}
       AND status = 'finished'
       AND (results_text IS NOT NULL OR results_path IS NOT NULL)
     ORDER BY starts_on DESC LIMIT 100`,
  ).all<Record<string, unknown>>();
  return ok({ items: (results ?? []).map(toCompetition) });
}

export async function submitFeedback(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  // Honeypot: заполненное скрытое поле означает бота.
  if (str(body.company, 100)) {
    return ok({ accepted: true });
  }
  const startedAt = Number(body.started_at ?? 0);
  if (startedAt > 0 && Date.now() - startedAt < 2500) {
    return fail(400, "too_fast", "Проверьте формулировку и отправьте сообщение ещё раз.");
  }
  const name = str(body.name, 120);
  const contact = str(body.contact, 200);
  const topic = str(body.topic, 40) || "general";
  const message = str(body.message, 4000);
  const consent = bool(body.consent);
  const fields: Record<string, string> = {};
  if (name.length < 2) fields.name = "Укажите имя (не менее 2 символов).";
  if (!/^[+\d][\d\s()+-]{6,20}$/.test(contact) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact)) {
    fields.contact = "Укажите телефон или адрес электронной почты.";
  }
  if (message.length < 10) fields.message = "Опишите вопрос подробнее (не менее 10 символов).";
  if (!consent) fields.consent = "Необходимо согласие на обработку персональных данных.";
  if (Object.keys(fields).length > 0) {
    return fail(400, "validation_failed", "Проверьте заполнение формы.", fields);
  }
  const allowedTopics = new Set(["general", "enrollment", "schedule", "competitions", "documents"]);
  const ip = await ipHash(request);
  const allowed = await rateLimit(env.DB, `feedback:${ip}`, 5, 60 * 60);
  if (!allowed) {
    return fail(429, "rate_limited", "Слишком много обращений. Попробуйте позже.");
  }

  // Защита от автоматических отправок: если ключ включён — проверяем токен.
  const turnstileToken = str(body.turnstile_token, 2000) || str(body["cf-turnstile-response"], 2000) || "";
  if (!await verifyTurnstile(env, request, turnstileToken)) {
    return fail(403, "turnstile_failed", "Проверка защиты не пройдена. Обновите страницу и попробуйте ещё раз.");
  }

  await env.DB.prepare(
    `INSERT INTO feedback_messages (id, name, contact, topic, message, consent, ip_hash, user_agent)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      name,
      contact,
      allowedTopics.has(topic) ? topic : "general",
      message,
      ip,
      (request.headers.get("user-agent") ?? "").slice(0, 250),
    )
    .run();
  return ok({ accepted: true, message: "Спасибо! Обращение получено. Ответим по указанному контакту." });
}

export async function health(env: Env): Promise<Response> {
  const row = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  return ok({ database: row?.ok === 1 ? "ok" : "unknown", time: nowIso() });
}
