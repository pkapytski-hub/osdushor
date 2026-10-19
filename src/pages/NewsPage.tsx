import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/site/PageHero";
import { NEWS_CATEGORIES } from "@/lib/types";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { cn } from "@/lib/utils";
import { NewsCard } from "@/components/site/cards";
import { EmptyState, ErrorState, LoadingBlock, Reveal } from "@/components/site/primitives";
import { Pagination } from "@/components/site/Pagination";

const PAGE_SIZE = 9;

export default function NewsPage() {
  const [params, setParams] = useSearchParams();
  const category = params.get("category") ?? "";
  const query = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const [search, setSearch] = useState(query);

  useEffect(() => setSearch(query), [query]);

  const news = useAsync(
    (signal) => api.public.news({ category, q: query, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }, signal),
    [category, query, page],
  );

  const update = (next: Record<string, string | undefined>) => {
    const merged = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value) merged.set(key, value);
      else merged.delete(key);
    }
    setParams(merged, { replace: true });
  };

  const activeCategory = NEWS_CATEGORIES.find((item) => item.value === category);
  const hasDemo = news.data?.items.some((item) => item.is_demo) ?? false;

  return (
    <>
      <Seo
        title={activeCategory ? `${activeCategory.label} — новости школы` : "Новости школы — Гродненская ОСДЮШОР им. Ю. К. Культиясова"}
        description="Новости, объявления, соревнования и результаты Гродненской ОСДЮШОР им. Ю. К. Культиясова. Официальные публикации школы настольного тенниса в Гродно."
        path="/novosti"
        image="/images/og-cover.jpg"
      />
      <PageHero
        label="Новости школы"
        title="Жизнь школы в публикациях"
        description="Официальные новости, анонсы турниров, результаты, объявления для родителей и поздравления воспитанникам."
        crumbs={[{ label: "Новости" }]}
        compact
      />

      <section className="section bg-white">
        <div className="container-site">
          <div className="flex flex-col gap-5 border-b border-navy-100 pb-6">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={cn("chip", !category && "chip-active")}
                onClick={() => update({ category: undefined, page: undefined })}
              >
                Все публикации
              </button>
              {NEWS_CATEGORIES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={cn("chip", category === item.value && "chip-active")}
                  onClick={() => update({ category: item.value, page: undefined })}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <form
              className="flex max-w-xl gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                update({ q: search.trim() || undefined, page: undefined });
              }}
              role="search"
            >
              <label htmlFor="news-search" className="sr-only">Поиск по новостям</label>
              <div className="relative flex-1">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-graphite-400" aria-hidden="true" />
                <input
                  id="news-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Поиск по новостям"
                  className="field-input pl-10"
                />
                {search && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-graphite-400 hover:text-navy-900"
                    onClick={() => {
                      setSearch("");
                      update({ q: undefined, page: undefined });
                    }}
                    aria-label="Очистить поиск"
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
              <button type="submit" className="btn btn-outline">Найти</button>
            </form>
          </div>

          {hasDemo && (
            <div className="mt-6 border border-accent-600/30 bg-accent-50 px-4 py-3 text-[13px] leading-relaxed text-accent-800">
              В ленте есть демонстрационные материалы — они помечены значком «Демо» и не являются официальными публикациями.
            </div>
          )}

          <div className="mt-8">
            {news.loading && <LoadingBlock rows={4} />}
            {news.error && <ErrorState message={news.error} onRetry={news.reload} />}
            {!news.loading && !news.error && news.data && news.data.items.length === 0 && (
              <EmptyState
                title="По вашему запросу ничего не найдено"
                text="Попробуйте изменить категорию или поисковый запрос. Официальные публикации появляются здесь после добавления администрацией."
                action={
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setParams({}, { replace: true })}>
                    Сбросить фильтры
                  </button>
                }
              />
            )}
            {news.data && news.data.items.length > 0 && (
              <>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {news.data.items.map((item, index) => (
                    <Reveal key={item.id} delay={index * 40}>
                      <NewsCard item={item} />
                    </Reveal>
                  ))}
                </div>
                <Pagination
                  offset={(page - 1) * PAGE_SIZE}
                  limit={PAGE_SIZE}
                  total={news.data.total}
                  onChange={(offset) => update({ page: String(Math.floor(offset / PAGE_SIZE) + 1) })}
                />
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
