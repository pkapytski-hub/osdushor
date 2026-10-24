import { escapeHtml } from "./lib/http";

interface SeoData {
  title: string;
  description: string;
  image: string;
  type: "website" | "article";
  canonical: string;
  noindex: boolean;
  jsonLd: Record<string, unknown> | null;
  known: boolean;
  status: number;
}

function absoluteImage(origin: string, path: string | null | undefined): string {
  if (!path) return `${origin}/images/og-cover.jpg`;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/")) return `${origin}${path}`;
  return `${origin}/api/files/${path}`;
}

function plain(value: string, max = 300): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function orgJsonLd(origin: string, settings: Record<string, string>): Record<string, unknown> {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsOrganization",
    name: settings.org_full_name,
    alternateName: settings.org_short_name,
    url: origin,
    sport: "Настольный теннис",
    areaServed: "Гродненская область, Республика Беларусь",
  };
  if (settings.contact_email) data.email = settings.contact_email;
  if (settings.contact_phone) data.telephone = settings.contact_phone;
  if (settings.contact_address) {
    data.address = { "@type": "PostalAddress", streetAddress: settings.contact_address, addressLocality: "Гродно", addressCountry: "BY" };
  }
  return data;
}

export async function getSeo(env: Env, origin: string, pathname: string): Promise<SeoData> {
  const path = pathname !== "/" ? pathname.replace(/\/+$/, "") : "/";
  const settings = await env.DB.prepare("SELECT key, value FROM site_settings")
    .all<{ key: string; value: string }>()
    .then((res) => Object.fromEntries((res.results ?? []).map((row) => [row.key, row.value])) as Record<string, string>);

  const fallback = {
    title: settings.seo_title || "Гродненская ОСДЮШОР им. Ю. К. Культиясова",
    description: settings.seo_description || "Официальный сайт школы настольного тенниса в Гродно.",
    image: `${origin}/images/og-cover.jpg`,
    type: "website" as const,
    canonical: `${origin}${path === "/" ? "/" : path}`,
    noindex: false,
    jsonLd: path === "/" ? orgJsonLd(origin, settings) : null,
    known: true,
    status: 200,
  };

  // Панель управления отдаётся тем же SPA, но не индексируется и не считается 404.
  if (path === "/admin" || path.startsWith("/admin/")) {
    return {
      ...fallback,
      title: "Панель управления — Гродненская ОСДЮШОР им. Ю. К. Культиясова",
      description: "Служебный раздел для сотрудников учреждения.",
      noindex: true,
      known: true,
      status: 200,
      jsonLd: null,
    };
  }

  const newsMatch = path.match(/^\/novosti\/([^/]+)$/);
  if (newsMatch) {
    const slug = decodeURIComponent(newsMatch[1]);
    const row = await env.DB.prepare(
      "SELECT title, summary, body, cover_path, meta_title, meta_description, is_demo, published_at FROM news WHERE slug = ? AND is_published = 1",
    )
      .bind(slug)
      .first<{
        title: string;
        summary: string;
        body: string;
        cover_path: string | null;
        meta_title: string | null;
        meta_description: string | null;
        is_demo: number;
        published_at: string;
      }>();
    if (!row) return { ...fallback, title: "Новость не найдена", canonical: `${origin}${path}`, noindex: true, known: false, status: 404, jsonLd: null };
    return {
      ...fallback,
      title: row.meta_title || `${row.title} — Гродненская ОСДЮШОР им. Ю. К. Культиясова`,
      description: plain(row.meta_description || row.summary || row.body, 300),
      image: absoluteImage(origin, row.cover_path),
      type: "article",
      noindex: Boolean(row.is_demo),
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        headline: row.title,
        datePublished: row.published_at,
        description: plain(row.summary || row.body, 250),
        image: absoluteImage(origin, row.cover_path),
        publisher: { "@type": "Organization", name: settings.org_short_name },
        mainEntityOfPage: `${origin}${path}`,
      },
    };
  }

  const compMatch = path.match(/^\/kalendar\/([^/]+)$/);
  if (compMatch) {
    const slug = decodeURIComponent(compMatch[1]);
    const row = await env.DB.prepare(
      "SELECT title, description, location, starts_on, ends_on, meta_title, meta_description, is_demo FROM competitions WHERE slug = ? AND is_published = 1",
    )
      .bind(slug)
      .first<{
        title: string;
        description: string;
        location: string;
        starts_on: string;
        ends_on: string | null;
        meta_title: string | null;
        meta_description: string | null;
        is_demo: number;
      }>();
    if (!row) return { ...fallback, title: "Соревнование не найдено", canonical: `${origin}${path}`, noindex: true, known: false, status: 404, jsonLd: null };
    return {
      ...fallback,
      title: row.meta_title || `${row.title} — календарь соревнований`,
      description: plain(row.meta_description || row.description, 300),
      noindex: Boolean(row.is_demo),
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "SportsEvent",
        name: row.title,
        startDate: row.starts_on,
        endDate: row.ends_on ?? row.starts_on,
        eventStatus: "https://schema.org/EventScheduled",
        sport: "Настольный теннис",
        location: { "@type": "Place", name: row.location, address: { "@type": "PostalAddress", addressLocality: "Гродно", addressCountry: "BY" } },
        organizer: { "@type": "Organization", name: settings.org_short_name, url: origin },
      },
    };
  }

  const seo = await env.DB.prepare(
    "SELECT title, description, og_image, is_indexable FROM page_seo WHERE path = ?",
  )
    .bind(path)
    .first<{ title: string; description: string; og_image: string | null; is_indexable: number }>();
  if (!seo) {
    return {
      ...fallback,
      title: "Страница не найдена — Гродненская ОСДЮШОР им. Ю. К. Культиясова",
      description: "Запрошенная страница не найдена.",
      canonical: `${origin}${path}`,
      noindex: true,
      known: false,
      status: 404,
      jsonLd: null,
    };
  }
  return {
    ...fallback,
    title: seo.title,
    description: seo.description,
    image: absoluteImage(origin, seo.og_image),
    noindex: !seo.is_indexable,
  };
}

