import {
  ApiProblem,
  assertMutationAllowed,
  constantTimeEqual,
  fail,
  ipHash,
  ok,
  rateLimit,
  readJson,
  str,
} from "../lib/http";
import {
  audit,
  clearSessionCookie,
  createSession,
  destroySession,
  getSessionUser,
  hashPassword,
  requireUser,
  staffCount,
  verifyPassword,
} from "../lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function passwordProblem(password: string): string | null {
  if (password.length < 12) return "Пароль должен содержать не менее 12 символов.";
  if (!/[A-Za-zА-Яа-я]/.test(password) || !/\d/.test(password)) {
    return "Пароль должен содержать буквы и цифры.";
  }
  return null;
}

function withCookie(response: Response, cookie: string): Response {
  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", cookie);
  return new Response(response.body, { status: response.status, headers });
}

function publicUser(user: { id: string; email: string; display_name: string; role: string }) {
  return { id: user.id, email: user.email, name: user.display_name, role: user.role };
}

export async function me(request: Request, env: Env): Promise<Response> {
  const [user, count] = await Promise.all([getSessionUser(request, env), staffCount(env)]);
  return ok({
    user: user ? publicUser(user) : null,
    setup_required: count === 0,
    setup_available: Boolean(env.SETUP_TOKEN),
    demo_mode: env.DEMO_DATA === "true",
  });
}

export async function setup(request: Request, env: Env): Promise<Response> {
  assertMutationAllowed(request, env);
  const count = await staffCount(env);
  if (count > 0) {
    return fail(409, "setup_completed", "Первичная настройка уже выполнена. Войдите в панель.");
  }
  if (!env.SETUP_TOKEN) {
    return fail(503, "setup_unavailable", "Не задан SETUP_TOKEN. Настройте секрет на сервере.");
  }
  const body = await readJson(request);
  const token = str(request.headers.get("x-setup-token") ?? body.token, 200);
  if (!constantTimeEqual(token, env.SETUP_TOKEN)) {
    return fail(403, "setup_token_invalid", "Неверный код первичной настройки.");
  }
  const email = str(body.email, 200).toLowerCase();
  const name = str(body.name, 120);
  const password = typeof body.password === "string" ? body.password : "";
  const fields: Record<string, string> = {};
  if (!EMAIL_RE.test(email)) fields.email = "Укажите корректный адрес электронной почты.";
  if (name.length < 2) fields.name = "Укажите имя.";
  const passwordIssue = passwordProblem(password);
  if (passwordIssue) fields.password = passwordIssue;
  if (Object.keys(fields).length > 0) {
    return fail(400, "validation_failed", "Проверьте данные администратора.", fields);
  }
  const id = crypto.randomUUID();
  const { hash, salt, iterations } = await hashPassword(password);
  await env.DB.prepare(
    `INSERT INTO staff (id, email, display_name, role, password_hash, password_salt, iterations, is_active)
     VALUES (?, ?, ?, 'admin', ?, ?, ?, 1)`,
  )
    .bind(id, email, name, hash, salt, iterations)
    .run();
  const session = await createSession(env, id, request.headers.get("user-agent") ?? "");
  await audit(env, { id, email }, "setup", "staff", id, "Создан первый администратор");
  return withCookie(
    ok({ user: { id, email, name, role: "admin" }, cookie_ready: true }),
    session.cookie,
  );
}

export async function login(request: Request, env: Env): Promise<Response> {
  assertMutationAllowed(request, env);
  const body = await readJson(request);
  const email = str(body.email, 200).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  if (!EMAIL_RE.test(email) || password.length === 0) {
    return fail(400, "validation_failed", "Укажите почту и пароль.");
  }
  const ip = await ipHash(request);
  const [ipAllowed, accountAllowed] = await Promise.all([
    rateLimit(env.DB, `login-ip:${ip}`, 30, 15 * 60),
    rateLimit(env.DB, `login-account:${email}`, 10, 15 * 60),
  ]);
  if (!ipAllowed || !accountAllowed) {
    return fail(429, "rate_limited", "Слишком много попыток входа. Повторите через 15 минут.");
  }
  const user = await env.DB.prepare(
    "SELECT id, email, display_name, role, password_hash, password_salt, iterations, is_active FROM staff WHERE email = ?",
  )
    .bind(email)
    .first<{
      id: string;
      email: string;
      display_name: string;
      role: string;
      password_hash: string;
      password_salt: string;
      iterations: number;
      is_active: number;
    }>();
  const valid =
    user &&
    user.is_active === 1 &&
    (await verifyPassword(password, user.password_hash, user.password_salt, user.iterations));
  if (!user || !valid) {
    return fail(401, "invalid_credentials", "Неверная почта или пароль.");
  }
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
  await env.DB.prepare("UPDATE staff SET last_login_at = datetime('now') WHERE id = ?")
    .bind(user.id)
    .run();
  const session = await createSession(env, user.id, request.headers.get("user-agent") ?? "");
  await audit(env, user, "login", "session", null);
  return withCookie(ok({ user: publicUser(user) }), session.cookie);
}

export async function logout(request: Request, env: Env): Promise<Response> {
  assertMutationAllowed(request, env);
  const user = await getSessionUser(request, env);
  await destroySession(request, env);
  if (user) await audit(env, user, "logout", "session", null);
  return withCookie(ok({ logged_out: true }), clearSessionCookie());
}

export async function changePassword(request: Request, env: Env): Promise<Response> {
  assertMutationAllowed(request, env);
  const user = await requireUser(request, env);
  const body = await readJson(request);
  const current = typeof body.current_password === "string" ? body.current_password : "";
  const next = typeof body.new_password === "string" ? body.new_password : "";
  const issue = passwordProblem(next);
  if (issue) return fail(400, "validation_failed", issue, { new_password: issue });
  const row = await env.DB.prepare(
    "SELECT password_hash, password_salt, iterations FROM staff WHERE id = ?",
  )
    .bind(user.id)
    .first<{ password_hash: string; password_salt: string; iterations: number }>();
  if (!row || !(await verifyPassword(current, row.password_hash, row.password_salt, row.iterations))) {
    return fail(400, "current_password_invalid", "Текущий пароль указан неверно.");
  }
  const { hash, salt, iterations } = await hashPassword(next);
  await env.DB.batch([
    env.DB.prepare("UPDATE staff SET password_hash = ?, password_salt = ?, iterations = ? WHERE id = ?")
      .bind(hash, salt, iterations, user.id),
    env.DB.prepare("DELETE FROM sessions WHERE staff_id = ?").bind(user.id),
  ]);
  const session = await createSession(env, user.id, request.headers.get("user-agent") ?? "");
  await audit(env, user, "password_change", "staff", user.id);
  return withCookie(
    ok({ message: "Пароль изменён. Остальные сеансы завершены." }),
    session.cookie,
  );
}

export async function sessionGate(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  return ok({ user: publicUser(user) });
}

export function methodNotAllowed(): Response {
  return fail(405, "method_not_allowed", "Метод не поддерживается.");
}

export function invalidCredentials(): ApiProblem {
  return new ApiProblem(401, "invalid_credentials", "Неверная почта или пароль.");
}
