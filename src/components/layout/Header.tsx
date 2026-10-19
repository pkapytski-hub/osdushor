import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  ChevronDown,
  ExternalLink,
  Camera,
  Globe,
  Mail,
  Menu,
  Phone,
  Play,
  Send,
  X,
} from "lucide-react";
import { useSiteSettings } from "@/lib/site-context";
import { cn, setting } from "@/lib/utils";
import { Logo } from "./Logo";

interface NavItem {
  label: string;
  to?: string;
  children?: { label: string; to: string; description?: string }[];
}

const NAV: NavItem[] = [
  {
    label: "О школе",
    children: [
      { label: "О школе", to: "/o-shkole", description: "Специализация и подготовка" },
      { label: "История", to: "/istoriya", description: "Этапы и традиции" },
      { label: "Тренерский состав", to: "/trenery", description: "Кто ведёт к результату" },
      { label: "Документы", to: "/dokumenty", description: "Нормативные и учредительные" },
    ],
  },
  {
    label: "Набор",
    children: [
      { label: "Набор в школу", to: "/nabor", description: "Возраст, документы, контакты" },
      { label: "Расписание занятий", to: "/raspisanie", description: "Группы и время" },
    ],
  },
  { label: "Новости", to: "/novosti" },
  {
    label: "Соревнования",
    children: [
      { label: "Календарь", to: "/kalendar", description: "Турниры и положения" },
      { label: "Результаты", to: "/rezultaty", description: "Итоги соревнований" },
    ],
  },
  {
    label: "Воспитанники",
    children: [
      { label: "Спортсмены и достижения", to: "/sportsmeny", description: "Победы школы" },
      { label: "Фотогалерея", to: "/fotogalereya", description: "Тренировки и турниры" },
    ],
  },
  {
    label: "Контакты",
    children: [
      { label: "Спортивные базы", to: "/kontakty", description: "Адреса и проезд" },
      { label: "Обратная связь", to: "/obratnaya-svyaz", description: "Задать вопрос" },
      { label: "Официальная информация", to: "/oficialnaya-informaciya", description: "Сведения об учреждении" },
    ],
  },
];

