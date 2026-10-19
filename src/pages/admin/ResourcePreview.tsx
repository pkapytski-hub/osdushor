import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { Competition, NewsItem } from "@/lib/types";
import { competitionStatusLabel, newsCategoryLabel } from "@/lib/types";
import { formatDate, formatDateRange } from "@/lib/format";
import { ArticleBody } from "@/components/site/cards";
import { DemoBadge } from "@/components/site/primitives";
import { SmartImage } from "@/components/site/Media";

export function ResourcePreview({
  open,
  kind,
  value,
  onClose,
}: {
  open: boolean;
  kind: "news" | "competition";
  value: Record<string, unknown>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="m-0 h-full max-h-none w-full max-w-none border-0 bg-white p-0 backdrop:bg-navy-950/70"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      aria-label="Предпросмотр публикации"
    >
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-navy-100 bg-navy-950 px-4 py-3 text-white sm:px-6">
          <div>
            <p className="font-display text-[11px] uppercase tracking-[0.18em] text-white/50">Предпросмотр</p>
            <p className="text-sm">Так публикация будет выглядеть на сайте</p>
          </div>
          <button type="button" className="flex h-10 w-10 items-center justify-center border border-white/20 hover:bg-white/10" onClick={onClose} aria-label="Закрыть предпросмотр">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
            {kind === "news" ? <NewsPreview value={value} /> : <CompetitionPreview value={value} />}
          </div>
        </div>
      </div>
    </dialog>
  );
}

function newsFrom(value: Record<string, unknown>): NewsItem {
  return {
    id: String(value.id ?? "preview"),
    slug: String(value.slug ?? "preview"),
    title: String(value.title ?? "Без заголовка"),
    summary: String(value.summary ?? ""),
    body: String(value.body ?? ""),
    category: String(value.category ?? "school") as NewsItem["category"],
    cover_path: value.cover_path ? String(value.cover_path) : null,
    meta_title: value.meta_title ? String(value.meta_title) : null,
    meta_description: value.meta_description ? String(value.meta_description) : null,
    is_demo: Boolean(value.is_demo),
    is_published: Boolean(value.is_published),
    published_at: String(value.published_at ?? new Date().toISOString()),
    created_at: String(value.created_at ?? ""),
    updated_at: String(value.updated_at ?? ""),
  };
}

function competitionFrom(value: Record<string, unknown>): Competition {
  const age = value.age_categories;
  const categories = Array.isArray(age)
    ? age.map(String)
    : typeof age === "string"
      ? age.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean)
      : [];
  return {
    id: String(value.id ?? "preview"),
    slug: String(value.slug ?? "preview"),
    title: String(value.title ?? "Без названия"),
    description: String(value.description ?? ""),
    location: String(value.location ?? ""),
    starts_on: String(value.starts_on ?? new Date().toISOString()),
    ends_on: value.ends_on ? String(value.ends_on) : null,
    age_categories: categories,
    status: String(value.status ?? "upcoming") as Competition["status"],
    regulation_path: value.regulation_path ? String(value.regulation_path) : null,
    results_path: value.results_path ? String(value.results_path) : null,
    results_text: value.results_text ? String(value.results_text) : null,
    is_demo: Boolean(value.is_demo),
    is_published: Boolean(value.is_published),
    created_at: String(value.created_at ?? ""),
    updated_at: String(value.updated_at ?? ""),
  };
}

function NewsPreview({ value }: { value: Record<string, unknown> }) {
  const item = newsFrom(value);
  return (
    <article>
      <div className="flex flex-wrap items-center gap-3 text-sm text-graphite-500">
        <span className="badge border border-navy-200 text-navy-700">{newsCategoryLabel(item.category)}</span>
        <span>{formatDate(item.published_at)}</span>
        {item.is_demo && <DemoBadge />}
      </div>
      <h1 className="mt-4 text-[clamp(1.8rem,4vw,2.8rem)] leading-tight">{item.title || "Без заголовка"}</h1>
      {item.summary && <p className="mt-4 text-lg leading-relaxed text-graphite-600">{item.summary}</p>}
      {item.cover_path && <SmartImage path={item.cover_path} alt={item.title} className="mt-7 aspect-[16/8]" />}
      <div className="mt-8">
        {item.body ? <ArticleBody text={item.body} /> : <p className="text-graphite-400">Текст публикации пока пуст.</p>}
      </div>
    </article>
  );
}

function CompetitionPreview({ value }: { value: Record<string, unknown> }) {
  const item = competitionFrom(value);
  return (
    <article>
      <span className="badge border border-navy-300 text-navy-800">{competitionStatusLabel(item.status)}</span>
      {item.is_demo && <span className="ml-2"><DemoBadge /></span>}
      <h1 className="mt-4 text-[clamp(1.8rem,4vw,2.8rem)] leading-tight">{item.title || "Без названия"}</h1>
      <dl className="mt-6 grid gap-3 border-y border-navy-100 py-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[10px] uppercase tracking-[0.16em] text-graphite-400">Даты</dt>
          <dd className="mt-1 text-graphite-800">{formatDateRange(item.starts_on, item.ends_on)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.16em] text-graphite-400">Место</dt>
          <dd className="mt-1 text-graphite-800">{item.location || "Уточняется"}</dd>
        </div>
      </dl>
      {item.age_categories.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {item.age_categories.map((category) => (
            <span key={category} className="chip cursor-default">{category}</span>
          ))}
        </div>
      )}
      <div className="mt-7">
        {item.description ? <ArticleBody text={item.description} /> : <p className="text-graphite-400">Описание пока пустое.</p>}
      </div>
      {item.results_text && (
        <div className="mt-6 border-l-2 border-accent-600 bg-mist p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-accent-700">Итоги</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-graphite-700">{item.results_text}</p>
        </div>
      )}
    </article>
  );
}