function removeManagedTags(html: string): string {
  return html
    .replace(/<title>[\s\S]*?<\/title>\s*/gi, "")
    .replace(/<meta\s+name="description"[^>]*>\s*/gi, "")
    .replace(/<meta\s+name="robots"[^>]*>\s*/gi, "")
    .replace(/<meta\s+property="og:[^"]+"[^>]*>\s*/gi, "")
    .replace(/<meta\s+name="twitter:[^"]+"[^>]*>\s*/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, "")
    .replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>\s*/gi, "");
}

export function renderMeta(seo: SeoData): string {
  const title = escapeHtml(seo.title);
  const description = escapeHtml(seo.description);
  const lines = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta name="robots" content="${seo.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large"}" />`,
    `<link rel="canonical" href="${escapeHtml(seo.canonical)}" />`,
    `<meta property="og:type" content="${seo.type}" />`,
    `<meta property="og:site_name" content="Гродненская ОСДЮШОР им. Ю. К. Культиясова" />`,
    `<meta property="og:locale" content="ru_RU" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${escapeHtml(seo.canonical)}" />`,
    `<meta property="og:image" content="${escapeHtml(seo.image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${escapeHtml(seo.image)}" />`,
  ];
  if (seo.jsonLd) {
    lines.push(
      `<script type="application/ld+json">${JSON.stringify(seo.jsonLd).replaceAll("<", "\\u003c")}</script>`,
    );
  }
  return lines.join("\n    ");
}

export async function serveSpa(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.ASSETS) {
    return new Response("Сайт ещё не собран. Выполните npm run build.", { status: 503 });
  }
  const asset = await env.ASSETS.fetch(new URL("/index.html", url.origin));
  if (!asset.ok) {
    return new Response("Не найден index.html в опубликованных файлах.", { status: 503 });
  }
  let html = await asset.text();
  let seo: SeoData;
  try {
    seo = await getSeo(env, url.origin, url.pathname);
  } catch (error) {
    console.error("seo_failed", error);
    seo = {
      title: "Гродненская ОСДЮШОР им. Ю. К. Культиясова",
      description: "Официальный сайт школы настольного тенниса в Гродно.",
      image: `${url.origin}/images/og-cover.jpg`,
      type: "website",
      canonical: `${url.origin}${url.pathname}`,
      noindex: true,
      jsonLd: null,
      known: true,
      status: 200,
    };
  }
  html = removeManagedTags(html).replace("</head>", `    ${renderMeta(seo)}\n  </head>`);
  const headers = new Headers(asset.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-cache");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self' 'unsafe-inline' https://mc.yandex.ru https://www.googletagmanager.com; connect-src 'self' https://mc.yandex.ru https://www.google-analytics.com; frame-src https://yandex.ru https://www.google.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'",
  );
  return new Response(html, { status: seo.status, headers });
}
