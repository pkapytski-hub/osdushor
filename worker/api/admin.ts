import {
  ApiProblem,
  assertMutationAllowed,
  bool,
  fail,
  int,
  nullableStr,
  ok,
  readJson,
  str,
  uuid,
} from "../lib/http";
import { audit, hashPassword, requireUser, type SessionUser } from "../lib/auth";
import { upload } from "./files";
import { uniqueSlug } from "../lib/slugs";
import { toBooleanRow, toCompetition, toNews } from "../lib/rows";
import { removeDemo, seedDemo } from "../demo";

type FieldKind = "text" | "longtext" | "bool" | "int" | "datetime" | "date" | "time" | "url";

interface FieldSpec {
  kind: FieldKind;
  required?: boolean;
  max?: number;
  nullable?: boolean;
  enum?: readonly string[];
}

interface ResourceDef {
  table: string;
  order: string;
  entity: string;
  fields: Record<string, FieldSpec>;
  slugFrom?: string;
  jsonField?: string;
  demoColumn?: boolean;
}

const WEEKDAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

const RESOURCES: Record<string, ResourceDef> = {
  news: {
    table: "news",
    order: "published_at DESC",
    entity: "news",
    slugFrom: "title",
    fields: {
      title: { kind: "text", required: true, max: 200 },
      slug: { kind: "text", max: 90 },
      summary: { kind: "text", max: 400 },
      body: { kind: "longtext", max: 50_000 },
      category: {
        kind: "text",
        required: true,
        enum: ["school", "competitions", "results", "announcements", "enrollment", "congratulations"],
      },
      cover_path: { kind: "text", max: 300, nullable: true },
      meta_title: { kind: "text", max: 120, nullable: true },
      meta_description: { kind: "text", max: 300, nullable: true },
      is_published: { kind: "bool" },
      published_at: { kind: "datetime", required: true },
    },
  },
  competitions: {
    table: "competitions",
    order: "starts_on DESC",
    entity: "competition",
    slugFrom: "title",
    fields: {
      title: { kind: "text", required: true, max: 200 },
      slug: { kind: "text", max: 90 },
      description: { kind: "longtext", max: 20_000 },
      location: { kind: "text", required: true, max: 300 },
      starts_on: { kind: "datetime", required: true },
      ends_on: { kind: "datetime", nullable: true },
      age_categories: { kind: "text", max: 500 },
      status: { kind: "text", required: true, enum: ["upcoming", "ongoing", "finished"] },
      regulation_path: { kind: "text", max: 300, nullable: true },
      results_path: { kind: "text", max: 300, nullable: true },
      results_text: { kind: "longtext", max: 20_000, nullable: true },
      meta_title: { kind: "text", max: 120, nullable: true },
      meta_description: { kind: "text", max: 300, nullable: true },
      is_published: { kind: "bool" },
    },
  },
  coaches: {
    table: "coaches",
    order: "sort_order, full_name",
    entity: "coach",
    fields: {
      full_name: { kind: "text", required: true, max: 160 },
      position: { kind: "text", max: 160 },
      category: { kind: "text", max: 200, nullable: true },
      bio: { kind: "longtext", max: 10_000, nullable: true },
      achievements: { kind: "longtext", max: 10_000, nullable: true },
      contacts: { kind: "text", max: 300, nullable: true },
      photo_path: { kind: "text", max: 300, nullable: true },
      sort_order: { kind: "int" },
      is_published: { kind: "bool" },
    },
  },
  achievements: {
    table: "achievements",
    order: "year DESC, sort_order, title",
    entity: "achievement",
    fields: {
      year: { kind: "text", max: 10, nullable: true },
      level: { kind: "text", required: true, enum: ["oblast", "respublika", "international"] },
      title: { kind: "text", required: true, max: 300 },
      athlete: { kind: "text", max: 200, nullable: true },
      place: { kind: "text", max: 100, nullable: true },
      description: { kind: "longtext", max: 5_000, nullable: true },
      sort_order: { kind: "int" },
      is_published: { kind: "bool" },
    },
  },
  gallery: {
    table: "gallery_items",
    order: "sort_order, created_at DESC",
    entity: "gallery",
    demoColumn: true,
    fields: {
      title: { kind: "text", max: 200 },
      image_path: { kind: "text", required: true, max: 300 },
      category: { kind: "text", max: 60, nullable: true },
      sort_order: { kind: "int" },
      is_published: { kind: "bool" },
    },
  },
  documents: {
    table: "documents",
    order: "category, sort_order, title",
    entity: "document",
    fields: {
      title: { kind: "text", required: true, max: 300 },
      category: { kind: "text", required: true, enum: ["normative", "activity", "personal-data", "other"] },
      description: { kind: "text", max: 600, nullable: true },
      file_path: { kind: "text", max: 300, nullable: true },
      file_size: { kind: "int", nullable: true },
      mime_type: { kind: "text", max: 100, nullable: true },
      sort_order: { kind: "int" },
      is_published: { kind: "bool" },
    },
  },
  locations: {
    table: "locations",
    order: "sort_order, name",
    entity: "location",
    fields: {
      name: { kind: "text", required: true, max: 200 },
      address: { kind: "text", max: 300 },
      phone: { kind: "text", max: 100, nullable: true },
      schedule_note: { kind: "text", max: 1000, nullable: true },
      map_url: { kind: "url", max: 500, nullable: true },
      photo_path: { kind: "text", max: 300, nullable: true },
      sort_order: { kind: "int" },
      is_published: { kind: "bool" },
    },
  },
  schedule: {
    table: "schedule_entries",
    order: "sort_order, time_start",
    entity: "schedule",
    fields: {
      group_name: { kind: "text", required: true, max: 160 },
      coach: { kind: "text", max: 160, nullable: true },
      weekday: { kind: "text", required: true, enum: WEEKDAYS },
      time_start: { kind: "time", required: true },
      time_end: { kind: "time", required: true },
      location_id: { kind: "text", max: 80, nullable: true },
      note: { kind: "text", max: 500, nullable: true },
      sort_order: { kind: "int" },
      is_published: { kind: "bool" },
    },
  },
  history: {
    table: "history_events",
    order: "CAST(year AS INTEGER), sort_order",
    entity: "history",
    fields: {
      year: { kind: "text", required: true, max: 10 },
      title: { kind: "text", required: true, max: 200 },
      description: { kind: "longtext", max: 5000, nullable: true },
      sort_order: { kind: "int" },
      is_published: { kind: "bool" },
    },
  },
};

