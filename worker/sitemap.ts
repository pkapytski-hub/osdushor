import { escapeHtml } from "./lib/http";

function xmlUrl(origin: string, path: string, lastmod?: string | null): string {
  return [
    "  <url>",
    `    <loc>${escapeHtml(`${origin}${path}`)}</loc>`,
    lastmod ? `    <lastmod>${escapeHtml(lastmod.slice(0, 10))}</lastmod>` : "",
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sitemap(env: Env, origin: string): Promise<Response> {
  const [pages, news, competitions] = await Promise.all([
    env.DB.prepare("SELECT path, updated_at FROM page_seo WHERE is_indexable = 1 ORDER BY path").all<{
      path: string;
      updated_at: string;
    }>(),
    env.DB.prepare(
      "SELECT slug, updated_at FROM news WHERE is_published = 1 AND is_demo = 0 ORDER BY published_at DESC LIMIT 1000",
    ).all<{ slug: string; updated_at: string }>(),
    env.DB.prepare(
      "SELECT slug, updated_at FROM competitions WHERE is_published = 1 AND is_demo = 0 ORDER BY starts_on DESC LIMIT 1000",
    ).all<{ slug: string; updated_at: string }>(),
  ]);
  const entries: string[] = [];
  for (const page of pages.results ?? []) entries.push(xmlUrl(origin, page.path, page.updated_at));
  for (const item of news.results ?? []) entries.push(xmlUrl(origin, `/novosti/${item.slug}`, item.updated_at));
  for (const item of competitions.results ?? []) entries.push(xmlUrl(origin, `/kalendar/${item.slug}`, item.updated_at));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function robots(origin: string): Response {
  const content = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /admin/",
    "Disallow: /api/",
    "Clean-param: utm_source&utm_medium&utm_campaign&utm_term&utm_content",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
