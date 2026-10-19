import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Building2, FileText, Mail, ShieldCheck } from "lucide-react";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/site/PageHero";
import { useSiteSettings } from "@/lib/site-context";
import { hasSetting, setting } from "@/lib/utils";

export default function OfficialInfoPage() {
  const { settings } = useSiteSettings();
  const verified = settings.official_verified === "1";
  const rows = [
    { label: "Полное наименование", key: "org_full_name" },
    { label: "Сокращённое наименование", key: "org_short_name" },
    { label: "Учётный номер плательщика (УНП)", key: "official_unp" },
    { label: "Регистрационные сведения", key: "official_registration" },
    { label: "Юридический адрес", key: "official_legal_address" },
    { label: "Вышестоящая организация", key: "official_superior" },
    { label: "Режим работы", key: "official_work_hours" },
    { label: "Приём граждан", key: "official_reception" },
  ];
  return (
    <>
      <Seo
        title="Официальная информация — Гродненская ОСДЮШОР им. Ю. К. Культиясова"
        description="Сведения об организации, режим работы, нормативные документы и обязательная информация государственного учреждения — Гродненской ОСДЮШОР им. Ю. К. Культиясова."
        path="/oficialnaya-informaciya"
        noindex={false}
      />
      <PageHero
        label="Официально"
        title="Официальная информация"
        description="Сведения об учреждении, режим работы, порядок обращений и обязательные материалы для посетителей сайта."
        crumbs={[{ label: "Официальная информация" }]}
        compact
      />

      <section className="section bg-white">
        <div className="container-site grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-14">
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <nav aria-label="Разделы официальной информации" className="border-l border-navy-200">
              {[
                ["organization", "Сведения об организации"],
                ["documents", "Документы"],
                ["appeals", "Обращения граждан"],
                ["personal-data", "Персональные данные"],
                ["site", "О сайте"],
              ].map(([id, label]) => (
                <a key={id} href={`#${id}`} className="block border-l-2 border-transparent px-4 py-2.5 text-sm text-graphite-600 transition-colors hover:border-accent-600 hover:text-navy-900">
                  {label}
                </a>
              ))}
            </nav>
          </aside>

          <div className="min-w-0 space-y-12">
            {!verified && (
              <div className="flex items-start gap-3 border border-accent-600/30 bg-accent-50 p-4 text-sm leading-relaxed text-accent-900">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold">Сведения проходят проверку</p>
                  <p className="mt-1">
                    {setting(settings, "official_note")} Поля со значением «Уточняется» не являются официальными
                    реквизитами. Администрация школы заполнит их на основании учредительных документов.
                  </p>
                </div>
              </div>
            )}

            <section id="organization" aria-labelledby="organization-title">
              <div className="flex items-center gap-3">
                <Building2 size={22} className="text-accent-600" aria-hidden="true" />
                <h2 id="organization-title" className="text-2xl sm:text-3xl">Сведения об организации</h2>
              </div>
              <dl className="mt-6 divide-y divide-navy-100 border-y border-navy-100">
                {rows.map((row) => {
                  const value = hasSetting(settings, row.key) ? settings[row.key] : null;
                  return (
                    <div key={row.key} className="grid gap-2 py-4 sm:grid-cols-[240px_1fr]">
                      <dt className="text-[12px] uppercase tracking-[0.1em] text-graphite-500">{row.label}</dt>
                      <dd className={`text-[15px] leading-relaxed ${value ? "text-graphite-800" : "text-graphite-400"}`}>
                        {value ?? "Уточняется"}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              <p className="mt-4 text-xs leading-relaxed text-graphite-500">
                Сведения публикуются администрацией учреждения. Если вы обнаружили неточность, сообщите нам через
                обратную связь.
              </p>
            </section>

            <section id="documents" aria-labelledby="documents-title">
              <div className="flex items-center gap-3">
                <FileText size={22} className="text-accent-600" aria-hidden="true" />
                <h2 id="documents-title" className="text-2xl sm:text-3xl">Документы</h2>
              </div>
              <p className="mt-4 text-[15px] leading-relaxed text-graphite-600">
                Нормативные и локальные акты, подлежащие открытому опубликованию, размещаются в разделе «Документы».
                Материалы с персональными данными и медицинскими сведениями в открытом доступе не публикуются.
              </p>
              <Link to="/dokumenty" className="btn btn-outline mt-5">
                Перейти к документам <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </section>

            <section id="appeals" aria-labelledby="appeals-title">
              <div className="flex items-center gap-3">
                <Mail size={22} className="text-accent-600" aria-hidden="true" />
                <h2 id="appeals-title" className="text-2xl sm:text-3xl">Обращения граждан</h2>
              </div>
              <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-graphite-600">
                <p>
                  Обращения рассматриваются в порядке, установленном законодательством Республики Беларусь, в том числе
                  Законом Республики Беларусь от 18 июля 2011 г. № 300-З «Об обращениях граждан и юридических лиц».
                </p>
                <p>
                  Для направления вопроса используйте форму обратной связи. Укажите имя и контакт для ответа — эти
                  сведения не публикуются на сайте.
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link to="/obratnaya-svyaz" className="btn btn-primary">Направить обращение <ArrowRight size={16} aria-hidden="true" /></Link>
                {hasSetting(settings, "contact_email") && (
                  <a href={`mailto:${settings.contact_email}`} className="btn btn-outline break-all">{settings.contact_email}</a>
                )}
              </div>
            </section>

            <section id="personal-data" aria-labelledby="pd-title">
              <div className="flex items-center gap-3">
                <ShieldCheck size={22} className="text-accent-600" aria-hidden="true" />
                <h2 id="pd-title" className="text-2xl sm:text-3xl">Персональные данные</h2>
              </div>
              <p className="mt-4 text-[15px] leading-relaxed text-graphite-600">
                Обработка персональных данных осуществляется с учётом требований Закона Республики Беларусь от 7 мая
                2021 г. № 99-З «О защите персональных данных». Публикация имён, фотографий и достижений
                несовершеннолетних допускается только при наличии необходимых согласий законных представителей.
              </p>
              <Link to="/politika-personalnyh-dannyh" className="btn btn-outline btn-wrap mt-5">
                Политика обработки персональных данных <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </section>

            <section id="site" aria-labelledby="site-title">
              <h2 id="site-title" className="text-2xl sm:text-3xl">О сайте</h2>
              <dl className="mt-5 divide-y divide-navy-100 border-y border-navy-100 text-sm">
                {[
                  ["Наименование сайта", setting(settings, "org_short_name")],
                  ["Язык интерфейса", "Русский"],
                  ["Ответственный за содержание", "Администрация учреждения"],
                  ["Техническая поддержка", "Через форму обратной связи"],
                ].map(([label, value]) => (
                  <div key={label} className="grid gap-1 py-3 sm:grid-cols-[240px_1fr]">
                    <dt className="text-graphite-500">{label}</dt>
                    <dd className="text-graphite-800">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs leading-relaxed text-graphite-500">
                {setting(settings, "photo_disclaimer", "")}
              </p>
            </section>
          </div>
        </div>
      </section>
    </>
  );
}
