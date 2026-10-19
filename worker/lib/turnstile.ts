import { clientIp } from "./http";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Проверяет токен Turnstile на стороне сервера.
 *
 * Если секрет не сконфигурирован, проверка пропускается (иначе сломается
 * локальная разработка), но в лог пишется предупреждение — на проде секрет
 * обязан быть задан (`wrangler secret put TURNSTILE_SECRET`).
 */
export async function verifyTurnstile(env: Env, request: Request, token: string): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET?.trim();
  if (!secret) {
    console.warn("turnstile_secret_missing: проверка формы обратной связи отключена");
    return true;
  }
  if (!token) return false;

  const form = new URLSearchParams({ secret, response: token });
  const remoteIp = clientIp(request);
  if (remoteIp && remoteIp !== "local") form.set("remoteip", remoteIp);

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    if (!response.ok) {
      console.error(`turnstile_siteverify_failed status=${response.status}`);
      return false;
    }
    const data = (await response.json()) as { success?: boolean };
    return data.success === true;
  } catch (error) {
    console.error("turnstile_siteverify_error", error);
    return false;
  }
}
