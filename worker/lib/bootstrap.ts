import schemaSql from "../schema.sql";
import { seedDemo } from "../demo";

let schemaPromise: Promise<void> | null = null;
let demoPromise: Promise<void> | null = null;

export async function ensureSchema(env: Env): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      // D1 exec разбивает SQL по строкам, поэтому применяем statements через batch.
      const sql = schemaSql.replace(/^\s*--.*$/gm, "").replace(/^\s*PRAGMA[^;]+;/gim, "");
      const statements = sql
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((statement) => env.DB.prepare(statement));
      await env.DB.batch(statements);
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
  if (env.DEMO_DATA === "true" && !demoPromise) {
    demoPromise = seedDemo(env).catch((error) => {
      demoPromise = null;
      console.error("demo_seed_failed", error);
    });
  }
  if (demoPromise) await demoPromise;
}
