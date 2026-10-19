/// <reference types="@cloudflare/workers-types" />

declare module "*.sql" {
  const sql: string;
  export default sql;
}

interface Env {
  DB: D1Database;
  FILES?: R2Bucket;
  ASSETS?: Fetcher;
  APP_ORIGIN?: string;
  SETUP_TOKEN?: string;
  DEMO_DATA?: string;
  ENVIRONMENT?: string;
  /** Публичный sitekey Turnstile (открытая часть, лежит в [vars]). */
  TURNSTILE_SITEKEY?: string;
  /** Секретный ключ Turnstile — только через `wrangler secret put TURNSTILE_SECRET`. */
  TURNSTILE_SECRET?: string;
}
