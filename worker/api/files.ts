import { fail, ok } from "../lib/http";
import type { SessionUser } from "../lib/auth";
import { audit } from "../lib/auth";

const IMAGE_LIMIT = 8 * 1024 * 1024;
const PDF_LIMIT = 20 * 1024 * 1024;

type Detected = { ext: string; mime: string; kind: "image" | "document" } | null;

function detect(bytes: Uint8Array): Detected {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg", kind: "image" };
  }
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return { ext: "png", mime: "image/png", kind: "image" };
  }
  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...bytes.slice(offset, offset + length));
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    return { ext: "webp", mime: "image/webp", kind: "image" };
  }
  if (ascii(4, 4) === "ftyp" && (ascii(8, 4) === "avif" || ascii(8, 4) === "avis")) {
    return { ext: "avif", mime: "image/avif", kind: "image" };
  }
  if (ascii(0, 5) === "%PDF-") {
    return { ext: "pdf", mime: "application/pdf", kind: "document" };
  }
  return null;
}

export async function upload(request: Request, env: Env, user: SessionUser): Promise<Response> {
  if (request.method !== "POST") return fail(405, "method_not_allowed", "Метод не поддерживается.");
  if (!env.FILES) {
    return fail(503, "storage_unavailable", "Хранилище файлов не подключено. Обратитесь к администратору.");
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return fail(415, "invalid_content_type", "Загрузите файл через форму.");
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "invalid_form", "Не удалось прочитать файл.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail(400, "file_missing", "Файл не выбран.");
  if (file.size === 0) return fail(400, "file_empty", "Файл пустой.");
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const detected = detect(head);
  if (!detected) {
    return fail(415, "unsupported_type", "Допустимы изображения JPG, PNG, WebP, AVIF и документы PDF.");
  }
  const limit = detected.kind === "image" ? IMAGE_LIMIT : PDF_LIMIT;
  if (file.size > limit) {
    const mb = Math.round(limit / 1024 / 1024);
    return fail(413, "file_too_large", `Размер файла не должен превышать ${mb} МБ.`);
  }
  const key = `${detected.kind === "image" ? "images" : "documents"}/${crypto.randomUUID()}.${detected.ext}`;
  const body = await file.arrayBuffer();
  await env.FILES.put(key, body, {
    httpMetadata: {
      contentType: detected.mime,
      cacheControl: detected.kind === "image" ? "public, max-age=31536000, immutable" : "public, max-age=3600",
    },
  });
  await audit(env, user, "upload", detected.kind === "image" ? "image" : "document", key, `${file.name} · ${file.size} B`);
  return ok({ path: key, url: `/api/files/${key}`, size: file.size, mime: detected.mime });
}

const KEY_RE = /^(images|documents)\/[a-z0-9-]+\.(jpg|jpeg|png|webp|avif|pdf)$/;

export async function serveFile(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return fail(405, "method_not_allowed", "Метод не поддерживается.");
  }
  if (!env.FILES) return fail(503, "storage_unavailable", "Хранилище файлов не подключено.");
  const key = decodeURIComponent(url.pathname.replace(/^\/api\/files\//, ""));
  if (!KEY_RE.test(key)) return fail(404, "not_found", "Файл не найден.");
  const object = await env.FILES.get(key);
  if (!object) return fail(404, "not_found", "Файл не найден.");
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", key.startsWith("images/") ? "public, max-age=31536000, immutable" : "public, max-age=3600");
  headers.set("X-Content-Type-Options", "nosniff");
  if (object.httpEtag && request.headers.get("if-none-match") === object.httpEtag) {
    return new Response(null, { status: 304, headers });
  }
  if (key.endsWith(".pdf")) {
    headers.set("Content-Disposition", `inline; filename="${key.split("/")[1]}"`);
  }
  return new Response(request.method === "HEAD" ? null : object.body, { headers });
}