const SETTINGS_LIMITS = new Map<string, number>([
  ["analytics_yandex", 30],
  ["analytics_google", 30],
  ["contact_email", 200],
  ["contact_phone", 100],
]);

function normalizeDateTime(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  let candidate = trimmed.replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(candidate)) candidate += ":00";
  if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) candidate += "T00:00:00";
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) return "";
  return candidate.slice(0, 19);
}

function coerce(resource: string, def: ResourceDef, body: Record<string, unknown>): {
  values: Record<string, unknown>;
  errors: Record<string, string>;
} {
  const values: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const [key, spec] of Object.entries(def.fields)) {
    const raw = body[key];
    if (spec.kind === "bool") {
      values[key] = bool(raw) ? 1 : 0;
      continue;
    }
    if (spec.kind === "int") {
      values[key] = raw === "" || raw === null || raw === undefined ? null : int(raw, 0);
      continue;
    }
    if (key === "age_categories") {
      const list = Array.isArray(raw)
        ? raw
        : typeof raw === "string"
          ? raw.split(/[\n,;]+/)
          : [];
      const cleaned = list
        .map((item) => String(item).trim())
        .filter(Boolean)
        .slice(0, 12)
        .map((item) => item.slice(0, 80));
      values[key] = JSON.stringify(cleaned);
      continue;
    }
    let value = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw).trim();
    if (spec.kind === "datetime") {
      if (!value) {
        if (spec.required) errors[key] = "Укажите дату и время.";
        values[key] = spec.nullable ? null : "";
        continue;
      }
      value = normalizeDateTime(value);
      if (!value) {
        errors[key] = "Укажите корректную дату и время.";
        values[key] = null;
        continue;
      }
    }
    if (spec.kind === "date" && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      errors[key] = "Укажите дату в формате ГГГГ-ММ-ДД.";
    }
    if (spec.kind === "time" && value && !/^\d{2}:\d{2}$/.test(value)) {
      errors[key] = "Укажите время в формате ЧЧ:ММ.";
    }
    if (spec.kind === "url" && value) {
      try {
        const parsed = new URL(value);
        if (!/^https?:$/.test(parsed.protocol)) throw new Error("bad protocol");
      } catch {
        errors[key] = "Ссылка должна начинаться с http:// или https://.";
      }
    }
    value = value.slice(0, spec.max ?? 2000);
    if (spec.required && !value) errors[key] = "Поле обязательно для заполнения.";
    if (spec.enum && value && !spec.enum.includes(value)) errors[key] = "Недопустимое значение.";
    values[key] = spec.nullable && !value ? null : value;
  }
  if (resource === "competitions") {
    const start = String(values.starts_on ?? "");
    const end = String(values.ends_on ?? "");
    if (start && end && end < start) errors.ends_on = "Дата окончания не может быть раньше начала.";
  }
  if (resource === "schedule") {
    const start = String(values.time_start ?? "");
    const end = String(values.time_end ?? "");
    if (start && end && end <= start) errors.time_end = "Время окончания должно быть позже начала.";
  }
  return { values, errors };
}

