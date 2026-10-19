import { Link } from "react-router-dom";
import { ArrowRight, Check, MapPin, Target, Users } from "lucide-react";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/site/PageHero";
import { useSiteSettings } from "@/lib/site-context";
import { setting, hasSetting } from "@/lib/utils";
import { SmartImage } from "@/components/site/Media";
import { EmptyState, Reveal, SectionHeading } from "@/components/site/primitives";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";

export default function AboutPage() {
  const { settings } = useSiteSettings();
  const locations = useAsync((signal) => api.public.locations(signal), []);
  const facts = [
    { label: "Вид спорта", value: "Настольный теннис" },
    { label: "Регион", value: setting(settings, "org_city", "Гродно") + ", Республика Беларусь" },
    { label: "Учреждение", value: "Спортивная подготовка детей и подростков" },
  ];
  return (
    <>
      <Seo
        title="О школе — Гродненская ОСДЮШОР им. Ю. К. Культиясова"
        description="О специализации, спортивной подготовке и традициях Гродненской ОСДЮШОР им. Ю. К. Культиясова. Настольный теннис для детей и подростков в Гродно."
        path="/o-shkole"
        image="/images/training.jpg"
      />
      <PageHero
        label="О школе"
        title="Школа настольного тенниса Гродненской области"
        description={setting(settings, "about_lead")}
        crumbs={[{ label: "О школе" }]}
        image="/images/training.jpg"
        imageAlt="Иллюстративное фото тренировки по настольному теннису"
      >
        <div className="flex flex-wrap gap-3">
          <Link to="/istoriya" className="btn btn-light">История школы</Link>
          <Link to="/nabor" className="btn btn-primary">Набор в школу <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </PageHero>

      <section className="section bg-white">
        <div className="container-site grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <Reveal>
            <p className="section-label">Наша специализация</p>
            <h2 className="mt-3 text-balance text-3xl sm:text-4xl">Спорт, в котором важна каждая деталь</h2>
            <div className="mt-6 space-y-4 text-[15.5px] leading-relaxed text-graphite-700">
              <p>{setting(settings, "about_text")}</p>
              <p>{setting(settings, "about_training")}</p>
            </div>
            <dl className="mt-8 grid gap-px border border-navy-100 bg-navy-100 sm:grid-cols-3">
              {facts.map((fact) => (
                <div key={fact.label} className="bg-white p-5">
                  <dt className="text-[10px] uppercase tracking-[0.18em] text-graphite-500">{fact.label}</dt>
                  <dd className="mt-2 text-sm font-medium leading-snug text-navy-900">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
          <Reveal delay={100} className="relative">
            <SmartImage path="/images/racket-ball.jpg" alt="Ракетка и мяч для настольного тенниса" className="aspect-[4/5]">
              <div className="absolute inset-0 bg-gradient-to-t from-navy-950/70 via-transparent to-transparent" aria-hidden="true" />
              <div className="absolute bottom-5 left-5 right-5">
                <p className="font-display text-[11px] uppercase tracking-[0.18em] text-white/60">Иллюстративное изображение</p>
                <p className="mt-2 font-display text-2xl uppercase leading-tight text-white">Реакция. Точность. Характер.</p>
              </div>
            </SmartImage>
          </Reveal>
        </div>
      </section>

      <section className="section bg-mist">
        <div className="container-site">
          <SectionHeading
            label="Спортивная подготовка"
            title="Последовательный путь в спорте"
            text="Мы не обещаем результат за неделю. Подготовка строится поэтапно — от базовой техники к уверенной игре."
          />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Target, title: "Техника", text: "Постановка ударов, подач и перемещений у стола." },
              { icon: Users, title: "Группы", text: "Формирование по возрасту и уровню подготовки." },
              { icon: Check, title: "Практика", text: "Игровые задания, спарринги и турнирный опыт." },
              { icon: MapPin, title: "Базы", text: "Занятия в спортивных залах школы." },
            ].map((item, index) => (
              <Reveal key={item.title} delay={index * 60}>
                <div className="h-full border border-navy-100 bg-white p-6">
                  <item.icon size={24} className="text-accent-600" aria-hidden="true" />
                  <h3 className="mt-4 text-lg">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-graphite-600">{item.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-white">
        <div className="container-site grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <p className="section-label">Залы и базы</p>
            <h2 className="mt-3 text-balance text-3xl sm:text-4xl">Где проходят занятия</h2>
            <p className="mt-4 text-[15.5px] leading-relaxed text-graphite-600">{setting(settings, "about_halls")}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/kontakty" className="btn btn-outline">Адреса и проезд</Link>
              <Link to="/raspisanie" className="btn btn-ghost">Расписание занятий <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
          </Reveal>
          <Reveal delay={100}>
            {locations.data && locations.data.items.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {locations.data.items.map((location) => (
                  <div key={location.id} className="border border-navy-100 bg-mist p-5">
                    <h3 className="text-lg">{location.name}</h3>
                    <p className="mt-1 text-sm text-graphite-600">{location.address}</p>
                    {location.schedule_note && <p className="mt-2 text-xs text-graphite-500">{location.schedule_note}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Адреса уточняются"
                text="Мы не публикуем адреса без подтверждения. Актуальную информацию о местах занятий можно уточнить у администрации."
                action={<Link to="/obratnaya-svyaz" className="btn btn-primary btn-sm">Спросить администрацию</Link>}
              />
            )}
          </Reveal>
        </div>
      </section>

      <section className="relative overflow-hidden bg-navy-900 py-14 text-white sm:py-16">
        <div className="absolute inset-0 bg-grid-dark opacity-40" aria-hidden="true" />
        <div className="container-site relative flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <p className="section-label section-label-light">Традиции</p>
            <h2 className="mt-3 text-balance text-2xl sm:text-3xl">История школы — это люди и преемственность</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              {hasSetting(settings, "history_note")
                ? settings.history_note
                : "Раздел истории наполняется подтверждёнными сведениями."}
            </p>
          </div>
          <Link to="/istoriya" className="btn btn-light shrink-0">Перейти к истории <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>
    </>
  );
}
