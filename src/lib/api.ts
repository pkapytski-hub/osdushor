import type {
  Achievement,
  AdminStats,
  AuditEntry,
  Coach,
  Competition,
  DocumentItem,
  FeedbackMessage,
  GalleryItem,
  HistoryEvent,
  ListResult,
  Location,
  MeInfo,
  NewsItem,
  PageSeo,
  ScheduleEntry,
  SiteSettings,
  StaffMember,
} from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number = 0,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const NETWORK_MESSAGE = "Не удалось связаться с сервером. Проверьте подключение и повторите попытку.";
const GENERIC_MESSAGE = "Запрос не выполнен. Проверьте данные и повторите попытку.";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") headers.set("X-CSRF", "1");
  if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, credentials: "same-origin" });
  } catch (error) {
    if ((init.signal as AbortSignal | undefined)?.aborted) throw error;
    throw new ApiError(NETWORK_MESSAGE, "network_error");
  }
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  const body = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  if (!response.ok || body?.ok === false) {
    const message =
      typeof body?.message === "string" && body.message.length > 0
        ? body.message
        : response.status === 401 || response.status === 403
          ? "Доступ не подтверждён. Войдите в панель управления."
          : GENERIC_MESSAGE;
    const fields =
      body?.fields && typeof body.fields === "object"
        ? (body.fields as Record<string, string>)
        : {};
    throw new ApiError(
      message,
      typeof body?.error === "string" ? body.error : "request_failed",
      response.status,
      fields,
    );
  }
  return data as T;
}

function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const result = search.toString();
  return result ? `?${result}` : "";
}

const get = <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal });
const mutate = <T>(path: string, method: string, payload?: unknown) =>
  request<T>(path, {
    method,
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });

export interface SettingsResponse {
  settings: SiteSettings;
  /** Открытый sitekey Turnstile для формы обратной связи; пусто, если защита выключена. */
  turnstile_sitekey?: string;
}

export const api = {
  public: {
    settings: (signal?: AbortSignal) => get<SettingsResponse>("/api/settings", signal),
    news: (params: { category?: string; q?: string; limit?: number; offset?: number }, signal?: AbortSignal) =>
      get<ListResult<NewsItem>>(`/api/news${query(params)}`, signal),
    newsItem: (slug: string, signal?: AbortSignal) =>
      get<{ item: NewsItem }>(`/api/news/${encodeURIComponent(slug)}`, signal),
    competitions: (
      params: { status?: string; q?: string; from?: string; to?: string; age?: string; sort?: string; limit?: number; offset?: number },
      signal?: AbortSignal,
    ) => get<ListResult<Competition>>(`/api/competitions${query(params)}`, signal),
    competition: (slug: string, signal?: AbortSignal) =>
      get<{ item: Competition }>(`/api/competitions/${encodeURIComponent(slug)}`, signal),
    coaches: (signal?: AbortSignal) => get<{ items: Coach[] }>("/api/coaches", signal),
    achievements: (params: { level?: string; year?: string }, signal?: AbortSignal) =>
      get<{ items: Achievement[] }>(`/api/achievements${query(params)}`, signal),
    gallery: (params: { category?: string }, signal?: AbortSignal) =>
      get<{ items: GalleryItem[] }>(`/api/gallery${query(params)}`, signal),
    documents: (params: { category?: string }, signal?: AbortSignal) =>
      get<{ items: DocumentItem[] }>(`/api/documents${query(params)}`, signal),
    locations: (signal?: AbortSignal) => get<{ items: Location[] }>("/api/locations", signal),
    schedule: (signal?: AbortSignal) => get<{ items: ScheduleEntry[] }>("/api/schedule", signal),
    history: (signal?: AbortSignal) => get<{ items: HistoryEvent[] }>("/api/history", signal),
    results: (signal?: AbortSignal) => get<{ items: Competition[] }>("/api/results", signal),
    feedback: (payload: Record<string, unknown>) =>
      mutate<{ accepted: boolean; message?: string }>("/api/feedback", "POST", payload),
  },
  auth: {
    me: (signal?: AbortSignal) => get<MeInfo>("/api/auth/me", signal),
    setup: (payload: { token: string; name: string; email: string; password: string }) =>
      mutate<{ user: MeInfo["user"] }>("/api/auth/setup", "POST", payload),
    login: (payload: { email: string; password: string }) =>
      mutate<{ user: MeInfo["user"] }>("/api/auth/login", "POST", payload),
    logout: () => mutate<{ logged_out: boolean }>("/api/auth/logout", "POST"),
    changePassword: (payload: { current_password: string; new_password: string }) =>
      mutate<{ message: string }>("/api/auth/change-password", "POST", payload),
  },
  admin: {
    stats: (signal?: AbortSignal) => get<AdminStats>("/api/admin/stats", signal),
    list: <T>(resource: string, signal?: AbortSignal) =>
      get<{ items: T[] }>(`/api/admin/${resource}`, signal),
    item: <T>(resource: string, id: string, signal?: AbortSignal) =>
      get<{ item: T }>(`/api/admin/${resource}/${id}`, signal),
    create: <T>(resource: string, payload: unknown) =>
      mutate<{ item: T }>(`/api/admin/${resource}`, "POST", payload),
    update: <T>(resource: string, id: string, payload: unknown) =>
      mutate<{ item: T }>(`/api/admin/${resource}/${id}`, "PUT", payload),
    remove: (resource: string, id: string) =>
      mutate<{ deleted: boolean }>(`/api/admin/${resource}/${id}`, "DELETE"),
    upload: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return request<{ path: string; url: string; size: number; mime: string }>("/api/admin/upload", {
        method: "POST",
        body: form,
      });
    },
    settings: (signal?: AbortSignal) =>
      get<{ items: { key: string; value: string; updated_at: string }[] }>("/api/admin/settings", signal),
    saveSettings: (values: SiteSettings) =>
      mutate<{ updated: number }>("/api/admin/settings", "PUT", { values }),
    seo: (signal?: AbortSignal) => get<{ items: PageSeo[] }>("/api/admin/seo", signal),
    saveSeo: (path: string, payload: Partial<PageSeo>) =>
      mutate<{ updated: boolean }>(`/api/admin/seo${query({ path })}`, "PUT", payload),
    staff: (signal?: AbortSignal) => get<{ items: StaffMember[] }>("/api/admin/staff", signal),
    createStaff: (payload: unknown) => mutate<{ id: string }>("/api/admin/staff", "POST", payload),
    updateStaff: (id: string, payload: unknown) =>
      mutate<{ updated: boolean }>(`/api/admin/staff/${id}`, "PATCH", payload),
    removeStaff: (id: string) => mutate<{ deleted: boolean }>(`/api/admin/staff/${id}`, "DELETE"),
    messages: (status?: string, signal?: AbortSignal) =>
      get<{ items: FeedbackMessage[] }>(`/api/admin/messages${query({ status })}`, signal),
    updateMessage: (id: string, status: string) =>
      mutate<{ updated: boolean }>(`/api/admin/messages/${id}`, "PATCH", { status }),
    removeMessage: (id: string) => mutate<{ deleted: boolean }>(`/api/admin/messages/${id}`, "DELETE"),
    audit: (signal?: AbortSignal) => get<{ items: AuditEntry[] }>("/api/admin/audit", signal),
    demoDelete: () => mutate<{ deleted: boolean }>("/api/admin/demo", "DELETE"),
    exportUrl: "/api/admin/export",
  },
};

export function fileUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (/^https?:\/\//.test(path) || path.startsWith("/")) return path;
  return `/api/files/${path.split("/").map(encodeURIComponent).join("/")}`;
}