function ensureValid(errors: Record<string, string>): void {
  if (Object.keys(errors).length > 0) {
    throw new ApiProblem(400, "validation_failed", "Проверьте заполнение формы.", errors);
  }
}

async function listResource(env: Env, def: ResourceDef): Promise<Response> {
  const { results } = await env.DB.prepare(`SELECT * FROM ${def.table} ORDER BY ${def.order}`).all<
    Record<string, unknown>
  >();
  const mapped = (results ?? []).map((row) =>
    def.entity === "news"
      ? toNews(row)
      : def.entity === "competition"
        ? toCompetition(row)
        : toBooleanRow(row),
  );
  return ok({ items: mapped });
}

async function getResource(env: Env, def: ResourceDef, id: string): Promise<Response> {
  const row = await env.DB.prepare(`SELECT * FROM ${def.table} WHERE id = ?`).bind(id).first<Record<string, unknown>>();
  if (!row) return fail(404, "not_found", "Запись не найдена.");
  const item =
    def.entity === "news" ? toNews(row) : def.entity === "competition" ? toCompetition(row) : toBooleanRow(row);
  return ok({ item });
}

async function createResource(
  env: Env,
  user: SessionUser,
  key: string,
  def: ResourceDef,
  request: Request,
): Promise<Response> {
  const body = await readJson(request);
  const { values, errors } = coerce(key, def, body);
  ensureValid(errors);
  const id = uuid();
  if (def.slugFrom) {
    const requested = str(body.slug, 90);
    values.slug = await uniqueSlug(env.DB, key as "news" | "competitions", requested, str(values[def.slugFrom], 200));
  }
  const columns = Object.keys(values);
  const placeholders = columns.map(() => "?").join(", ");
  const sql = `INSERT INTO ${def.table} (id, ${columns.join(", ")}) VALUES (?, ${placeholders})`;
  await env.DB.prepare(sql)
    .bind(id, ...columns.map((column) => values[column]))
    .run();
  await audit(env, user, "create", def.entity, id, str(values.title ?? values.full_name ?? values.name, 120));
  const row = await env.DB.prepare(`SELECT * FROM ${def.table} WHERE id = ?`).bind(id).first<Record<string, unknown>>();
  const item =
    def.entity === "news" ? toNews(row ?? {}) : def.entity === "competition" ? toCompetition(row ?? {}) : toBooleanRow(row ?? {});
  return ok({ item });
}

async function updateResource(
  env: Env,
  user: SessionUser,
  key: string,
  def: ResourceDef,
  id: string,
  request: Request,
): Promise<Response> {
  const existing = await env.DB.prepare(`SELECT * FROM ${def.table} WHERE id = ?`).bind(id).first<Record<string, unknown>>();
  if (!existing) return fail(404, "not_found", "Запись не найдена.");
  const body = await readJson(request);
  const { values, errors } = coerce(key, def, body);
  ensureValid(errors);
  if (def.slugFrom) {
    const requested = str(body.slug, 90);
    values.slug = await uniqueSlug(
      env.DB,
      key as "news" | "competitions",
      requested,
      str(values[def.slugFrom], 200),
      id,
    );
  }
  values.updated_at = new Date().toISOString().slice(0, 19);
  const columns = Object.keys(values);
  const sql = `UPDATE ${def.table} SET ${columns.map((column) => `${column} = ?`).join(", ")} WHERE id = ?`;
  await env.DB.prepare(sql)
    .bind(...columns.map((column) => values[column]), id)
    .run();
  await audit(env, user, "update", def.entity, id, str(values.title ?? values.full_name ?? values.name, 120));
  const row = await env.DB.prepare(`SELECT * FROM ${def.table} WHERE id = ?`).bind(id).first<Record<string, unknown>>();
  const item =
    def.entity === "news" ? toNews(row ?? {}) : def.entity === "competition" ? toCompetition(row ?? {}) : toBooleanRow(row ?? {});
  return ok({ item });
}

