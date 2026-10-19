import { useEffect, useRef, useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  ExternalLink,
  FileText,
  Gauge,
  Image,
  Landmark,
  LayoutList,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Medal,
  Newspaper,
  Search,
  Settings,
  Shield,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import type { MeInfo, StaffRole } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface AdminContext {
  user: NonNullable<MeInfo["user"]>;
}
export function useAdmin(): AdminContext {
  return useOutletContext<AdminContext>();
}

const NAV_GROUPS: { title: string; items: { to: string; label: string; icon: typeof Gauge; adminOnly?: boolean }[] }[] = [
  {
    title: "Обзор",
    items: [{ to: "/admin", label: "Дашборд", icon: Gauge }],
  },
  {
    title: "Контент",
    items: [
      { to: "/admin/news", label: "Новости", icon: Newspaper },
      { to: "/admin/competitions", label: "Соревнования", icon: CalendarDays },
      { to: "/admin/achievements", label: "Достижения", icon: Medal },
      { to: "/admin/coaches", label: "Тренеры", icon: Users },
      { to: "/admin/gallery", label: "Фотогалерея", icon: Image },
      { to: "/admin/documents", label: "Документы", icon: FileText },
      { to: "/admin/history", label: "История", icon: Landmark },
    ],
  },
  {
    title: "Организация",
    items: [
      { to: "/admin/locations", label: "Спортивные базы", icon: MapPin },
      { to: "/admin/schedule", label: "Расписание", icon: LayoutList },
      { to: "/admin/messages", label: "Обращения", icon: Mail },
      { to: "/admin/seo", label: "SEO страниц", icon: Search },
      { to: "/admin/settings", label: "Настройки сайта", icon: Settings, adminOnly: true },
      { to: "/admin/staff", label: "Доступы", icon: UserCog, adminOnly: true },
      { to: "/admin/audit", label: "Журнал действий", icon: ClipboardList, adminOnly: true },
    ],
  },
  {
    title: "Аккаунт",
    items: [{ to: "/admin/security", label: "Безопасность и пароль", icon: Shield }],
  },
];

function SidebarContent({ user, onNavigate }: { user: AdminContext["user"]; onNavigate?: () => void }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.adminOnly || user.role === "admin"),
  }));
  return (
    <div className="flex h-full flex-col bg-navy-950 text-white">
      <div className="flex h-[76px] shrink-0 items-center gap-3 border-b border-white/10 px-5">
        <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden bg-white text-navy-900" aria-hidden="true">
          <span className="font-display text-xl font-semibold">О</span>
          <span className="absolute bottom-0 left-0 h-1 w-full bg-accent-600" />
        </span>
        <div>
          <p className="font-display text-[13px] uppercase tracking-[0.08em]">ОСДЮШОР</p>
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Панель управления</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Навигация панели управления">
        {groups.map((group) => (
          <div key={group.title} className="mb-5">
            <p className="px-3 text-[10px] uppercase tracking-[0.18em] text-white/35">{group.title}</p>
            <ul className="mt-2 space-y-0.5">
              {group.items
                .filter((item, index, array) => array.findIndex((entry) => entry.to === item.to) === index)
                .map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === "/admin"}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2.5 border-l-2 px-3 py-2 text-[13px] transition-colors",
                          isActive
                            ? "border-accent-500 bg-white/10 text-white"
                            : "border-transparent text-white/60 hover:bg-white/5 hover:text-white",
                        )
                      }
                    >
                      <item.icon size={16} aria-hidden="true" />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="shrink-0 border-t border-white/10 p-4">
        <p className="truncate text-sm font-medium text-white">{user.name}</p>
        <p className="truncate text-[11px] text-white/45">
          {user.email} · {user.role === "admin" ? "администратор" : "редактор"}
        </p>
        <div className="mt-3 flex gap-2">
          <Link to="/" target="_blank" className="btn btn-sm flex-1 border border-white/20 text-white hover:bg-white hover:text-navy-900">
            <ExternalLink size={13} aria-hidden="true" /> Сайт
          </Link>
          <button
            type="button"
            className="btn btn-sm flex-1 border border-white/20 text-white hover:border-accent-500 hover:bg-accent-600"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.auth.logout();
                toast.success("Вы вышли из панели");
                navigate("/admin/login");
              } catch (error) {
                toast.error(error instanceof ApiError ? error.message : "Не удалось выйти");
              } finally {
                setBusy(false);
              }
            }}
          >
            <LogOut size={13} aria-hidden="true" /> Выйти
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminShell({ user }: { user: AdminContext["user"] }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = mobileRef.current;
    if (!dialog) return;
    if (mobileOpen && !dialog.open) {
      dialog.showModal();
      document.body.style.overflow = "hidden";
    }
    if (!mobileOpen && dialog.open) dialog.close();
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-mist">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] lg:block">
        <SidebarContent user={user} />
      </aside>
      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 flex h-[64px] items-center justify-between gap-4 border-b border-navy-100 bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center border border-navy-200 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Открыть меню панели"
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            <p className="text-[12px] uppercase tracking-[0.14em] text-graphite-500">
              {user.role === "admin" ? "Администратор" : "Редактор"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/" className="hidden items-center gap-1.5 text-[12px] uppercase tracking-[0.12em] text-graphite-500 hover:text-accent-600 sm:inline-flex">
              Открыть сайт <ArrowLeft size={13} className="rotate-180" aria-hidden="true" />
            </Link>
            <span className="flex h-8 w-8 items-center justify-center bg-navy-900 font-display text-sm text-white" aria-hidden="true">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet context={{ user } satisfies AdminContext} />
        </main>
      </div>

      <dialog
        ref={mobileRef}
        className="m-0 h-full max-h-none w-[280px] max-w-[85vw] border-0 bg-navy-950 p-0 backdrop:bg-navy-950/60 lg:hidden"
        onCancel={(event) => {
          event.preventDefault();
          setMobileOpen(false);
        }}
        onClose={() => {
          document.body.style.overflow = "";
          if (mobileOpen) setMobileOpen(false);
        }}
        aria-label="Меню панели управления"
      >
        <button
          type="button"
          className="absolute right-2 top-3 z-10 flex h-9 w-9 items-center justify-center text-white/70 hover:text-white"
          onClick={() => setMobileOpen(false)}
          aria-label="Закрыть меню"
        >
          <X size={20} aria-hidden="true" />
        </button>
        <SidebarContent user={user} onNavigate={() => setMobileOpen(false)} />
      </dialog>
    </div>
  );
}

export function AdminGuard() {
  const me = useAsync((signal) => api.auth.me(signal), []);
  const location = useLocation();

  if (me.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist">
        <p className="font-display text-sm uppercase tracking-[0.16em] text-graphite-500">Проверка доступа…</p>
      </div>
    );
  }
  if (me.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist px-4">
        <div className="max-w-md border border-accent-600/30 bg-white p-6 text-center">
          <p className="text-lg font-medium text-navy-900">Сервер недоступен</p>
          <p className="mt-2 text-sm text-graphite-600">{me.error}</p>
          <button type="button" className="btn btn-outline btn-sm mt-4" onClick={me.reload}>Повторить</button>
        </div>
      </div>
    );
  }
  if (me.data?.setup_required) return <Navigate to="/admin/setup" replace />;
  if (!me.data?.user) {
    return <Navigate to={`/admin/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return <AdminShell user={me.data.user} />;
}

export function RoleNote({ role }: { role: StaffRole }) {
  if (role === "admin") return null;
  return (
    <p className="border-l-2 border-navy-300 bg-white px-4 py-2 text-xs leading-relaxed text-graphite-500">
      Вы работаете в роли редактора. Управление доступами и настройками сайта доступно администратору.
    </p>
  );
}
