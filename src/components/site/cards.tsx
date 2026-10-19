import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarDays,
  Download,
  FileText,
  MapPin,
  Medal,
  Paperclip,
  Trophy,
  Users,
} from "lucide-react";
import type { Achievement, Coach, Competition, DocumentItem, NewsItem } from "@/lib/types";
import {
  achievementLevelLabel,
  competitionStatusLabel,
  documentCategoryLabel,
  newsCategoryLabel,
} from "@/lib/types";
import { dayOfMonth, formatDate, formatDateRange, formatFileSize, monthShort, parseDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { fileUrl } from "@/lib/api";
import { DemoBadge } from "./primitives";
import { GraphicPlaceholder, SmartImage } from "./Media";

export function NewsCard({
  item,
  featured = false,
  horizontal = false,
}: {
  item: NewsItem;
  featured?: boolean;
  horizontal?: boolean;
}) {
  return (
    <article className={cn("card card-hover group h-full", horizontal ? "grid sm:grid-cols-[220px_1fr]" : "flex flex-col")}>
      <Link to={`/novosti/${item.slug}`} className="block focus-visible:outline-offset-0" aria-label={item.title}>
        <SmartImage
          path={item.cover_path}
          alt={item.title}
          fallbackLabel={newsCategoryLabel(item.category)}
          className={cn(horizontal ? "h-44 sm:h-full" : featured ? "h-64 sm:h-80" : "h-52")}
          imgClassName="transition-transform duration-500 group-hover:scale-[1.03]"
        >
          <div className="absolute left-0 top-0 flex flex-wrap gap-2 p-3">
            <span className="badge bg-white/95 text-navy-900">{newsCategoryLabel(item.category)}</span>
            {item.is_demo && <DemoBadge className="bg-white" />}
          </div>
        </SmartImage>
      </Link>
      <div className={cn("flex flex-1 flex-col p-5 sm:p-6", horizontal && "sm:p-7")}>
        <div className="flex items-center gap-3 text-[12px] uppercase tracking-[0.12em] text-graphite-500">
          <time dateTime={item.published_at}>{formatDate(item.published_at)}</time>
        </div>
        <h3 className={cn("mt-3 text-balance", featured ? "text-2xl sm:text-3xl" : "text-xl")}>
          <Link to={`/novosti/${item.slug}`} className="transition-colors hover:text-accent-600">
            {item.title}
          </Link>
        </h3>
        {item.summary && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-graphite-600">{item.summary}</p>}
        <div className="mt-auto pt-5">
          <Link
            to={`/novosti/${item.slug}`}
            className="inline-flex items-center gap-1.5 font-display text-[12px] uppercase tracking-[0.16em] text-navy-900 transition-colors hover:text-accent-600"
          >
            Читать <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export function CompetitionCard({ item, detailed = false }: { item: Competition; detailed?: boolean }) {
  const statusStyles = {
    upcoming: "border-navy-300 text-navy-700 bg-white",
    ongoing: "border-accent-600 bg-accent-600 text-white",
    finished: "border-graphite-300 text-graphite-600 bg-white",
  }[item.status];
  return (
    <article className="card card-hover h-full">
      <Link to={`/kalendar/${item.slug}`} className="flex h-full flex-col focus-visible:outline-offset-0">
        <div className="flex items-stretch border-b border-navy-100">
          <div className="flex w-20 shrink-0 flex-col items-center justify-center border-r border-navy-100 bg-mist py-4">
            <span className="font-display text-3xl leading-none text-navy-900">{dayOfMonth(item.starts_on)}</span>
            <span className="mt-1 text-[11px] uppercase tracking-[0.18em] text-graphite-500">{monthShort(item.starts_on)}</span>
            <span className="mt-2 text-[11px] text-graphite-400">{parseDate(item.starts_on)?.getFullYear() ?? ""}</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 px-4 py-3">
            <span className={cn("badge badge-status", statusStyles)}>{competitionStatusLabel(item.status)}</span>
            {item.is_demo && <DemoBadge />}
          </div>
        </div>
        <div className="flex flex-1 flex-col p-5">
          <h3 className="text-balance text-xl leading-snug transition-colors group-hover:text-accent-700">{item.title}</h3>
          <dl className="mt-4 space-y-2 text-sm text-graphite-600">
            <div className="flex items-start gap-2">
              <CalendarDays size={15} className="mt-0.5 shrink-0 text-accent-600" aria-hidden="true" />
              <div>
                <dt className="sr-only">Дата</dt>
                <dd>{formatDateRange(item.starts_on, item.ends_on)}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin size={15} className="mt-0.5 shrink-0 text-accent-600" aria-hidden="true" />
              <div>
                <dt className="sr-only">Место</dt>
                <dd>{item.location || "Место уточняется"}</dd>
              </div>
            </div>
            {item.age_categories.length > 0 && (
              <div className="flex items-start gap-2">
                <Users size={15} className="mt-0.5 shrink-0 text-accent-600" aria-hidden="true" />
                <div>
                  <dt className="sr-only">Возрастные категории</dt>
                  <dd>{item.age_categories.join(" · ")}</dd>
                </div>
              </div>
            )}
          </dl>
          {detailed && item.description && (
            <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-graphite-600">{item.description}</p>
          )}
          <div className="mt-auto flex flex-wrap items-center gap-4 pt-5 text-[12px] uppercase tracking-[0.14em] text-graphite-500">
            {item.regulation_path && (
              <span className="inline-flex items-center gap-1.5">
                <Paperclip size={13} aria-hidden="true" /> Положение
              </span>
            )}
            {item.results_path || item.results_text ? (
              <span className="inline-flex items-center gap-1.5 text-accent-700">
                <Trophy size={13} aria-hidden="true" /> Результаты
              </span>
            ) : null}
            <span className="ml-auto inline-flex items-center gap-1 font-display text-navy-900">
              Подробнее <ArrowUpRight size={14} aria-hidden="true" />
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

export function CoachCard({ coach }: { coach: Coach }) {
  return (
    <article className="card group h-full">
      <SmartImage path={coach.photo_path} alt={coach.full_name} className="h-72" fallbackLabel="Фотография тренера">
        <div className="absolute inset-x-0 bottom-0 h-1 bg-accent-600" aria-hidden="true" />
      </SmartImage>
      <div className="p-6">
        <p className="text-[11px] uppercase tracking-[0.18em] text-accent-700">{coach.position || "Тренерский состав"}</p>
        <h3 className="mt-2 text-2xl">{coach.full_name}</h3>
        {coach.category && <p className="mt-2 text-sm text-graphite-600">{coach.category}</p>}
        {coach.bio && <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-graphite-600">{coach.bio}</p>}
        {coach.achievements && (
          <div className="mt-4 border-t border-navy-100 pt-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-graphite-500">Достижения</p>
            <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-graphite-700">{coach.achievements}</p>
          </div>
        )}
        {coach.contacts && (
          <p className="mt-4 text-sm text-graphite-600">
            <span className="text-graphite-400">Контакт: </span>
            {coach.contacts}
          </p>
        )}
      </div>
    </article>
  );
}

export function AchievementCard({ item }: { item: Achievement }) {
  return (
    <article className="card h-full p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center border border-navy-200 text-accent-600">
          <Medal size={22} aria-hidden="true" />
        </div>
        <span className="badge border border-navy-200 text-navy-700">{achievementLevelLabel(item.level)}</span>
      </div>
      {item.year && <p className="mt-5 font-display text-sm tracking-[0.18em] text-graphite-500">{item.year}</p>}
      <h3 className="mt-2 text-xl leading-snug">{item.title}</h3>
      {item.athlete && <p className="mt-2 text-sm font-medium text-navy-800">{item.athlete}</p>}
      {item.place && <p className="mt-1 text-sm text-accent-700">{item.place}</p>}
      {item.description && <p className="mt-3 text-sm leading-relaxed text-graphite-600">{item.description}</p>}
    </article>
  );
}

export function DocumentRow({ item }: { item: DocumentItem }) {
  const href = fileUrl(item.file_path);
  return (
    <article className="group flex flex-col gap-4 border border-navy-100 bg-white p-5 transition-colors hover:border-navy-300 sm:flex-row sm:items-center">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-navy-900 text-white">
        <FileText size={20} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-[0.16em] text-accent-700">{documentCategoryLabel(item.category)}</p>
        <h3 className="mt-1 break-words font-sans text-[15px] font-medium normal-case tracking-normal text-navy-900">{item.title}</h3>
        {item.description && <p className="mt-1 text-sm leading-relaxed text-graphite-600">{item.description}</p>}
        <p className="mt-1 text-xs text-graphite-400">
          PDF{item.file_size ? ` · ${formatFileSize(item.file_size)}` : ""}
        </p>
      </div>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline btn-sm shrink-0"
          aria-label={`Открыть документ: ${item.title}`}
        >
          <Download size={15} aria-hidden="true" /> Открыть
        </a>
      ) : (
        <span className="text-xs text-graphite-400">Файл готовится</span>
      )}
    </article>
  );
}

export function ArticleBody({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return (
    <div className="space-y-5 text-[16.5px] leading-[1.75] text-graphite-800">
      {blocks.map((block, index) => {
        if (block.startsWith("## ")) {
          return (
            <h2 key={index} className="pt-3 text-2xl normal-case tracking-normal">
              {block.slice(3)}
            </h2>
          );
        }
        if (block.startsWith("### ")) {
          return (
            <h3 key={index} className="pt-2 text-xl normal-case tracking-normal">
              {block.slice(4)}
            </h3>
          );
        }
        const lines = block.split("\n");
        if (lines.every((line) => /^[-—•]\s/.test(line))) {
          return (
            <ul key={index} className="space-y-2 pl-1">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex} className="flex gap-3">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 bg-accent-600" aria-hidden="true" />
                  <span>{line.replace(/^[-—•]\s/, "")}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="whitespace-pre-line">
            {block}
          </p>
        );
      })}
    </div>
  );
}

export function NewsMeta({ item }: { item: NewsItem }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-graphite-500">
      <span className="badge border border-navy-200 text-navy-700">{newsCategoryLabel(item.category)}</span>
      <time dateTime={item.published_at}>{formatDate(item.published_at)}</time>
      {item.is_demo && <DemoBadge />}
    </div>
  );
}
