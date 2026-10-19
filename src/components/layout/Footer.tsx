import { Link } from "react-router-dom";
import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import { useSiteSettings } from "@/lib/site-context";
import { setting } from "@/lib/utils";
import { Logo } from "./Logo";

const SCHOOL_LINKS = [
  { to: "/o-shkole", label: "О школе" },
  { to: "/istoriya", label: "История" },
  { to: "/trenery", label: "Тренерский состав" },
  { to: "/nabor", label: "Набор в школу" },
  { to: "/raspisanie", label: "Расписание занятий" },
];

const LIFE_LINKS = [
  { to: "/novosti", label: "Новости" },
  { to: "/kalendar", label: "Календарь соревнований" },
  { to: "/rezultaty", label: "Результаты" },
  { to: "/sportsmeny", label: "Спортсмены и достижения" },
  { to: "/fotogalereya", label: "Фотогалерея" },
];

const INFO_LINKS = [
  { to: "/oficialnaya-informaciya", label: "Официальная информация" },
  { to: "/dokumenty", label: "Документы" },
  { to: "/politika-personalnyh-dannyh", label: "Персональные данные" },
  { to: "/kontakty", label: "Спортивные базы и контакты" },
  { to: "/obratnaya-svyaz", label: "Обратная связь" },
];

export function Footer() {
  const { settings } = useSiteSettings();
  const email = settings.contact_email;
  const phone = settings.contact_phone;
  const address = settings.contact_address;
  const year = new Date().getFullYear();
  const socials = [
    { href: settings.social_telegram, label: "Telegram" },
    { href: settings.social_vk, label: "ВКонтакте" },
    { href: settings.social_instagram, label: "Instagram" },
    { href: settings.social_youtube, label: "YouTube" },
  ].filter((item) => item.href);

  return (
    <footer className="relative bg-navy-950 text-white">
      <div className="h-1 w-full bg-accent-600" aria-hidden="true" />
      <div className="container-site py-14 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
          <div>
            <div className="[&_span]:text-white [&_span:last-child]:text-white/50">
              <Logo />
            </div>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/60">
              {setting(settings, "about_lead")}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 border border-white/20 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-white/70 transition-colors hover:border-white hover:text-white"
                >
                  {social.label} <ArrowUpRight size={11} aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          <FooterColumn title="Школа" links={SCHOOL_LINKS} />
          <FooterColumn title="Жизнь школы" links={LIFE_LINKS} />

          <div>
            <h2 className="font-display text-[13px] uppercase tracking-[0.2em] text-white/50">Контакты</h2>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              {address && (
                <li className="flex items-start gap-2.5">
                  <MapPin size={15} className="mt-0.5 shrink-0 text-accent-400" aria-hidden="true" />
                  <span>{address}</span>
                </li>
              )}
              {phone && (
                <li className="flex items-start gap-2.5">
                  <Phone size={15} className="mt-0.5 shrink-0 text-accent-400" aria-hidden="true" />
                  <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="transition-colors hover:text-white">
                    {phone}
                  </a>
                </li>
              )}
              {email && (
                <li className="flex items-start gap-2.5">
                  <Mail size={15} className="mt-0.5 shrink-0 text-accent-400" aria-hidden="true" />
                  <a href={`mailto:${email}`} className="break-all transition-colors hover:text-white">
                    {email}
                  </a>
                </li>
              )}
              {!address && !phone && !email && (
                <li className="text-white/50">Контактные данные уточняются администрацией.</li>
              )}
            </ul>
            <div className="mt-6">
              <p className="font-display text-[13px] uppercase tracking-[0.2em] text-white/50">Официально</p>
              <ul className="mt-3 space-y-2">
                {INFO_LINKS.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="text-sm text-white/65 transition-colors hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-6">
          <p className="text-[11px] leading-relaxed text-white/40">{setting(settings, "photo_disclaimer", "")}</p>
          <div className="mt-4 flex flex-col gap-2 text-[12px] text-white/40 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {year} {setting(settings, "org_full_name")}
            </p>
            <div className="flex items-center gap-4">
              <span>Государственное учреждение</span>
              <Link to="/admin" className="transition-colors hover:text-white/70">
                Панель управления
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <h2 className="font-display text-[13px] uppercase tracking-[0.2em] text-white/50">{title}</h2>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.to}>
            <Link to={link.to} className="text-sm text-white/65 transition-colors hover:text-white">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
