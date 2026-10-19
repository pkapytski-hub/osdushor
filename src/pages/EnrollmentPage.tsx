import { Link } from "react-router-dom";
import { ArrowRight, Check, FileText, HelpCircle, MapPin, Phone, UserRound } from "lucide-react";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/site/PageHero";
import { useSiteSettings } from "@/lib/site-context";
import { hasSetting, setting } from "@/lib/utils";
import { Reveal, SectionHeading } from "@/components/site/primitives";

export default function EnrollmentPage() {
  const { settings } = useSiteSettings();
  const items = [
    {
      icon: UserRound,
      label: "С какого возраста принимаются дети",
      value: hasSetting(settings, "enrollment_age") ? settings.enrollment_age : "Уточняется",
    },
    {
      icon: Check,
      label: "Набор начинающих",
      value: hasSetting(settings, "enrollment_status") ? settings.enrollment_status : "Уточняется",
    },
    {
      icon: FileText,
      label: "Необходимые документы",
      value: hasSetting(settings, "enrollment_documents") ? settings.enrollment_documents : "Уточняется",
    },
    {
      icon: MapPin,
      label: "Где проходят занятия",
      value: hasSetting(settings, "enrollment_schedule") ? settings.enrollment_schedule : "Уточняется",
    },
  ];
  const steps = [
    { number: "01", title: "Оставьте обращение", text: "Напишите нам через форму обратной связи или позвоните в школу." },
    { number: "02", title: "Уточните условия", text: "Администрация расскажет о группах, возрасте приёма и наличии мест." },
    { number: "03", title: "Подготовьте документы", text: "Перечень документов подтверждается до начала зачисления." },
    { number: "04", title: "Начните занятия", text: "После согласования группы и организационных вопросов." },
  ];
  const faq = [
    {
      q: "С какого возраста можно начать заниматься?",
      a: hasSetting(settings, "enrollment_age")
        ? settings.enrollment_age
        : "Возраст приёма уточняется администрацией школы. Оставьте обращение — вам ответят актуально.",
    },
    {
      q: "Есть ли набор начинающих?",
      a: hasSetting(settings, "enrollment_status")
        ? settings.enrollment_status
        : "Информация о наборе начинающих групп уточняется. Свяжитесь со школой, чтобы узнать о ближайшем наборе.",
    },
    {
      q: "Какие документы нужны?",
      a: hasSetting(settings, "enrollment_documents")
        ? settings.enrollment_documents
        : "Перечень документов предоставляется администрацией при записи. Мы не публикуем неподтверждённые условия.",
    },
    {
      q: "Где проходят занятия?",
      a: hasSetting(settings, "enrollment_schedule")
        ? settings.enrollment_schedule
        : "Адреса и расписание публикуются в разделах «Спортивные базы» и «Расписание занятий» после подтверждения.",
    },
  ];
  return (
    <>
      <Seo
        title="Набор в секцию настольного тенниса в Гродно — ОСДЮШОР им. Ю. К. Культиясова"
        description="Как записать ребёнка в секцию настольного тенниса в Гродно: возраст приёма, документы, порядок собеседования и контакты школы."
        path="/nabor"
        image="/images/hero.jpg"
      />
      <PageHero
        label="Набор в школу"
        title="Попробовать надо обязательно!"
        description="Настольный теннис развивает скорость реакции, координацию, внимание, дисциплину и уверенность в себе. Сделайте первый шаг — познакомьтесь с нашей школой."
        crumbs={[{ label: "Набор в школу" }]}
        image="/images/hero.jpg"
        imageAlt="Иллюстративное фото игры в настольный теннис"
      >
        <div className="flex flex-wrap gap-3">
          <Link to="/obratnaya-svyaz?topic=enrollment" className="btn btn-primary">
            Записаться на занятия <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link to="/raspisanie" className="btn btn-light">Расписание</Link>
        </div>
      </PageHero>

      <section className="section bg-white" id="zapis">
        <div className="container-site grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <Reveal>
            <p className="section-label">Условия приёма</p>
            <h2 className="mt-3 text-balance text-3xl sm:text-4xl">Что нужно знать родителям</h2>
            <p className="mt-4 text-[15.5px] leading-relaxed text-graphite-600">
              Сведения о возрасте приёма, наличии мест, документах и расписании заполняет администрация школы.
              Поля с пометкой «Уточняется» ещё не подтверждены — их не следует считать официальными условиями.
            </p>
            <div className="mt-8 divide-y divide-navy-100 border-y border-navy-100">
              {items.map((item) => (
                <div key={item.label} className="grid gap-3 py-5 sm:grid-cols-[220px_1fr]">
                  <div className="flex items-start gap-2.5">
                    <item.icon size={17} className="mt-0.5 shrink-0 text-accent-600" aria-hidden="true" />
                    <p className="text-[13px] font-medium uppercase leading-snug tracking-[0.08em] text-graphite-500">{item.label}</p>
                  </div>
                  <p className={`text-[15px] leading-relaxed ${item.value === "Уточняется" ? "text-graphite-400" : "text-graphite-800"}`}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
            {(!hasSetting(settings, "enrollment_age") ||
              !hasSetting(settings, "enrollment_status") ||
              !hasSetting(settings, "enrollment_documents")) && (
              <p className="mt-5 border-l-2 border-accent-600 bg-accent-50 px-4 py-3 text-[13px] leading-relaxed text-accent-800">
                Не все сведения о наборе подтверждены. Актуальные условия уточняйте у администрации школы — мы
                отвечаем по указанным контактам.
              </p>
            )}
          </Reveal>

          <Reveal delay={100}>
            <div className="sticky top-24 border border-navy-100 bg-mist p-6">
              <p className="font-display text-[12px] uppercase tracking-[0.18em] text-accent-700">Ответственный за набор</p>
              <p className="mt-3 text-lg font-medium text-navy-900">
                {hasSetting(settings, "enrollment_contact_name") ? settings.enrollment_contact_name : "Уточняется"}
              </p>
              <div className="mt-4 space-y-2.5 text-sm text-graphite-700">
                {hasSetting(settings, "enrollment_contact_phone") && (
                  <a href={`tel:${settings.enrollment_contact_phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-2 link-underline">
                    <Phone size={15} aria-hidden="true" /> {settings.enrollment_contact_phone}
                  </a>
                )}
                {hasSetting(settings, "enrollment_contact_email") && (
                  <a href={`mailto:${settings.enrollment_contact_email}`} className="flex items-center gap-2 break-all link-underline">
                    {settings.enrollment_contact_email}
                  </a>
                )}
                {!hasSetting(settings, "enrollment_contact_phone") && !hasSetting(settings, "enrollment_contact_email") && (
                  <p className="text-graphite-500">Контакт ответственного лица уточняется. Используйте общую форму обратной связи.</p>
                )}
              </div>
              <Link to="/obratnaya-svyaz?topic=enrollment" className="btn btn-primary mt-6 w-full">
                Оставить заявку
              </Link>
              <p className="mt-3 text-[11px] leading-relaxed text-graphite-500">
                Отправляя обращение, вы соглашаетесь с {""}
                <Link to="/politika-personalnyh-dannyh" className="underline underline-offset-2">политикой обработки персональных данных</Link>.
              </p>
              <div className="mt-5 border-t border-navy-200 pt-4 text-sm">
                <p className="text-graphite-500">Общие контакты</p>
                {settings.contact_email && (
                  <a href={`mailto:${settings.contact_email}`} className="mt-1 block break-all text-navy-900 underline decoration-navy-200 underline-offset-4">
                    {settings.contact_email}
                  </a>
                )}
                {settings.contact_phone && <p className="mt-1 text-navy-900">{settings.contact_phone}</p>}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section bg-mist">
        <div className="container-site">
          <SectionHeading label="Как это устроено" title="Четыре шага к первому занятию" />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <Reveal key={step.number} delay={index * 60}>
                <div className="h-full border-t-2 border-navy-900 bg-white p-6">
                  <span className="font-display text-2xl text-accent-600">{step.number}</span>
                  <h3 className="mt-3 text-lg">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-graphite-600">{step.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mt-6 max-w-3xl text-xs leading-relaxed text-graphite-500">
            Порядок зачисления и перечень документов подтверждает администрация учреждения. Информация на сайте не
            заменяет официальную консультацию.
          </p>
        </div>
      </section>

      <section className="section bg-white">
        <div className="container-site grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="section-label">Вопросы и ответы</p>
            <h2 className="mt-3 text-balance text-3xl">Коротко о главном</h2>
            <p className="mt-4 text-sm leading-relaxed text-graphite-600">
              Если ответа нет — задайте вопрос через обратную связь. Администрация отвечает по указанному вами контакту.
            </p>
            <Link to="/obratnaya-svyaz?topic=enrollment" className="btn btn-outline mt-6">
              Задать вопрос <HelpCircle size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="divide-y divide-navy-100 border-y border-navy-100">
            {faq.map((item) => (
              <details key={item.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-medium text-navy-900">
                  {item.q}
                  <span className="relative flex h-6 w-6 shrink-0 items-center justify-center border border-navy-200" aria-hidden="true">
                    <span className="absolute h-[1.5px] w-3 bg-navy-900" />
                    <span className="absolute h-3 w-[1.5px] bg-navy-900 transition-transform group-open:rotate-90 group-open:opacity-0" />
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-graphite-600">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-accent-600 py-12 text-white sm:py-14">
        <div className="container-site flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl text-white sm:text-3xl">Первый шаг — простое сообщение</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/80">
              Расскажите, сколько лет ребёнку и что вас интересует. Администрация подскажет дальнейшие действия.
            </p>
          </div>
          <Link to="/obratnaya-svyaz?topic=enrollment" className="btn bg-white text-navy-900 hover:bg-navy-900 hover:text-white shrink-0">
            Написать в школу <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
