/**
 * Обложка соревнования из папки протоколов: выбор файла и загрузка в R2.
 * Одно правило для import-protocol.mjs и import-posters.mjs.
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const WRANGLER_CLI = fileURLToPath(new URL("../../node_modules/wrangler/bin/wrangler.js", import.meta.url));
const BUCKET = "osdushor-files";
const IMAGE = /\.(png|jpe?g|webp)$/i;
// Сканы протоколов и служебные картинки обложкой не ставим.
const SKIP = /рисунок|логотип|logo|смета|схема/i;
const MIME = { png: "image/png", webp: "image/webp", jpg: "image/jpeg" };

/**
 * Картинка папки: из `медиа/`, если её нет — из корня. Приоритет у плаката,
 * затем заставки, затем любой другой картинки (берём самую крупную).
 */
export function findCover(dir) {
  const media = ["медиа", "Медиа", "media"]
    .map((name) => join(dir, name))
    .find((path) => existsSync(path) && statSync(path).isDirectory());
  const root = media ?? dir;
  const images = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (!IMAGE.test(name) || SKIP.test(name) || !statSync(path).isFile()) continue;
    images.push({ name, path, size: statSync(path).size });
  }
  if (images.length === 0) return null;
  const rank = (name) => (/плакат|афиша|постер|poster/i.test(name) ? 0 : /заставка|обложка|cover/i.test(name) ? 1 : 2);
  images.sort((a, b) => rank(a.name) - rank(b.name) || b.size - a.size);
  return images[0];
}

/** Кладёт картинку в R2 рядом с остальными и возвращает ключ для poster_path. */
export function uploadCover(file, { remote }) {
  const ext = file.toLowerCase().endsWith(".png") ? "png" : file.toLowerCase().endsWith(".webp") ? "webp" : "jpg";
  const key = `images/${randomUUID()}.${ext}`;
  const args = [
    "r2",
    "object",
    "put",
    `${BUCKET}/${key}`,
    `--file=${file}`,
    `--content-type=${MIME[ext]}`,
    remote ? "--remote" : "--local",
  ];
  const result = spawnSync(process.execPath, [WRANGLER_CLI, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (result.status !== 0) throw new Error(`Не удалось загрузить ${file}`);
  return key;
}