async function deleteResource(
  env: Env,
  user: SessionUser,
  def: ResourceDef,
  id: string,
): Promise<Response> {
  const existing = await env.DB.prepare(`SELECT * FROM ${def.table} WHERE id = ?`).bind(id).first<Record<string, unknown>>();
  if (!existing) return fail(404, "not_found", "Запись не найдена.");
  await env.DB.prepare(`DELETE FROM ${def.table} WHERE id = ?`).bind(id).run();
  await audit(env, user, "delete", def.entity, id, str(existing.title ?? existing.full_name ?? existing.name, 120));
  return ok({ deleted: true });
}

export async function handleAdmin(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  const user = await requireUser(request, env);
  if (request.method !== "GET" && request.method !== "HEAD") assertMutationAllowed(request, env);
  const rest = url.pathname.replace(/^\/api\/admin\/?/, "");
  const [resource, id] = rest.split("/");
  if (!resource) return fail(404, "not_found", "Раздел не найден.");

  if (resource === "upload") return upload(request, env, user);
  if (resource === "stats") {
    if (request.method !== "GET") return fail(405, "method_not_allowed", "Метод не поддерживается.");
    return stats(env, user);
  }
  if (resource === "settings") {
    if (user.role !== "admin") return fail(403, "forbidden", "Настройки доступны только администратору.");
    if (request.method === "GET") {
      const { results } = await env.DB.prepare("SELECT key, value, updated_at FROM site_settings ORDER BY key").all();
      return ok({ items: results ?? [] });
    }
    if (request.method === "PUT") return updateSettings(env, user, request);
    return fail(405, "method_not_allowed", "Метод не поддерживается.");
  }
  if (resource === "staff") {
    if (user.role !== "admin") return fail(403, "forbidden", "Управление доступами доступно только администратору.");
    return staffRoutes(request, env, user, id);
  }
  if (resource === "messages") {
    return messagesRoutes(request, env, user, id);
  }
  if (resource === "audit") {
    if (user.role !== "admin") return fail(403, "forbidden", "Журнал доступен только администратору.");
    const { results } = await env.DB.prepare(
      "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100",
    ).all();
    return ok({ items: results ?? [] });
  }
  if (resource === "seo") {
    return seoRoutes(request, env, user, url);
  }
  if (resource === "demo") {
    if (user.role !== "admin") return fail(403, "forbidden", "Демо-данные может изменять только администратор.");
    if (request.method === "DELETE") {
      await removeDemo(env);
      await audit(env, user, "delete", "demo", null);
      return ok({ deleted: true });
    }
    if (request.method === "POST" && env.DEMO_DATA === "true") {
      await seedDemo(env);
      return ok({ seeded: true });
    }
    return fail(400, "demo_unavailable", "Демонстрационный режим отключён на этом окружении.");
  }
  if (resource === "export") {
    if (user.role !== "admin") return fail(403, "forbidden", "Экспорт доступен только администратору.");
    return exportData(env);
  }

  const def = RESOURCES[resource];
  if (!def) return fail(404, "not_found", "Раздел не найден.");
  if (request.method === "GET") {
    return id ? getResource(env, def, id) : listResource(env, def);
  }
  if (request.method === "POST" && !id) return createResource(env, user, resource, def, request);
  if ((request.method === "PUT" || request.method === "PATCH") && id) {
    return updateResource(env, user, resource, def, id, request);
  }
  if (request.method === "DELETE" && id) return deleteResource(env, user, def, id);
  return fail(405, "method_not_allowed", "Метод не поддерживается.");
}

