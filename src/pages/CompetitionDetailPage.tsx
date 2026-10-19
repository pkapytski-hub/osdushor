import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CalendarDays, Clock, Download, FileText, MapPin, Trophy, Users } from "lucide-react";
import { Seo } from "@/components/Seo";
import { Breadcrumbs } from "@/components/site/PageHero";
import { ArticleBody } from "@/components/site/cards";
import { DemoNotice, EmptyState, LoadingBlock } from "@/components/site/primitives";
import { api, fileUrl } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { competitionStatusLabel } from "@/lib/types";
import { formatDateRange, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function CompetitionDetailPage() {
  const { slug = "" } = useParams();
  const competition = useAsync((signal) => api.public.competition(slug, signal), [slug]);

  if (competition.loading) {
    return (
      <div className="container-site py-16">
        <LoadingBlock rows={4} />
      </div>
    );
  }
  if (competition.error || !competition.data) {
    return (
      <div className="container-site py-16">
        <Seo title="Соревнование не найдено — Гродненская ОСДЮШОР" description="Запрошенное соревнование не найдено." path={`/kalendar/${slug}`} noindex />
        <EmptyState
          title="Соревнование не найдено"
          text="Возможно, запись снята с публикации или адрес изменился."
          action={<Link to="/kalendar" className="btn btn-outline btn-sm">Весь календарь</Link>}
        />
      </div>
    );
  }

  const item = competition.data.item;
  const statusStyles = {
    upcoming: "border-navy-300 bg-white text-navy-800",
    ongoing: "border-accent-600 bg-accent-600 text-white",
    finished: "border-graphite-300 bg-white text-graphite-600",
  }[item.status];
  const regulationHref = fileUrl(item.regulation_path);
  const resultsHref = fileUrl(item.results_path);

  return (
    <>
      <Seo
        title={item.meta_title || `${item.title} — календарь соревнований`}
        description={item.meta_description || item.description.slice(0, 300) || "Соревнование по настольному теннису в Гродно."}
        path={`/kalendar/${item.slug}`}
        type="article"
        noindex={item.is_demo}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          name: item.title,
          startDate: item.starts_on,
          endDate: item.ends_on ?? item.starts_on,
          eventStatus: "https://schema.org/EventScheduled",
          sport: "Настольный теннис",
          location: {
            "@type": "Place",
            name: item.location,
            address: { "@type": "PostalAddress", addressLocality: "Гродно", addressCountry: "BY" },
          },
        }}
      />

      <div className="border-b border-navy-100 bg-mist">
        <div className="container-site py-5">
          <Breadcrumbs light={false} items={[{ label: "Календарь", to: "/kalendar" }, { label: item.title }]} />
        </div>
      </div>

      <section className="relative overflow-hidden bg-navy-900 py-12 text-white sm:py-16">
        <div className="absolute inset-0 bg-grid-dark opacity-40" aria-hidden="true" />
        <div className="container-site relative">
          <div className="flex flex-wrap items-center gap-3">
            <span className={cn("badge badge-status", statusStyles)}>{competitionStatusLabel(item.status)}</span>
            {item.is_demo && <span className="badge badge-demo bg-white">Демо</span>}
          </div>
          <h1 className="mt-5 max-w-4xl text-balance text-[clamp(2rem,5vw,3.4rem)] leading-[1.08] text-white">{item.title}</h1>
          <div className="mt-7 grid gap-4 border-t border-white/15 pt-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex items-start gap-3">
              <CalendarDays size={18} className="mt-0.5 shrink-0 text-accent-400" aria-hidden="true" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Даты проведения</p>
                <p className="mt-1 text-sm text-white/85">{formatDateRange(item.starts_on, item.ends_on)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock size={18} className="mt-0.5 shrink-0 text-accent-400" aria-hidden="true" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Начало</p>
                <p className="mt-1 text-sm text-white/85">{formatTime(item.starts_on) || "Уточняется"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin size={18} className="mt-0.5 shrink-0 text-accent-400" aria-hidden="true" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Место проведения</p>
                <p className="mt-1 text-sm text-white/85">{item.location || "Уточняется"}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section bg-white">
        <div className="container-site grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            {item.is_demo && <DemoNotice text="Это демонстрационный турнир для проверки оформления. Название, место и статус не являются официальными." />}
            {item.description ? (
              <div className={item.is_demo ? "mt-6" : ""}>
                <ArticleBody text={item.description} />
              </div>
            ) : (
              <p className="text-graphite-500">Описание соревнования готовится.</p>
            )}

            {item.age_categories.length > 0 && (
              <div className="mt-8 border border-navy-100 bg-mist p-5">
                <p className="flex items-center gap-2 font-display text-[12px] uppercase tracking-[0.16em] text-navy-800">
                  <Users size={15} className="text-accent-600" aria-hidden="true" /> Возрастные категории
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.age_categories.map((category) => (
                    <span key={category} className="chip cursor-default">{category}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-10 border-t border-navy-100 pt-8">
              <h2 className="text-2xl">Документы и результаты</h2>
              <div className="mt-4 space-y-3">
                {regulationHref ? (
                  <a href={regulationHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 border border-navy-100 bg-white p-4 transition-colors hover:border-navy-300">
                    <FileText size={20} className="shrink-0 text-accent-600" aria-hidden="true" />
                    <span className="flex-1">
                      <span className="block text-sm font-medium text-navy-900">Положение о соревнованиях</span>
                      <span className="block text-xs text-graphite-500">PDF · открыть в новой вкладке</span>
                    </span>
                    <Download size={17} className="text-graphite-400" aria-hidden="true" />
                  </a>
                ) : (
                  <p className="border border-dashed border-navy-200 px-4 py-3 text-sm text-graphite-500">
                    Положение о соревнованиях будет опубликовано после утверждения.
                  </p>
                )}
                {resultsHref ? (
                  <a href={resultsHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 border border-navy-100 bg-white p-4 transition-colors hover:border-navy-300">
                    <Trophy size={20} className="shrink-0 text-accent-600" aria-hidden="true" />
                    <span className="flex-1">
                      <span className="block text-sm font-medium text-navy-900">Протоколы / результаты</span>
                      <span className="block text-xs text-graphite-500">PDF · открыть в новой вкладке</span>
                    </span>
                    <Download size={17} className="text-graphite-400" aria-hidden="true" />
                  </a>
                ) : null}
                {item.results_text ? (
                  <div className="border-l-2 border-accent-600 bg-mist p-5">
                    <p className="font-display text-[12px] uppercase tracking-[0.16em] text-accent-700">Итоги</p>
                    <div className="mt-2 whitespace-pre-line text-sm leading-relaxed text-graphite-700">{item.results_text}</div>
                  </div>
                ) : (
                  <p className="text-sm text-graphite-500">
                    {item.status === "finished"
                      ? "Результаты готовятся к публикации."
                      : "Результаты появятся после завершения соревнования."}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-10">
              <Link to="/kalendar" className="inline-flex items-center gap-2 font-display text-sm uppercase tracking-[0.12em] text-navy-900 hover:text-accent-600">
                <ArrowLeft size={15} aria-hidden="true" /> Весь календарь
              </Link>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="border border-navy-100 bg-mist p-5">
              <p className="font-display text-[12px] uppercase tracking-[0.18em] text-accent-700">Статус</p>
              <p className="mt-2 text-lg text-navy-900">{competitionStatusLabel(item.status)}</p>
              <p className="mt-1 text-xs leading-relaxed text-graphite-500">
                Статус обновляет администрация школы. Даты могут измениться — следите за объявлениями.
              </p>
            </div>
            <div className="border border-navy-100 bg-white p-5">
              <p className="font-display text-[12px] uppercase tracking-[0.18em] text-accent-700">Связаться</p>
              <p className="mt-2 text-sm leading-relaxed text-graphite-600">Вопросы о соревновании можно задать администрации школы.</p>
              <Link to="/obratnaya-svyaz?topic=competitions" className="btn btn-outline mt-4 w-full btn-sm">
                Задать вопрос <ArrowRight size={14} aria-hidden="true" />
              </Link>
              <Link to="/rezultaty" className="mt-2 flex items-center justify-between border border-navy-200 px-3 py-2 text-sm text-navy-900 hover:border-navy-900">
                Все результаты <Trophy size={14} aria-hidden="true" />
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