function Socials({ settings, className }: { settings: Record<string, string>; className?: string }) {
  const socials = [
    { key: "social_telegram", href: settings.social_telegram, label: "Telegram", Icon: Send },
    { key: "social_vk", href: settings.social_vk, label: "ВКонтакте", Icon: Globe },
    { key: "social_instagram", href: settings.social_instagram, label: "Instagram", Icon: Camera },
    { key: "social_youtube", href: settings.social_youtube, label: "YouTube", Icon: Play },
  ].filter((item) => item.href);
  if (socials.length === 0) return null;
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {socials.map(({ key, href, label, Icon }) => (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-8 w-8 items-center justify-center text-white/70 transition-colors hover:text-white"
          aria-label={label}
          title={label}
        >
          <Icon size={16} aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}

function NavGroup({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const active = item.children?.some((child) => location.pathname === child.to) ?? false;

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className={cn(
          "flex items-center gap-1 py-2 text-[12px] font-semibold uppercase tracking-[0.08em] transition-colors",
          active ? "text-accent-600" : "text-navy-900 hover:text-accent-600",
        )}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
      >
        {item.label}
        <ChevronDown size={13} className={cn("transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 w-72 border border-navy-100 bg-white p-2 shadow-xl">
          {item.children?.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              className={({ isActive }) =>
                cn(
                  "block border-l-2 px-3 py-2.5 transition-colors",
                  isActive ? "border-accent-600 bg-mist" : "border-transparent hover:border-navy-300 hover:bg-mist/70",
                )
              }
            >
              <span className="block text-[13px] font-semibold text-navy-900">{child.label}</span>
              {child.description && <span className="mt-0.5 block text-xs text-graphite-500">{child.description}</span>}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { settings } = useSiteSettings();
  const location = useLocation();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.body.style.overflow = "hidden";
    }
    if (!open && dialog.open) dialog.close();
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const email = settings.contact_email;
  const phone = settings.contact_phone;

  return (
    <dialog
      ref={dialogRef}
      className="m-0 h-full max-h-none w-full max-w-none border-0 bg-white p-0 backdrop:bg-navy-950/60 lg:hidden"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        document.body.style.overflow = "";
        if (open) onClose();
      }}
      aria-label="Меню сайта"
    >
      <div className="flex h-full flex-col overflow-y-auto">
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-navy-100 px-5">
          <Logo onClick={onClose} />
          <button type="button" className="flex h-11 w-11 items-center justify-center border border-navy-200" onClick={onClose} aria-label="Закрыть меню">
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <nav className="flex-1 px-5 py-6" aria-label="Мобильная навигация">
          <ul className="space-y-1">
            <li>
              <Link to="/" onClick={onClose} className="block border-b border-navy-100 py-3 font-display text-lg uppercase text-navy-900">
                Главная
              </Link>
            </li>
            {NAV.filter((item) => item.to).map((item) => (
              <li key={item.label}>
                <Link to={item.to!} onClick={onClose} className="block border-b border-navy-100 py-3 font-display text-lg uppercase text-navy-900">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-8 space-y-3">
            {NAV.filter((item) => item.children).map((item) => (
              <details key={item.label} className="group border border-navy-100">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-display text-sm uppercase tracking-[0.08em] text-navy-900">
                  {item.label}
                  <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="border-t border-navy-100 px-4 py-2">
                  {item.children?.map((child) => (
                    <Link
                      key={child.to}
                      to={child.to}
                      onClick={onClose}
                      className="block border-b border-navy-100/70 py-2.5 text-sm text-graphite-700 last:border-0"
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </nav>
        <div className="shrink-0 border-t border-navy-100 bg-mist px-5 py-5">
          <Link to="/nabor" onClick={onClose} className="btn btn-primary w-full">
            Записаться в школу
          </Link>
          <div className="mt-4 space-y-2 text-sm text-graphite-600">
            {phone && (
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-2">
                <Phone size={15} aria-hidden="true" /> {phone}
              </a>
            )}
            {email && (
              <a href={`mailto:${email}`} className="flex items-center gap-2">
                <Mail size={15} aria-hidden="true" /> {email}
              </a>
            )}
            <Link to="/oficialnaya-informaciya" onClick={onClose} className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.12em] text-navy-800">
              Официальная информация <ExternalLink size={12} aria-hidden="true" />
            </Link>
          </div>
          <Socials settings={settings} className="mt-2 [&_a]:text-navy-700 [&_a:hover]:text-accent-600" />
        </div>
      </div>
    </dialog>
  );
}

export function Header() {
  const { settings } = useSiteSettings();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const phone = settings.contact_phone;
  const email = settings.contact_email;

  return (
    <>
      <a
        href="#main"
        className="fixed left-4 top-3 z-[100] -translate-y-24 bg-accent-600 px-4 py-2 text-sm font-medium text-white transition-transform focus:translate-y-0"
      >
        Перейти к содержанию
      </a>
      <div className="hidden bg-navy-950 text-white lg:block">
        <div className="container-site flex h-10 items-center justify-between gap-6 text-[12px] text-white/65">
          <p className="truncate" title={setting(settings, "org_full_name")}>
            {setting(settings, "org_full_name")}
          </p>
          <div className="flex shrink-0 items-center gap-5">
            {email && (
              <a href={`mailto:${email}`} className="inline-flex items-center gap-1.5 transition-colors hover:text-white">
                <Mail size={13} aria-hidden="true" /> {email}
              </a>
            )}
            {phone && (
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 transition-colors hover:text-white">
                <Phone size={13} aria-hidden="true" /> {phone}
              </a>
            )}
            <Socials settings={settings} />
            <Link to="/oficialnaya-informaciya" className="border-l border-white/15 pl-5 uppercase tracking-[0.12em] transition-colors hover:text-white">
              Официально
            </Link>
          </div>
        </div>
      </div>
      <header
        className={cn(
          "sticky top-0 z-50 border-b bg-white/95 backdrop-blur transition-shadow",
          scrolled ? "border-navy-200 shadow-[0_8px_30px_-24px_rgba(10,22,49,0.6)]" : "border-navy-100",
        )}
      >
        <div className="container-site flex h-[76px] items-center justify-between gap-4">
          <Logo />
          <nav className="hidden items-center gap-4 xl:flex" aria-label="Основная навигация">
            {NAV.map((item) =>
              item.children ? (
                <NavGroup key={item.label} item={item} />
              ) : (
                <NavLink
                  key={item.label}
                  to={item.to!}
                  className={({ isActive }) =>
                    cn(
                      "py-2 text-[12px] font-semibold uppercase tracking-[0.08em] transition-colors",
                      isActive ? "text-accent-600" : "text-navy-900 hover:text-accent-600",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ),
            )}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/nabor" className="btn btn-primary btn-sm hidden md:inline-flex">
              Записаться в школу
            </Link>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center border border-navy-200 text-navy-900 xl:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Открыть меню"
              aria-expanded={mobileOpen}
            >
              <Menu size={22} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>
      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}