async function stats(env: Env, user: SessionUser): Promise<Response> {
  const [news, competitions, coaches, achievements, gallery, messages, demo, settings, recent, verification] =
    await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS count FROM news").first<{ count: number }>(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM competitions").first<{ count: number }>(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM coaches").first<{ count: number }>(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM achievements").first<{ count: number }>(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM gallery_items").first<{ count: number }>(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM feedback_messages WHERE status = 'new'").first<{
        count: number;
      }>(),
      env.DB.prepare(
        "SELECT (SELECT COUNT(*) FROM news WHERE is_demo = 1) + (SELECT COUNT(*) FROM competitions WHERE is_demo = 1) + (SELECT COUNT(*) FROM gallery_items WHERE is_demo = 1) AS count",
      ).first<{ count: number }>(),
      env.DB.prepare(
        `SELECT key, value FROM site_settings WHERE value = '' AND key IN (
          'contact_phone','contact_address','work_hours',
          'enrollment_age','enrollment_status','enrollment_documents','enrollment_schedule',
          'official_unp','official_registration','official_legal_address','official_superior',
          'official_work_hours','official_reception','official_note'
        )`,
      ).all<{ key: string }>(),
      env.DB.prepare(
        "SELECT id, name, topic, submitted_at FROM feedback_messages WHERE status = 'new' ORDER BY submitted_at DESC LIMIT 5",
      ).all(),
      env.DB.prepare(
        "SELECT key, value FROM site_settings WHERE key IN ('contacts_verified','enrollment_verified','official_verified')",
      ).all<{ key: string; value: string }>(),
    ]);
  return ok({
    counts: {
      news: news?.count ?? 0,
      competitions: competitions?.count ?? 0,
      coaches: coaches?.count ?? 0,
      achievements: achievements?.count ?? 0,
      gallery: gallery?.count ?? 0,
      new_messages: messages?.count ?? 0,
      demo: demo?.count ?? 0,
    },
    empty_settings: (settings.results ?? []).map((row) => row.key),
    verification: Object.fromEntries((verification.results ?? []).map((row) => [row.key, row.value === "1"])),
    recent_messages: recent.results ?? [],
    role: user.role,
    demo_mode: env.DEMO_DATA === "true",
  });
}

const SETTINGS_ALLOWED = new Set([
  "org_full_name", "org_short_name", "org_sport", "org_city", "org_tagline", "logo_path",
  "about_lead", "about_text", "about_training", "about_halls",
  "history_intro", "history_note",
  "enrollment_age", "enrollment_status", "enrollment_documents", "enrollment_schedule",
  "enrollment_contact_name", "enrollment_contact_phone", "enrollment_contact_email",
  "contact_email", "contact_phone", "contact_address", "work_hours",
  "social_telegram", "social_vk", "social_instagram", "social_youtube",
  "official_unp", "official_registration", "official_legal_address", "official_superior",
  "official_work_hours", "official_reception", "official_note",
  "seo_title", "seo_description", "analytics_yandex", "analytics_google",
  "photo_disclaimer", "contacts_verified", "enrollment_verified", "official_verified",
]);

async function updateSettings(env: Env, user: SessionUser, request: Request): Promise<Response> {
  const body = await readJson(request);
  const values = body.values && typeof body.values === "object" ? (body.values as Record<string, unknown>) : body;
  const updates: [string, string][] = [];
  for (const [key, raw] of Object.entries(values)) {
    if (!SETTINGS_ALLOWED.has(key)) continue;
    if (typeof raw !== "string" && typeof raw !== "number" && typeof raw !== "boolean") continue;
    const value = String(raw).slice(0, SETTINGS_LIMITS.get(key) ?? 20_000);
    updates.push([key, value]);
  }
  if (updates.length === 0) return fail(400, "nothing_to_update", "Нет полей для сохранения.");
  await env.DB.batch(
    updates.map(([key, value]) =>
      env.DB.prepare(
        "UPDATE site_settings SET value = ?, updated_at = datetime('now') WHERE key = ?",
      ).bind(value, key),
    ),
  );
  await audit(env, user, "update", "settings", null, updates.map(([key]) => key).join(", ").slice(0, 400));
  return ok({ updated: updates.length });
}

