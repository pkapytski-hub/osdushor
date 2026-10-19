import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, CalendarClock } from "lucide-react";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/site/PageHero";
import { useSiteSettings } from "@/lib/site-context";
import { setting } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { EmptyState, ErrorState, LoadingBlock, Reveal } from "@/components/site/primitives";

export default function HistoryPage() {
  const { settings } = useSiteSettings();
  const history = useAsync((signal) => api.public.history(signal), []);
  return (
    <>
      <Seo
        title="История школы — Гродненская ОСДЮШОР им. Ю. К. Культиясова"
        description="История Гродненской школы олимпийского резерва по настольному теннису: значимые этапы, тренеры и воспитанники. Публикуются только подтверждённые сведения."
        path="/istoriya"
        image="/images/awards.jpg"
      />
      <PageHero
        label="История школы"
        title="Этапы, люди и спортивные традиции"
        description={setting(settings, "history_intro")}
        crumbs={[{ label: "О школе", to: "/o-shkole" }, { label: "История" }]}
        image="/images/awards.jpg"
        imageAlt="Иллюстративное фото награждения"
      />

      <section className="section bg-white">
        <div className="container-site">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <Reveal>
              <p className="section-label">Принцип публикации</p>
              <h2 className="mt-3 text-balance text-3xl">Только проверенные факты</h2>
              <p className="mt-4 text-sm leading-relaxed text-graphite-600">
                Даты основания, имена основателей, награды и значимые события публикуются администрацией школы только
                после сверки с архивными документами. До этого раздел остаётся открытым, но без вымышленных сведений.
              </p>
              <div className="mt-6 border-l-2 border-accent-600 bg-mist p-4">
                <p className="flex items-start gap-2 text-sm leading-relaxed text-graphite-700">
                  <BookOpen size={17} className="mt-0.5 shrink-0 text-accent-600" aria-hidden="true" />
                  {setting(settings, "history_note")}
                </p>
              </div>
              <Link to="/o-shkole" className="btn btn-outline mt-6">
                О школе <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </Reveal>

            <div>
              {history.loading && <LoadingBlock rows={4} />}
              {history.error && <ErrorState message={history.error} onRetry={history.reload} />}
              {!history.loading && !history.error && history.data && history.data.items.length === 0 && (
                <EmptyState
                  icon={<CalendarClock size={22} aria-hidden="true" />}
                  title="Хронология готовится к публикации"
                  text="Здесь появятся подтверждённые этапы развития школы: годы, события, имена тренеров и воспитанников, значимые турниры."
                  action={<Link to="/obratnaya-svyaz" className="btn btn-outline btn-sm">Передать сведения в архив</Link>}
                />
              )}
              {history.data && history.data.items.length > 0 && (
                <ol className="relative space-y-0 border-l border-navy-200 pl-7">
                  {history.data.items.map((event, index) => (
                    <Reveal key={event.id} delay={index * 60}>
                      <li className="relative pb-9">
                        <span className="absolute -left-[38px] top-1 flex h-5 w-5 items-center justify-center border-2 border-accent-600 bg-white" aria-hidden="true">
                          <span className="h-1.5 w-1.5 bg-accent-600" />
                        </span>
                        <p className="font-display text-sm tracking-[0.2em] text-accent-700">{event.year}</p>
                        <h3 className="mt-1 text-xl">{event.title}</h3>
                        {event.description && <p className="mt-2 text-sm leading-relaxed text-graphite-600">{event.description}</p>}
                      </li>
                    </Reveal>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
