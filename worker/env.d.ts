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
}
