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
      // Колонка появилась позже самой таблицы: на уже развёрнутой базе
      // добавляем её отдельно, ошибку «duplicate column» просто пропускаем.
      try {
        await env.DB.prepare("ALTER TABLE tournament_participants ADD COLUMN league INTEGER").run();
      } catch {
        /* колонка уже есть */
      }
      // Отметки технического поражения появились вместе с правилом «0 очков».
      for (const column of ["tech_loss_a", "tech_loss_b"]) {
        try {
          await env.DB.prepare(
            `ALTER TABLE tournament_matches ADD COLUMN ${column} INTEGER NOT NULL DEFAULT 0`,
          ).run();
        } catch {
          /* колонка уже есть */
        }
      }
      // Длину встречи (3, 5 или 7 партий) стали выбирать в настройках турнира.
      try {
        await env.DB.prepare("ALTER TABLE tournaments ADD COLUMN best_of INTEGER NOT NULL DEFAULT 5").run();
      } catch {
        /* колонка уже есть */
      }
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
