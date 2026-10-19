import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  MapPin,
  MoveUpRight,
  Trophy,
  Users,
} from "lucide-react";
import { Seo } from "@/components/Seo";
import { useSiteSettings } from "@/lib/site-context";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { setting, hasSetting } from "@/lib/utils";
import { EmptyState, ErrorState, LoadingBlock, Reveal, SectionHeading } from "@/components/site/primitives";
import { NewsCard, CompetitionCard, CoachCard, AchievementCard } from "@/components/site/cards";
import { SmartImage } from "@/components/site/Media";

const HERO_IMAGE = "/images/hero.jpg";

function Hero() {
  const { settings } = useSiteSettings();
  return (
    <section className="relative isolate overflow-hidden bg-navy-950 text-white">
      <div className="absolute inset-0" aria-hidden="true">
        <picture>
          <source
            type="image/webp"
            srcSet="/images/hero-960.webp 960w, /images/hero-1440.webp 1440w, /images/hero.webp 1792w"
            sizes="100vw"
          />
          <img
            src={HERO_IMAGE}
            alt=""
            className="h-full w-full object-cover object-[62%_center]"
            fetchPriority="high"
            decoding="async"
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/90 to-navy-950/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-transparent to-navy-950/30" />
        <div className="absolute inset-0 bg-grid-dark opacity-30" />
      </div>
      <div className="container-site relative z-10 flex min-h-[640px] flex-col justify-center py-20 sm:min-h-[680px] lg:min-h-[720px] lg:py-28">
        <div className="max-w-[820px]">
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-white/65">
            <span className="h-[2px] w-10 bg-accent-500" aria-hidden="true" />
            Гродненская область · Республика Беларусь
          </div>
          <h1 className="display-1 mt-6 text-balance text-[clamp(2.7rem,7.2vw,5.6rem)]">
            Воспитываем
            <br />
            чемпионов.
            <span className="relative ml-0 block text-accent-500 sm:ml-2 sm:inline">
              Открываем возможности.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-white/75 sm:text-[17px]">
            {setting(
              settings,
              "org_short_name",
              "Гродненская ОСДЮШОР им. Ю. К. Культиясова",
            )}{" "}
            — школа настольного тенниса, где начинаются спортивный путь, характер и большие достижения.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to="/nabor" className="btn btn-primary">
              Записаться на занятия <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link to="/o-shkole" className="btn btn-light">
              О школе
            </Link>
            <Link to="/sportsmeny" className="btn btn-ghost !text-white hover:!text-accent-300">
              Наши достижения
            </Link>
          </div>
        </div>

        <div className="mt-auto pt-16">
          <div className="grid border-t border-white/15 sm:grid-cols-3">
            {[
              { to: "/nabor", label: "Набор детей", text: hasSetting(settings, "enrollment_status") ? setting(settings, "enrollment_status") : "Условия приёма — в разделе «Набор»" },
              { to: "/kalendar", label: "Календарь", text: "Соревнования и положения" },
              { to: "/sportsmeny", label: "Достижения", text: "Область · Республика · Мир" },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="group flex items-center justify-between gap-4 border-white/10 py-4 pr-4 transition-colors hover:bg-white/5 sm:border-l sm:pl-5 sm:first:border-l-0 sm:first:pl-0"
              >
                <div>
                  <p className="font-display text-[12px] uppercase tracking-[0.18em] text-white/50">{item.label}</p>
                  <p className="mt-1 line-clamp-1 text-sm text-white/80">{item.text}</p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-white/30 transition-transform group-hover:translate-x-1 group-hover:text-accent-400" aria-hidden="true" />
              </Link>
            ))}
          </div>
          <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-white/30">Иллюстративное изображение</p>
        </div>
      </div>
    </section>
  );
}

