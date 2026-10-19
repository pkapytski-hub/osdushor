export interface ApiErrorShape {
  ok: false;
  error: string;
  message: string;
  fields?: Record<string, string>;
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
};

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", headers.get("Cache-Control") ?? "no-store");
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) headers.set(key, value);
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function fail(
  status: number,
  error: string,
  message: string,
  fields?: Record<string, string>,
): Response {
  const body: ApiErrorShape = { ok: false, error, message };
  if (fields && Object.keys(fields).length > 0) body.fields = fields;
  return json(body, { status });
}

export function ok(data: Record<string, unknown> = {}): Response {
  return json({ ok: true, ...data });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) {
    throw new ApiProblem(415, "invalid_content_type", "Ожидается JSON-запрос.");
  }
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > 2_000_000) {
    throw new ApiProblem(413, "payload_too_large", "Слишком большой объём данных.");
  }
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    throw new ApiProblem(400, "invalid_json", "Не удалось прочитать данные запроса.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ApiProblem(400, "invalid_json", "Неверный формат данных.");
  }
  return parsed as Record<string, unknown>;
}

export class ApiProblem extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiProblem";
  }
}

export function isApiProblem(error: unknown): error is ApiProblem {
  return error instanceof ApiProblem;
}

export function str(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function nullableStr(value: unknown, max = 1000): string | null {
  const result = str(value, max);
  return result.length > 0 ? result : null;
}

export function bool(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

export function int(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function uuid(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local"
  );
}

export async function ipHash(request: Request): Promise<string> {
  return (await sha256Hex(`osdushor:${clientIp(request)}`)).slice(0, 32);
}

export function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get("cookie") ?? "";
  const result: Record<string, string> = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    if (!key) continue;
    result[key] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return result;
}

export function isSameOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url).origin;
  const allowed = new Set([requestOrigin]);
  if (env.APP_ORIGIN) allowed.add(env.APP_ORIGIN.replace(/\/$/, ""));
  if (!origin) {
    // Старые клиенты без Origin допускаются только для безопасных методов.
    return request.method === "GET" || request.method === "HEAD";
  }
  return allowed.has(origin.replace(/\/$/, ""));
}

export function assertMutationAllowed(request: Request, env: Env): void {
  if (!isSameOrigin(request, env)) {
    throw new ApiProblem(403, "origin_rejected", "Запрос отклонён: недопустимый источник.");
  }
  if (request.headers.get("x-csrf") !== "1") {
    throw new ApiProblem(403, "csrf_rejected", "Запрос отклонён: отсутствует защитный заголовок.");
  }
}

export function securityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function rateLimit(
  db: D1Database,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000).toISOString();
  const row = await db
    .prepare("SELECT count, reset_at FROM rate_limits WHERE key = ?")
    .bind(key)
    .first<{ count: number; reset_at: string }>();
  if (!row || row.reset_at <= now.toISOString()) {
    await db
      .prepare(
        "INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at",
      )
      .bind(key, resetAt)
      .run();
    return true;
  }
  if (row.count >= limit) return false;
  await db.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").bind(key).run();
  return true;
}