async function messagesRoutes(
  request: Request,
  env: Env,
  user: SessionUser,
  id?: string,
): Promise<Response> {
  if (request.method === "GET" && !id) {
    const status = new URL(request.url).searchParams.get("status") ?? "";
    const where = ["new", "read", "archived"].includes(status) ? "WHERE status = ?" : "";
    const { results } = await env.DB.prepare(
      `SELECT * FROM feedback_messages ${where} ORDER BY submitted_at DESC LIMIT 200`,
    )
      .bind(...(where ? [status] : []))
      .all();
    return ok({ items: results ?? [] });
  }
  if ((request.method === "PATCH" || request.method === "PUT") && id) {
    const body = await readJson(request);
    const status = str(body.status, 20);
    if (!["new", "read", "archived"].includes(status)) {
      return fail(400, "invalid_status", "Недопустимый статус обращения.");
    }
    await env.DB.prepare("UPDATE feedback_messages SET status = ? WHERE id = ?").bind(status, id).run();
    await audit(env, user, "update", "feedback", id, status);
    return ok({ updated: true });
  }
  if (request.method === "DELETE" && id) {
    await env.DB.prepare("DELETE FROM feedback_messages WHERE id = ?").bind(id).run();
    await audit(env, user, "delete", "feedback", id);
    return ok({ deleted: true });
  }
  return fail(405, "method_not_allowed", "Метод не поддерживается.");
}

async function seoRoutes(
  request: Request,
  env: Env,
  user: SessionUser,
  url: URL,
): Promise<Response> {
  if (request.method === "GET") {
    const { results } = await env.DB.prepare("SELECT * FROM page_seo ORDER BY path").all<Record<string, unknown>>();
    return ok({ items: (results ?? []).map(toBooleanRow) });
  }
  if (request.method === "PUT") {
    const path = url.searchParams.get("path") ?? "";
    if (!path.startsWith("/")) return fail(400, "invalid_path", "Некорректный адрес страницы.");
    const body = await readJson(request);
    const title = str(body.title, 120);
    const description = str(body.description, 300);
    if (title.length < 5) return fail(400, "validation_failed", "Заголовок слишком короткий.", { title: "Минимум 5 символов." });
    if (description.length < 20) {
      return fail(400, "validation_failed", "Описание слишком короткое.", { description: "Минимум 20 символов." });
    }
    await env.DB.prepare(
      "UPDATE page_seo SET title = ?, description = ?, og_image = ?, is_indexable = ?, updated_at = datetime('now') WHERE path = ?",
    )
      .bind(title, description, nullableStr(body.og_image, 300), bool(body.is_indexable) ? 1 : 0, path)
      .run();
    if (path === "/") {
      await env.DB.batch([
        env.DB.prepare("UPDATE site_settings SET value = ?, updated_at = datetime('now') WHERE key = 'seo_title'").bind(title),
        env.DB.prepare("UPDATE site_settings SET value = ?, updated_at = datetime('now') WHERE key = 'seo_description'").bind(description),
      ]);
    }
    await audit(env, user, "update", "seo", path);
    return ok({ updated: true });
  }
  return fail(405, "method_not_allowed", "Метод не поддерживается.");
}