function AboutSection() {
  const { settings } = useSiteSettings();
  const pillars = [
    { number: "01", title: "Системная подготовка", text: "От первых ударов и координации — к технике, тактике и соревновательной практике." },
    { number: "02", title: "Внимание к каждому", text: "Группы формируются с учётом возраста, опыта и индивидуального темпа развития." },
    { number: "03", title: "Характер и дисциплина", text: "Спорт учит ставить цель, уважать соперника и не останавливаться после поражений." },
  ];
  return (
    <section className="section bg-white">
      <div className="container-site">
        <div className="grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
          <Reveal className="relative">
            <div className="relative aspect-[4/4.6] overflow-hidden bg-navy-900">
              <SmartImage path="/images/training.jpg" alt="Иллюстративное фото тренировки по настольному теннису" className="h-full w-full" priority={false}>
                <div className="absolute inset-0 bg-gradient-to-t from-navy-950/60 via-transparent to-transparent" aria-hidden="true" />
                <p className="absolute bottom-4 left-4 text-[10px] uppercase tracking-[0.18em] text-white/60">Иллюстративное изображение</p>
              </SmartImage>
            </div>
            <div className="absolute -bottom-8 -right-4 hidden w-52 border-4 border-white shadow-xl sm:block lg:-right-10">
              <SmartImage path="/images/racket-ball.jpg" alt="Ракетка и мяч для настольного тенниса" className="aspect-square" />
            </div>
            <div className="absolute -left-3 top-8 hidden h-24 w-[3px] bg-accent-600 lg:block" aria-hidden="true" />
          </Reveal>

          <Reveal delay={100}>
            <p className="section-label">О школе</p>
            <h2 className="mt-3 text-balance text-3xl leading-[1.08] sm:text-4xl lg:text-[46px]">
              Школа, где спорт становится характером
            </h2>
            <p className="mt-5 text-[16.5px] leading-relaxed text-graphite-700">{setting(settings, "about_lead")}</p>
            <p className="mt-4 text-[15px] leading-relaxed text-graphite-600">{setting(settings, "about_text")}</p>
            <div className="mt-8 divide-y divide-navy-100 border-y border-navy-100">
              {pillars.map((pillar) => (
                <div key={pillar.number} className="grid gap-3 py-4 sm:grid-cols-[48px_1fr]">
                  <span className="font-display text-lg text-accent-600">{pillar.number}</span>
                  <div>
                    <h3 className="text-[17px]">{pillar.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-graphite-600">{pillar.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/o-shkole" className="btn btn-outline">
                Подробнее о школе
              </Link>
              <Link to="/istoriya" className="btn btn-ghost">
                История учреждения <MoveUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function EnrollmentSection() {
  const { settings } = useSiteSettings();
  const rows = [
    {
      label: "С какого возраста",
      value: hasSetting(settings, "enrollment_age") ? settings.enrollment_age : "Уточняется",
      note: "Возраст приёма устанавливает администрация школы.",
    },
    {
      label: "Набор начинающих",
      value: hasSetting(settings, "enrollment_status") ? settings.enrollment_status : "Уточняется",
      note: "Актуальные группы и наличие мест.",
    },
    {
      label: "Документы",
      value: hasSetting(settings, "enrollment_documents") ? settings.enrollment_documents : "Уточняется",
      note: "Перечень документов для зачисления.",
    },
    {
      label: "Где проходят занятия",
      value: hasSetting(settings, "enrollment_schedule") ? settings.enrollment_schedule : "Уточняется",
      note: "Адреса и расписание групп.",
    },
  ];
  return (
    <section className="relative isolate overflow-hidden bg-navy-900 py-16 text-white sm:py-24">
      <div className="absolute inset-0 bg-grid-dark opacity-50" aria-hidden="true" />
      <div className="absolute -right-24 top-0 h-[420px] w-[420px] rounded-full border border-accent-500/20" aria-hidden="true" />
      <div className="container-site relative grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
        <Reveal>
          <p className="section-label section-label-light">Первый шаг</p>
          <h2 className="mt-3 text-balance text-3xl leading-[1.06] sm:text-4xl lg:text-[52px]">
            Попробовать
            <br />
            надо обязательно!
          </h2>
          <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-white/70">
            Настольный теннис развивает скорость реакции, координацию, внимание, дисциплину и уверенность в себе.
            Сделайте первый шаг — познакомьтесь с нашей школой.
          </p>
          <ul className="mt-7 grid gap-3 sm:grid-cols-2">
            {["Скорость реакции", "Координация", "Внимание и дисциплина", "Уверенность в себе"].map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm text-white/80">
                <span className="flex h-5 w-5 items-center justify-center bg-accent-600">
                  <Check size={13} aria-hidden="true" />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <Link to="/nabor" className="btn btn-primary mt-8">
            Узнать о наборе <ArrowRight size={17} aria-hidden="true" />
          </Link>
          {(!hasSetting(settings, "enrollment_age") || !hasSetting(settings, "enrollment_status")) && (
            <p className="mt-4 max-w-md text-[12px] leading-relaxed text-white/40">
              Часть сведений о наборе отмечена как «Уточняется». Актуальные условия подтверждает администрация школы.
            </p>
          )}
        </Reveal>

        <Reveal delay={100}>
          <div className="bg-white text-graphite-900 shadow-2xl">
            <div className="border-b border-navy-100 px-6 py-5">
              <p className="font-display text-[13px] uppercase tracking-[0.18em] text-accent-700">Памятка родителям</p>
              <p className="mt-1 text-sm text-graphite-600">Что важно знать перед первым занятием</p>
            </div>
            <dl className="divide-y divide-navy-100">
              {rows.map((row) => (
                <div key={row.label} className="px-6 py-4">
                  <dt className="text-[11px] uppercase tracking-[0.16em] text-graphite-500">{row.label}</dt>
                  <dd className={`mt-1 text-[15px] font-medium leading-snug ${row.value === "Уточняется" ? "text-graphite-400" : "text-navy-900"}`}>
                    {row.value}
                  </dd>
                  <p className="mt-1 text-[11px] text-graphite-400">{row.note}</p>
                </div>
              ))}
            </dl>
            <div className="border-t border-navy-100 bg-mist px-6 py-4 text-sm text-graphite-600">
              Ответственный за набор:{" "}
              <span className="font-medium text-navy-900">
                {hasSetting(settings, "enrollment_contact_name") ? settings.enrollment_contact_name : "уточняется"}
              </span>
              {hasSetting(settings, "enrollment_contact_phone") && (
                <a href={`tel:${settings.enrollment_contact_phone.replace(/[^\d+]/g, "")}`} className="ml-1 text-accent-700 underline underline-offset-2">
                  {settings.enrollment_contact_phone}
                </a>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function NewsSection() {
  const news = useAsync((signal) => api.public.news({ limit: 3 }, signal), []);
  return (
    <section className="section bg-mist">
      <div className="container-site">
        <SectionHeading
          label="Новости школы"
          title="Что происходит в школе"
          text="Соревнования, результаты, объявления и события тренировочной жизни."
          action={
            <Link to="/novosti" className="btn btn-outline">
              Все новости <ArrowRight size={16} aria-hidden="true" />
            </Link>
          }
        />
        <div className="mt-10">
          {news.loading && <LoadingBlock rows={2} />}
          {news.error && <ErrorState message={news.error} onRetry={news.reload} />}
          {!news.loading && !news.error && news.data && news.data.items.length === 0 && (
            <EmptyState
              title="Новости готовятся к публикации"
              text="Здесь появятся официальные новости школы, анонсы соревнований и объявления для родителей."
              action={<Link to="/nabor" className="btn btn-outline btn-sm">Набор в школу</Link>}
            />
          )}
          {news.data && news.data.items.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <Reveal>
                <NewsCard item={news.data.items[0]} featured />
              </Reveal>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
                {news.data.items.slice(1, 3).map((item, index) => (
                  <Reveal key={item.id} delay={100 + index * 80}>
                    <NewsCard item={item} horizontal />
                  </Reveal>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CalendarSection() {
  const competitions = useAsync((signal) => api.public.competitions({ limit: 3, status: "upcoming" }, signal), []);
  return (
    <section className="section bg-white">
      <div className="container-site">
        <SectionHeading
          label="Календарь соревнований"
          title="Ближайшие турниры"
          text="Даты, места проведения, возрастные категории и положения о соревнованиях."
          action={
            <Link to="/kalendar" className="btn btn-outline">
              Весь календарь <ArrowRight size={16} aria-hidden="true" />
            </Link>
          }
        />
        <div className="mt-10">
          {competitions.loading && <LoadingBlock rows={2} />}
          {competitions.error && <ErrorState message={competitions.error} onRetry={competitions.reload} />}
          {!competitions.loading && !competitions.error && competitions.data && competitions.data.items.length === 0 && (
            <EmptyState
              title="Календарь формируется"
              text="Соревнования появятся здесь после утверждения календарного плана. Следите за объявлениями."
              action={<Link to="/novosti" className="btn btn-outline btn-sm">Читать объявления</Link>}
            />
          )}
          {competitions.data && competitions.data.items.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {competitions.data.items.map((item, index) => (
                <Reveal key={item.id} delay={index * 70}>
                  <CompetitionCard item={item} />
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function AchievementsSection() {
  const achievements = useAsync((signal) => api.public.achievements({}, signal), []);
  const levels = [
    { label: "Областной уровень", text: "Турниры Гродненской области и городские соревнования" },
    { label: "Республиканский уровень", text: "Первенства и кубки Республики Беларусь" },
    { label: "Международный уровень", text: "Выездные турниры и международные встречи" },
  ];
  return (
    <section className="relative isolate overflow-hidden bg-navy-950 py-16 text-white sm:py-24">
      <div className="absolute inset-0" aria-hidden="true">
        <img src="/images/awards.jpg" alt="" className="h-full w-full object-cover opacity-20" loading="lazy" decoding="async" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/95 to-navy-950/60" />
      </div>
      <div className="container-site relative">
        <SectionHeading
          light
          label="Наши достижения"
          title="Результаты, которые подтверждаются протоколами"
          text="Мы публикуем только подтверждённые достижения воспитанников. Раздел пополняется после завершения соревнований."
          action={
            <Link to="/sportsmeny" className="btn btn-light">
              Все достижения <ArrowRight size={16} aria-hidden="true" />
            </Link>
          }
        />
        {achievements.data && achievements.data.items.length > 0 ? (
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {achievements.data.items.slice(0, 3).map((item) => (
              <AchievementCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {levels.map((level, index) => (
              <Reveal key={level.label} delay={index * 80}>
                <div className="border-t border-white/20 bg-white/[0.03] p-6 backdrop-blur-sm">
                  <span className="font-display text-4xl text-accent-500">0{index + 1}</span>
                  <h3 className="mt-4 text-xl text-white">{level.label}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">{level.text}</p>
                </div>
              </Reveal>
            ))}
            <div className="md:col-span-3">
              <div className="flex flex-col items-start justify-between gap-4 border border-white/15 px-6 py-5 sm:flex-row sm:items-center">
                <p className="max-w-2xl text-sm leading-relaxed text-white/60">
                  Раздел достижений готов к наполнению. Администрация школы добавит подтверждённые результаты,
                  фотографии награждений и истории спортсменов.
                </p>
                <Link to="/sportsmeny" className="btn btn-outline !border-white/40 !text-white hover:!bg-white hover:!text-navy-900 btn-sm shrink-0">
                  Раздел достижений <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function CoachesSection() {
  const coaches = useAsync((signal) => api.public.coaches(signal), []);
  return (
    <section className="section bg-mist">
      <div className="container-site">
        <div className="grid items-stretch gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal className="relative min-h-[340px] overflow-hidden bg-navy-900">
            <SmartImage path="/images/training.jpg" alt="Иллюстративное фото тренировки" className="absolute inset-0 h-full w-full">
              <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/20 to-transparent" aria-hidden="true" />
              <div className="absolute bottom-6 left-6 right-6">
                <p className="font-display text-[11px] uppercase tracking-[0.2em] text-white/60">Тренировочный процесс</p>
                <p className="mt-2 font-display text-2xl uppercase leading-tight text-white sm:text-3xl">
                  Тренер рядом
                  <br />
                  на каждом этапе
                </p>
              </div>
              <p className="absolute right-4 top-4 text-[10px] uppercase tracking-[0.16em] text-white/50">Иллюстративное изображение</p>
            </SmartImage>
          </Reveal>
          <Reveal delay={100} className="flex flex-col justify-center">
            <p className="section-label">Наши тренеры</p>
            <h2 className="mt-3 text-balance text-3xl leading-[1.08] sm:text-4xl">Команда, которая ведёт к результату</h2>
            <p className="mt-4 text-[15.5px] leading-relaxed text-graphite-600">
              В разделе публикуются карточки тренеров: квалификационная категория, спортивные звания, биография и
              достижения воспитанников. Сведения добавляет администрация школы.
            </p>
            {coaches.data && coaches.data.items.length > 0 ? (
              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                {coaches.data.items.slice(0, 2).map((coach) => (
                  <CoachCard key={coach.id} coach={coach} />
                ))}
              </div>
            ) : (
              <div className="mt-7 border border-navy-200 bg-white p-5">
                <div className="flex items-center gap-3">
                  <Users size={20} className="text-accent-600" aria-hidden="true" />
                  <p className="font-medium text-navy-900">Карточки тренеров готовятся к публикации</p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-graphite-600">
                  Мы не публикуем имена и звания без подтверждения. Информация появится после проверки документов.
                </p>
                <Link to="/trenery" className="btn btn-outline btn-sm mt-4">
                  Перейти в раздел <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function LocationsSection() {
  const locations = useAsync((signal) => api.public.locations(signal), []);
  const { settings } = useSiteSettings();
  return (
    <section className="section bg-white">
      <div className="container-site">
        <SectionHeading
          label="Где мы находимся"
          title="Спортивные базы и залы"
          text="Адреса, контакты и маршруты. Сведения публикуются только после подтверждения администрацией."
          action={
            <Link to="/kontakty" className="btn btn-outline">
              Контакты и проезд <ArrowRight size={16} aria-hidden="true" />
            </Link>
          }
        />
        <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative min-h-[320px] overflow-hidden bg-navy-900">
            <div className="absolute inset-0 bg-grid-dark opacity-70" aria-hidden="true" />
            <div className="absolute left-[18%] top-[30%] h-24 w-24 rounded-full border border-accent-500/40" aria-hidden="true" />
            <div className="absolute left-[26%] top-[46%] flex h-12 w-12 items-center justify-center bg-accent-600 text-white shadow-xl">
              <MapPin size={22} aria-hidden="true" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-navy-950 to-transparent p-6 pt-16">
              <p className="font-display text-[11px] uppercase tracking-[0.2em] text-white/50">Схема расположения</p>
              <p className="mt-2 text-lg text-white">
                {locations.data && locations.data.items.length > 0
                  ? `${locations.data.items.length} объект(а) в Гродно`
                  : "Адреса спортивных баз уточняются"}
              </p>
              <p className="mt-1 max-w-md text-sm text-white/55">
                {setting(settings, "contact_address", "Точный адрес будет опубликован после подтверждения.")}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            {locations.data && locations.data.items.length > 0 ? (
              locations.data.items.slice(0, 3).map((location) => (
                <div key={location.id} className="border border-navy-100 bg-mist p-5">
                  <h3 className="text-lg">{location.name}</h3>
                  <p className="mt-1 text-sm text-graphite-600">{location.address}</p>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm">
                    {location.phone && <span>{location.phone}</span>}
                    {location.map_url && (
                      <a href={location.map_url} target="_blank" rel="noopener noreferrer" className="link-underline">
                        Построить маршрут
                      </a>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                compact
                title="Список объектов в работе"
                text="Адреса и телефоны не публикуются без подтверждения. Задайте вопрос администрации — вам подскажут, где проходят занятия."
                action={
                  <Link to="/obratnaya-svyaz" className="btn btn-primary btn-sm">
                    Задать вопрос
                  </Link>
                }
              />
            )}
            <div className="mt-auto border-l-2 border-accent-600 bg-white p-5 shadow-card">
              <p className="text-[11px] uppercase tracking-[0.18em] text-graphite-500">Контакты школы</p>
              {settings.contact_email && (
                <a href={`mailto:${settings.contact_email}`} className="mt-2 block text-sm font-medium text-navy-900 underline decoration-navy-200 underline-offset-4">
                  {settings.contact_email}
                </a>
              )}
              {settings.contact_phone && <p className="mt-1 text-sm text-graphite-600">{settings.contact_phone}</p>}
              {!settings.contact_phone && <p className="mt-1 text-sm text-graphite-500">Телефон уточняется.</p>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-accent-600 text-white">
      <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,transparent_55%,rgba(10,22,49,0.18)_55%,rgba(10,22,49,0.18)_100%)]" aria-hidden="true" />
      <div className="container-site relative flex flex-col items-start justify-between gap-8 py-14 sm:py-16 lg:flex-row lg:items-center">
        <div className="max-w-3xl">
          <p className="font-display text-[12px] uppercase tracking-[0.22em] text-white/70">Гродненская ОСДЮШОР им. Ю. К. Культиясова</p>
          <h2 className="mt-3 text-balance text-3xl leading-[1.05] text-white sm:text-4xl lg:text-[46px]">
            Твой первый шаг к большим победам начинается здесь
          </h2>
          <p className="mt-4 max-w-2xl text-[15.5px] leading-relaxed text-white/80">
            Познакомьтесь с нашей школой и узнайте, как начать заниматься настольным теннисом.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <Link to="/obratnaya-svyaz" className="btn bg-white text-navy-900 hover:bg-navy-900 hover:text-white">
            Связаться со школой <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </div>
      <div className="container-site relative pb-8">
        <div className="flex flex-wrap gap-x-8 gap-y-2 border-t border-white/25 pt-4 text-[12px] text-white/70">
          <span className="inline-flex items-center gap-1.5"><Trophy size={13} aria-hidden="true" /> Настольный теннис</span>
          <span className="inline-flex items-center gap-1.5"><Users size={13} aria-hidden="true" /> Дети и подростки</span>
          <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} aria-hidden="true" /> Круглогодичная подготовка</span>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const { settings } = useSiteSettings();
  const city = settings.org_city || "Гродно";
  return (
    <>
      <Seo
        title={setting(settings, "seo_title", "Гродненская ОСДЮШОР им. Ю. К. Культиясова — настольный теннис в Гродно")}
        description={setting(
          settings,
          "seo_description",
          "Официальный сайт школы олимпийского резерва по настольному теннису в Гродно: набор детей, тренировки, соревнования и достижения.",
        )}
        path="/"
        image="/images/og-cover.jpg"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SportsOrganization",
          name: setting(settings, "org_full_name", "Гродненская ОСДЮШОР им. Ю. К. Культиясова"),
          sport: "Настольный теннис",
          areaServed: `${city}, Гродненская область, Республика Беларусь`,
        }}
      />
      <Hero />
      <AboutSection />
      <EnrollmentSection />
      <NewsSection />
      <CalendarSection />
      <AchievementsSection />
      <CoachesSection />
      <LocationsSection />
      <FinalCta />
    </>
  );
}
