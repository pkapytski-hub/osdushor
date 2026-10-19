import { Link } from "react-router-dom";
import { ArrowRight, Clock, ExternalLink, Mail, MapPin, Navigation, Phone } from "lucide-react";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/site/PageHero";
import { SmartImage } from "@/components/site/Media";
import { EmptyState, ErrorState, LoadingBlock, Reveal } from "@/components/site/primitives";
import { useSiteSettings } from "@/lib/site-context";
import { hasSetting, setting } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";

export default function ContactsPage() {
  const { settings } = useSiteSettings();
  const locations = useAsync((signal) => api.public.locations(signal), []);
  const socials = [
    { href: settings.social_telegram, label: "Telegram" },
    { href: settings.social_vk, label: "ВКонтакте" },
    { href: settings.social_instagram, label: "Instagram" },
    { href: settings.social_youtube, label: "YouTube" },
  ].filter((item) => item.href);

  return (
    <>
      <Seo
        title="Контакты и спортивные базы — Гродненская ОСДЮШОР им. Ю. К. Культиясова"
        description="Адреса спортивных баз, телефоны, режим работы и карта проезда к Гродненской ОСДЮШОР им. Ю. К. Культиясова. Актуальные контакты школы настольного тенниса в Гродно."
        path="/kontakty"
      />
      <PageHero
        label="Контакты"
        title="Спортивные базы и связь со школой"
        description="Точные адреса, телефоны и маршруты публикуются только после подтверждения администрацией. Если данных пока нет — задайте вопрос через обратную связь."
        crumbs={[{ label: "Контакты" }]}
        compact
      >
        <Link to="/obratnaya-svyaz" className="btn btn-primary">
          Написать в школу <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </PageHero>

      <section className="section bg-white">
        <div className="container-site grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <Reveal>
            <p className="section-label">Общие контакты</p>
            <h2 className="mt-3 text-3xl">Связаться со школой</h2>
            <div className="mt-7 divide-y divide-navy-100 border-y border-navy-100">
              <ContactRow icon={Mail} label="Электронная почта">
                {hasSetting(settings, "contact_email") ? (
                  <a href={`mailto:${settings.contact_email}`} className="break-all link-underline">{settings.contact_email}</a>
                ) : (
                  <span className="text-graphite-400">Уточняется</span>
                )}
              </ContactRow>
              <ContactRow icon={Phone} label="Телефон">
                {hasSetting(settings, "contact_phone") ? (
                  <a href={`tel:${settings.contact_phone.replace(/[^\d+]/g, "")}`} className="link-underline">{settings.contact_phone}</a>
                ) : (
                  <span className="text-graphite-400">Уточняется</span>
                )}
              </ContactRow>
              <ContactRow icon={MapPin} label="Адрес">
                {hasSetting(settings, "contact_address") ? settings.contact_address : <span className="text-graphite-400">Уточняется</span>}
              </ContactRow>
              <ContactRow icon={Clock} label="Режим работы">
                {hasSetting(settings, "work_hours") ? settings.work_hours : <span className="text-graphite-400">Уточняется</span>}
              </ContactRow>
            </div>

            {socials.length > 0 && (
              <div className="mt-6">
                <p className="text-[11px] uppercase tracking-[0.16em] text-graphite-500">Официальные страницы</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {socials.map((social) => (
                    <a key={social.label} href={social.href} target="_blank" rel="noopener noreferrer" className="chip">
                      {social.label} <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-7 border border-navy-100 bg-mist p-5">
              <p className="text-sm leading-relaxed text-graphite-600">
                Официальные сведения об учреждении, реквизиты и режим приёма размещены в разделе официальной информации.
              </p>
              <Link to="/oficialnaya-informaciya" className="btn btn-outline btn-sm mt-4">
                Официальная информация <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="relative min-h-[380px] overflow-hidden bg-navy-900">
              <div className="absolute inset-0 bg-grid-dark opacity-60" aria-hidden="true" />
              <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" aria-hidden="true" />
              <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent-500/30" aria-hidden="true" />
              <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-accent-600 text-white shadow-2xl">
                <MapPin size={26} aria-hidden="true" />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-950 to-transparent p-6 pt-24">
                <p className="font-display text-[11px] uppercase tracking-[0.2em] text-white/50">Гродно · Гродненская область</p>
                <p className="mt-2 max-w-md text-lg leading-snug text-white">
                  {locations.data && locations.data.items.length > 0
                    ? `Опубликовано объектов: ${locations.data.items.length}`
                    : "Схема расположения спортивных баз готовится к публикации"}
                </p>
                <p className="mt-1 max-w-md text-sm text-white/55">
                  {setting(settings, "contact_address", "Точный адрес уточняется у администрации.")}
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section bg-mist">
        <div className="container-site">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="section-label">Спортивные базы</p>
              <h2 className="mt-3 text-3xl sm:text-4xl">Адреса и маршруты</h2>
            </div>
          </div>
          <div className="mt-8">
            {locations.loading && <LoadingBlock rows={2} />}
            {locations.error && <ErrorState message={locations.error} onRetry={locations.reload} />}
            {!locations.loading && !locations.error && locations.data && locations.data.items.length === 0 && (
              <EmptyState
                icon={<Navigation size={22} aria-hidden="true" />}
                title="Адреса спортивных баз уточняются"
                text="Мы не публикуем неподтверждённые адреса и телефоны. Свяжитесь с администрацией, чтобы узнать, где проходят занятия вашей группы."
                action={<Link to="/obratnaya-svyaz" className="btn btn-primary btn-sm">Уточнить место занятий</Link>}
              />
            )}
            {locations.data && locations.data.items.length > 0 && (
              <div className="grid gap-6 md:grid-cols-2">
                {locations.data.items.map((location, index) => (
                  <Reveal key={location.id} delay={index * 60}>
                    <article className="card h-full">
                      <SmartImage path={location.photo_path} alt={location.name} className="h-52" fallbackLabel="Фотография входа">
                        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/50 to-transparent" aria-hidden="true" />
                      </SmartImage>
                      <div className="p-6">
                        <h3 className="text-xl">{location.name}</h3>
                        <p className="mt-2 flex items-start gap-2 text-sm text-graphite-700">
                          <MapPin size={16} className="mt-0.5 shrink-0 text-accent-600" aria-hidden="true" />
                          {location.address}
                        </p>
                        {location.phone && (
                          <a href={`tel:${location.phone.replace(/[^\d+]/g, "")}`} className="mt-2 flex items-center gap-2 text-sm link-underline">
                            <Phone size={15} aria-hidden="true" /> {location.phone}
                          </a>
                        )}
                        {location.schedule_note && (
                          <p className="mt-2 flex items-start gap-2 text-sm text-graphite-600">
                            <Clock size={15} className="mt-0.5 shrink-0 text-graphite-400" aria-hidden="true" />
                            {location.schedule_note}
                          </p>
                        )}
                        {location.map_url && (
                          <a href={location.map_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm mt-5">
                            <Navigation size={14} aria-hidden="true" /> Построить маршрут
                          </a>
                        )}
                      </div>
                    </article>
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-navy-900 py-12 text-white">
        <div className="container-site flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-display text-xl uppercase">Не нашли нужную информацию?</p>
            <p className="mt-1 text-sm text-white/60">Задайте вопрос — администрация ответит по указанному вами контакту.</p>
          </div>
          <Link to="/obratnaya-svyaz" className="btn btn-light shrink-0">Обратная связь <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>
    </>
  );
}

function ContactRow({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 py-4 sm:grid-cols-[180px_1fr]">
      <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-graphite-500">
        <Icon size={14} className="text-accent-600" aria-hidden="true" /> {label}
      </p>
      <div className="text-[15px] leading-relaxed text-graphite-800">{children}</div>
    </div>
  );
}