async function staffRoutes(
  request: Request,
  env: Env,
  user: SessionUser,
  id?: string,
): Promise<Response> {
  if (request.method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT id, email, display_name, role, is_active, created_at, last_login_at FROM staff ORDER BY created_at",
    ).all();
    return ok({ items: results ?? [] });
  }
  if (request.method === "POST") {
    const body = await readJson(request);
    const email = str(body.email, 200).toLowerCase();
    const name = str(body.display_name, 120);
    const role = str(body.role, 20);
    const password = typeof body.password === "string" ? body.password : "";
    const errors: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "Некорректная почта.";
    if (name.length < 2) errors.display_name = "Укажите имя.";
    if (!["admin", "editor"].includes(role)) errors.role = "Выберите роль.";
    if (password.length < 12 || !/\d/.test(password) || !/[A-Za-zА-Яа-я]/.test(password)) {
      errors.password = "Не менее 12 символов, буквы и цифры.";
    }
    if (Object.keys(errors).length > 0) return fail(400, "validation_failed", "Проверьте данные.", errors);
    const exists = await env.DB.prepare("SELECT id FROM staff WHERE email = ?").bind(email).first();
    if (exists) return fail(409, "email_exists", "Пользователь с такой почтой уже существует.");
    const staffId = uuid();
    const { hash, salt, iterations } = await hashPassword(password);
    await env.DB.prepare(
      "INSERT INTO staff (id, email, display_name, role, password_hash, password_salt, iterations, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)",
    )
      .bind(staffId, email, name, role, hash, salt, iterations)
      .run();
    await audit(env, user, "create", "staff", staffId, email);
    return ok({ id: staffId });
  }
  if ((request.method === "PATCH" || request.method === "PUT") && id) {
    const body = await readJson(request);
    const target = await env.DB.prepare("SELECT * FROM staff WHERE id = ?").bind(id).first<Record<string, unknown>>();
    if (!target) return fail(404, "not_found", "Пользователь не найден.");
    const name = str(body.display_name, 120) || String(target.display_name);
    const role = str(body.role, 20);
    const isActive = body.is_active === undefined ? Boolean(target.is_active) : bool(body.is_active);
    if (!["admin", "editor"].includes(role)) return fail(400, "invalid_role", "Недопустимая роль.");
    if (id === user.id && (!isActive || role !== "admin")) {
      return fail(400, "self_lock", "Нельзя лишить себя прав администратора.");
    }
    if (target.role === "admin" && (role !== "admin" || !isActive)) {
      const admins = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM staff WHERE role = 'admin' AND is_active = 1",
      ).first<{ count: number }>();
      if ((admins?.count ?? 0) <= 1) return fail(400, "last_admin", "В системе должен остаться хотя бы один администратор.");
    }
    const statements = [
      env.DB.prepare("UPDATE staff SET display_name = ?, role = ?, is_active = ? WHERE id = ?").bind(
        name,
        role,
        isActive ? 1 : 0,
        id,
      ),
    ];
    if (typeof body.password === "string" && body.password.length > 0) {
      if (body.password.length < 12 || !/\d/.test(body.password) || !/[A-Za-zА-Яа-я]/.test(body.password)) {
        return fail(400, "weak_password", "Пароль: не менее 12 символов, буквы и цифры.");
      }
      const { hash, salt, iterations } = await hashPassword(body.password);
      statements.push(
        env.DB.prepare("UPDATE staff SET password_hash = ?, password_salt = ?, iterations = ? WHERE id = ?").bind(
          hash,
          salt,
          iterations,
          id,
        ),
        env.DB.prepare("DELETE FROM sessions WHERE staff_id = ?").bind(id),
      );
    }
    if (!isActive) statements.push(env.DB.prepare("DELETE FROM sessions WHERE staff_id = ?").bind(id));
    await env.DB.batch(statements);
    await audit(env, user, "update", "staff", id, emailOf(target));
    return ok({ updated: true });
  }
  if (request.method === "DELETE" && id) {
    if (id === user.id) return fail(400, "self_delete", "Нельзя удалить собственную учётную запись.");
    const target = await env.DB.prepare("SELECT * FROM staff WHERE id = ?").bind(id).first<Record<string, unknown>>();
    if (!target) return fail(404, "not_found", "Пользователь не найден.");
    if (target.role === "admin") {
      const admins = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM staff WHERE role = 'admin' AND is_active = 1",
      ).first<{ count: number }>();
      if ((admins?.count ?? 0) <= 1) return fail(400, "last_admin", "Нельзя удалить последнего администратора.");
    }
    await env.DB.prepare("DELETE FROM staff WHERE id = ?").bind(id).run();
    await audit(env, user, "delete", "staff", id, emailOf(target));
    return ok({ deleted: true });
  }
  return fail(405, "method_not_allowed", "Метод не поддерживается.");
}

function emailOf(row: Record<string, unknown>): string {
  return typeof row.email === "string" ? row.email : "";
}

async function exportData(env: Env): Promise<Response> {
  const tables = [
    "site_settings",
    "news",
    "competitions",
    "coaches",
    "achievements",
    "gallery_items",
    "documents",
    "locations",
    "schedule_entries",
    "history_events",
    "page_seo",
  ];
  const data: Record<string, unknown> = { exported_at: new Date().toISOString(), version: 1 };
  for (const table of tables) {
    const { results } = await env.DB.prepare(`SELECT * FROM ${table}`).all();
    data[table] = results ?? [];
  }
  const headers = new Headers();
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Content-Disposition", `attachment; filename="osdushor-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  return new Response(JSON.stringify(data, null, 2), { headers });
}

