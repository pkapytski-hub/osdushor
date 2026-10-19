import {
  ApiProblem,
  constantTimeEqual,
  nowIso,
  parseCookies,
  sha256Hex,
  uuid,
} from "./http";

export const SESSION_COOKIE = "osdushor_sid";
const SESSION_HOURS = 12;
const PBKDF2_ITERATIONS = 210_000;

export type Role = "admin" | "editor";

export interface StaffUser {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  is_active: number;
}

export interface SessionUser extends StaffUser {
  session_token: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function hashPassword(
  password: string,
): Promise<{ hash: string; salt: string; iterations: number }> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = bytesToBase64(saltBytes);
  const hash = await derivePassword(password, salt, PBKDF2_ITERATIONS);
  return { hash, salt, iterations: PBKDF2_ITERATIONS };
}

export async function verifyPassword(
  password: string,
  hash: string,
  salt: string,
  iterations: number,
): Promise<boolean> {
  const candidate = await derivePassword(password, salt, iterations);
  return constantTimeEqual(candidate, hash);
}

async function derivePassword(password: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: base64ToBytes(salt),
      iterations,
    },
    key,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

export async function createSession(
  env: Env,
  staffId: string,
  userAgent: string,
): Promise<{ token: string; expiresAt: string; cookie: string }> {
  const token = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  const tokenHash = await sha256Hex(token);
  const expires = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  await env.DB.prepare(
    "INSERT INTO sessions (token_hash, staff_id, expires_at, user_agent) VALUES (?, ?, ?, ?)",
  )
    .bind(tokenHash, staffId, expires.toISOString(), userAgent.slice(0, 250))
    .run();
  return {
    token,
    expiresAt: expires.toISOString(),
    cookie: sessionCookie(token, expires, env),
  };
}

function sessionCookie(token: string, expires: Date, env: Env): string {
  const secure = env.ENVIRONMENT === "production" || env.APP_ORIGIN?.startsWith("https://");
  return [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expires.toUTCString()}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function getSessionUser(request: Request, env: Env): Promise<SessionUser | null> {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT s.token_hash, s.expires_at, u.id, u.email, u.display_name, u.role, u.is_active
     FROM sessions s JOIN staff u ON u.id = s.staff_id
     WHERE s.token_hash = ?`,
  )
    .bind(tokenHash)
    .first<{
      token_hash: string;
      expires_at: string;
      id: string;
      email: string;
      display_name: string;
      role: Role;
      is_active: number;
    }>();
  if (!row) return null;
  if (row.expires_at <= nowIso() || !row.is_active) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    role: row.role,
    is_active: row.is_active,
    session_token: tokenHash,
  };
}

export async function requireUser(request: Request, env: Env): Promise<SessionUser> {
  const user = await getSessionUser(request, env);
  if (!user) throw new ApiProblem(401, "login_required", "Требуется вход в панель управления.");
  return user;
}

export async function requireAdmin(request: Request, env: Env): Promise<SessionUser> {
  const user = await requireUser(request, env);
  if (user.role !== "admin") {
    throw new ApiProblem(403, "forbidden", "Недостаточно прав для этого действия.");
  }
  return user;
}

export async function destroySession(request: Request, env: Env): Promise<void> {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return;
  await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?")
    .bind(await sha256Hex(token))
    .run();
}

export async function staffCount(env: Env): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM staff").first<{ count: number }>();
  return row?.count ?? 0;
}

export async function audit(
  env: Env,
  user: { id: string; email: string },
  action: string,
  entity: string,
  entityId: string | null,
  details?: string,
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO audit_log (id, actor_id, actor_email, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(uuid(), user.id, user.email, action, entity, entityId, details?.slice(0, 500) ?? null)
    .run();
}
