import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Share2 } from "lucide-react";
import { Seo } from "@/components/Seo";
import { Breadcrumbs } from "@/components/site/PageHero";
import { ArticleBody, NewsCard, NewsMeta } from "@/components/site/cards";
import { SmartImage } from "@/components/site/Media";
import { DemoNotice, EmptyState, ErrorState, LoadingBlock } from "@/components/site/primitives";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { useSiteSettings } from "@/lib/site-context";
import { setting } from "@/lib/utils";
import { formatDate } from "@/lib/format";

export default function NewsDetailPage() {
  const { slug = "" } = useParams();
  const { settings } = useSiteSettings();
  const item = useAsync((signal) => api.public.newsItem(slug, signal), [slug]);
  const related = useAsync((signal) => api.public.news({ limit: 4 }, signal), [slug]);

  if (item.loading) {
    return (
      <div className="container-site py-16">
        <LoadingBlock rows={4} />
      </div>
    );
  }
  if (item.error || !item.data) {
    return (
      <div className="container-site py-16">
        <Seo title="Новость не найдена — Гродненская ОСДЮШОР" description="Запрошенная публикация не найдена." path={`/novosti/${slug}`} noindex />
        <EmptyState
          title="Публикация не найдена"
          text="Возможно, новость снята с публикации или адрес изменился."
          action={<Link to="/novosti" className="btn btn-outline btn-sm">Все новости</Link>}
        />
      </div>
    );
  }

  const news = item.data.item;
  const others = (related.data?.items ?? []).filter((entry) => entry.id !== news.id).slice(0, 3);
  const description = news.meta_description || news.summary || news.body.slice(0, 250);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <>
      <Seo
        title={news.meta_title || `${news.title} — Гродненская ОСДЮШОР им. Ю. К. Культиясова`}
        description={description}
        path={`/novosti/${news.slug}`}
        image={news.cover_path ?? "/images/og-cover.jpg"}
        type="article"
        noindex={news.is_demo}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: news.title,
          datePublished: news.published_at,
          description,
          image: news.cover_path
            ? news.cover_path.startsWith("/")
              ? `${origin}${news.cover_path}`
              : `${origin}/api/files/${news.cover_path}`
            : `${origin}/images/og-cover.jpg`,
          publisher: { "@type": "Organization", name: setting(settings, "org_short_name") },
          mainEntityOfPage: `${origin}/novosti/${news.slug}`,
        }}
      />

      <div className="border-b border-navy-100 bg-mist">
        <div className="container-site py-5">
          <Breadcrumbs light={false} items={[{ label: "Новости", to: "/novosti" }, { label: news.title }]} />
        </div>
      </div>

      <article className="bg-white">
        <header className="container-site max-w-4xl pb-8 pt-10 sm:pt-14">
          <NewsMeta item={news} />
          <h1 className="mt-4 text-balance text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.08]">{news.title}</h1>
          {news.summary && <p className="mt-5 text-lg leading-relaxed text-graphite-600">{news.summary}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-graphite-500">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-accent-600"
              onClick={() => {
                if (navigator.share) {
                  void navigator.share({ title: news.title, url: window.location.href });
                } else {
                  void navigator.clipboard?.writeText(window.location.href);
                }
              }}
            >
              <Share2 size={15} aria-hidden="true" /> Поделиться
            </button>
          </div>
          {news.is_demo && (
            <div className="mt-6">
              <DemoNotice />
            </div>
          )}
        </header>

        {news.cover_path && (
          <div className="container-site max-w-5xl">
            <SmartImage
              path={news.cover_path}
              alt={news.title}
              className="aspect-[16/8] w-full"
              priority
            >
              <p className="absolute bottom-3 right-3 bg-navy-950/70 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-white/70">
                Иллюстративное изображение
              </p>
            </SmartImage>
          </div>
        )}

        <div className="container-site grid max-w-5xl gap-12 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <ArticleBody text={news.body} />
            {!news.body && <p className="text-graphite-500">Текст публикации готовится.</p>}
            <div className="mt-10 flex items-center justify-between border-t border-navy-100 pt-6">
              <Link to="/novosti" className="inline-flex items-center gap-2 font-display text-sm uppercase tracking-[0.12em] text-navy-900 hover:text-accent-600">
                <ArrowLeft size={15} aria-hidden="true" /> Все новости
              </Link>
            </div>
            <p className="mt-6 text-xs leading-relaxed text-graphite-500">{setting(settings, "photo_disclaimer", "")}</p>
          </div>
          <aside>
            <div className="border border-navy-100 bg-mist p-5">
              <p className="font-display text-[12px] uppercase tracking-[0.18em] text-accent-700">Школа</p>
              <p className="mt-2 text-sm leading-relaxed text-graphite-600">
                Официальный сайт Гродненской ОСДЮШОР им. Ю. К. Культиясова. Настольный теннис в Гродно.
              </p>
              <Link to="/nabor" className="btn btn-primary mt-4 w-full btn-sm">
                Записаться в школу
              </Link>
              <Link to="/kalendar" className="mt-2 flex items-center justify-between border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 hover:border-navy-900">
                Календарь соревнований <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </aside>
        </div>
      </article>

      {others.length > 0 && (
        <section className="border-t border-navy-100 bg-mist py-14">
          <div className="container-site">
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-2xl sm:text-3xl">Другие новости</h2>
              <Link to="/novosti" className="hidden text-sm text-navy-800 underline underline-offset-4 hover:text-accent-600 sm:block">
                Все публикации
              </Link>
            </div>
            <div className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((entry) => (
                <NewsCard key={entry.id} item={entry} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
