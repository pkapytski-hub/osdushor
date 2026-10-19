import { ApiProblem, fail, isApiProblem, ok } from "./lib/http";
import { ensureSchema } from "./lib/bootstrap";
import {
  getCompetition,
  getNews,
  health,
  listAchievements,
  listCoaches,
  listCompetitions,
  listDocuments,
  listGallery,
  listHistory,
  listLocations,
  listNews,
  listResults,
  listSchedule,
  publicSettings,
  submitFeedback,
} from "./api/public";
import { changePassword, login, logout, me, setup } from "./api/auth";
import { handleAdmin } from "./api/admin";
import { serveFile } from "./api/files";
import { serveSpa } from "./meta";
import { robots, sitemap } from "./sitemap";

function hasFileExtension(pathname: string): boolean {
  const last = pathname.split("/").pop() ?? "";
  return last.includes(".");
}

// Vite складывает в /assets только сгенерированные файлы с хешем содержимого
// в имени. Такие файлы можно кешировать на год вперёд: при изменении кода
// меняется имя, а уже скачанные версии остаются валидными.
const HASHED_ASSET_PATH = /^\/assets\/[^/]+-[A-Za-z0-9_-]{6,}\.[a-z0-9]+$/i;
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

async function serveAsset(request: Request, assets: Fetcher, pathname: string): Promise<Response> {
  const response = await assets.fetch(request);
  const contentType = response.headers.get("Content-Type") ?? "";
  // Несуществующий файл отдаётся SPA-фолбэком с кодом 200 — такой HTML нельзя
  // кешировать на год, иначе браузер надолго запомнит 404-путь.
  const cacheable =
    (response.status === 200 || response.status === 304) && !contentType.startsWith("text/html");
  if (!cacheable || !HASHED_ASSET_PATH.test(pathname)) return response;
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", IMMUTABLE_CACHE);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function apiRoute(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;
  const method = request.method;
  const segments = path.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const head = segments[0] ?? "";
  const rest = segments.slice(1);
  const isRead = method === "GET" || method === "HEAD";

  if (head === "health") return health(env);
  if (head === "files") return serveFile(request, env, url);
  if (head === "admin") return handleAdmin(request, env, url);
  if (head === "auth") {
    const action = rest[0] ?? "";
    if (action === "me" && isRead) return me(request, env);
    if (action === "setup" && method === "POST") return setup(request, env);
    if (action === "login" && method === "POST") return login(request, env);
    if (action === "logout" && method === "POST") return logout(request, env);
    if (action === "change-password" && method === "POST") return changePassword(request, env);
    return fail(404, "not_found", "Действие не найдено.");
  }
  if (head === "settings" && isRead) return publicSettings(env);
  if (head === "news") {
    if (rest.length === 0 && isRead) return listNews(env, url);
    if (rest.length === 1 && isRead) return getNews(env, decodeURIComponent(rest[0]));
    return fail(405, "method_not_allowed", "Метод не поддерживается.");
  }
  if (head === "competitions") {
    if (rest.length === 0 && isRead) return listCompetitions(env, url);
    if (rest.length === 1 && isRead) return getCompetition(env, decodeURIComponent(rest[0]));
    return fail(405, "method_not_allowed", "Метод не поддерживается.");
  }
  if (head === "coaches" && isRead) return listCoaches(env);
  if (head === "achievements" && isRead) return listAchievements(env, url);
  if (head === "gallery" && isRead) return listGallery(env, url);
  if (head === "documents" && isRead) return listDocuments(env, url);
  if (head === "locations" && isRead) return listLocations(env);
  if (head === "schedule" && isRead) return listSchedule(env);
  if (head === "history" && isRead) return listHistory(env);
  if (head === "results" && isRead) return listResults(env);
  if (head === "feedback") {
    if (method === "POST") return submitFeedback(request, env);
    return fail(405, "method_not_allowed", "Отправьте форму методом POST.");
  }
  return fail(404, "not_found", "API-метод не найден.");
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path.startsWith("/api/")) {
    return apiRoute(request, env, url);
  }
  if (path === "/sitemap.xml") return sitemap(env, url.origin);
  if (path === "/robots.txt") return robots(url.origin);
  if (path === "/healthz") return ok({ status: "ok" });
  if (hasFileExtension(path)) {
    if (!env.ASSETS) return fail(503, "not_deployed", "Статические файлы не подключены.");
    return serveAsset(request, env.ASSETS, path);
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return fail(405, "method_not_allowed", "Метод не поддерживается.");
  }
  return serveSpa(request, env, url);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = crypto.randomUUID().slice(0, 8);
    try {
      await ensureSchema(env);
      return await route(request, env);
    } catch (error) {
      if (isApiProblem(error)) {
        return fail(error.status, error.code, error.message, error.fields);
      }
      if (error instanceof ApiProblem) {
        return fail(error.status, error.code, error.message, error.fields);
      }
      console.error(`request_failed request_id=${requestId}`, error);
      return fail(500, "internal_error", "Внутренняя ошибка сервера. Попробуйте позже.");
    }
  },
} satisfies ExportedHandler<Env>;
