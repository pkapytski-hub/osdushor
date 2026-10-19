import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  Download,
  FilePlus2,
  Mail,
  MessageSquare,
  Newspaper,
  Plus,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError, api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { useAdmin } from "./AdminGuard";
import { AdminCard, AdminPageHeader, ConfirmDialog } from "./admin-ui";
import { SETTING_GROUP_BY_KEY, SETTING_LABELS } from "./settings-config";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const TOPIC_LABELS: Record<string, string> = {
  general: "Общий вопрос",
  enrollment: "Набор",
  schedule: "Расписание",
  competitions: "Соревнования",
  documents: "Документы",
};

export default function DashboardPage() {
  const { user } = useAdmin();
  const stats = useAsync((signal) => api.admin.stats(signal), []);
  const [demoOpen, setDemoOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const deleteDemo = async () => {
    setBusy(true);
    try {
      await api.admin.demoDelete();
      toast.success("Демонстрационные материалы удалены");
      setDemoOpen(false);
      stats.reload();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Не удалось удалить демо-данные");
    } finally {
      setBusy(false);
    }
  };

  const cards = [
    { label: "Новости", value: stats.data?.counts.news, to: "/admin/news", icon: Newspaper },
    { label: "Соревнования", value: stats.data?.counts.competitions, to: "/admin/competitions", icon: CalendarPlus },
    { label: "Достижения", value: stats.data?.counts.achievements, to: "/admin/achievements", icon: ShieldCheck },
    { label: "Тренеры", value: stats.data?.counts.coaches, to: "/admin/coaches", icon: CheckCircle2 },
    { label: "Фотографии", value: stats.data?.counts.gallery, to: "/admin/gallery", icon: FilePlus2 },
    { label: "Новые обращения", value: stats.data?.counts.new_messages, to: "/admin/messages", icon: Mail },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Панель управления"
        title={`Здравствуйте, ${user.name}`}
        description="Краткая сводка, готовность к публикации и быстрые действия."
        actions={
          <>
            <Link to="/admin/news/new" className="btn btn-primary btn-sm"><Plus size={15} aria-hidden="true" /> Новость</Link>
            <Link to="/admin/competitions/new" className="btn btn-outline btn-sm"><Plus size={15} aria-hidden="true" /> Соревнование</Link>
          </>
        }
      />

      {stats.loading && <div className="border border-navy-100 bg-white p-8 text-sm text-graphite-500">Загрузка сводки…</div>}
      {stats.error && (
        <div className="border border-accent-600/30 bg-white p-6 text-sm text-accent-700">
          <p>{stats.error}</p>
          <button type="button" className="btn btn-outline btn-sm mt-3" onClick={stats.reload}>Повторить</button>
        </div>
      )}

      {stats.data && (
        <>
          {stats.data.demo_mode && (
            <div className="flex flex-col gap-4 border border-accent-600/40 bg-accent-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 text-sm leading-relaxed text-accent-900">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                <p>
                  <strong>Включён демонстрационный режим.</strong> Материалы с пометкой «Демо» видны на сайте и не
                  являются официальными. На production-окружении режим должен быть отключён.
                </p>
              </div>
              {user.role === "admin" && (
                <button type="button" className="btn btn-outline btn-sm shrink-0 !border-accent-600 !text-accent-700" onClick={() => setDemoOpen(true)}>
                  <Trash2 size={14} aria-hidden="true" /> Удалить демо-данные
                </button>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <Link key={card.label} to={card.to} className="group border border-navy-100 bg-white p-5 transition-colors hover:border-navy-300">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-graphite-500">{card.label}</p>
                  <card.icon size={18} className="text-graphite-300 group-hover:text-accent-600" aria-hidden="true" />
                </div>
                <p className="mt-3 font-display text-4xl leading-none text-navy-900">{card.value ?? "—"}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.12em] text-graphite-400 group-hover:text-accent-600">
                  Открыть <ArrowRight size={12} aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <AdminCard>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg normal-case tracking-normal">Готовность к публикации</h2>
                  <p className="mt-1 text-xs text-graphite-500">Проверьте обязательные сведения перед запуском сайта.</p>
                </div>
                <ShieldCheck size={20} className="text-accent-600" aria-hidden="true" />
              </div>
              <ul className="mt-4 divide-y divide-navy-100 border-y border-navy-100">
                {[
                  { key: "contacts_verified", label: "Контакты и адреса" },
                  { key: "enrollment_verified", label: "Условия набора" },
                  { key: "official_verified", label: "Реквизиты учреждения" },
                ].map((item) => {
                  const ok = stats.data?.verification?.[item.key];
                  return (
                    <li key={item.key} className="flex items-center justify-between gap-3 py-3">
                      <span className="text-sm text-graphite-700">{item.label}</span>
                      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", ok ? "text-emerald-700" : "text-accent-700")}>
                        {ok ? <CheckCircle2 size={15} aria-hidden="true" /> : <XCircle size={15} aria-hidden="true" />}
                        {ok ? "Проверено" : "Требует проверки"}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {stats.data.empty_settings.length > 0 ? (
                <div className="mt-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-graphite-500">Не заполнено</p>
                  <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {stats.data.empty_settings.slice(0, 8).map((key) => (
                      <li key={key}>
                        <Link to={`/admin/settings#settings-${SETTING_GROUP_BY_KEY[key] ?? "organization"}`} className="flex items-center gap-1.5 text-xs text-graphite-600 hover:text-accent-600">
                          <span className="h-1 w-1 bg-accent-600" aria-hidden="true" /> {SETTING_LABELS[key] ?? key}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {stats.data.empty_settings.length > 8 && (
                    <Link to="/admin/settings" className="mt-3 inline-flex items-center gap-1 text-xs text-navy-800 underline underline-offset-2">
                      Все настройки <ArrowRight size={12} aria-hidden="true" />
                    </Link>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm text-emerald-700">Все поля настроек заполнены.</p>
              )}
            </AdminCard>

            <AdminCard>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg normal-case tracking-normal">Последние обращения</h2>
                  <p className="mt-1 text-xs text-graphite-500">Новые сообщения из формы обратной связи.</p>
                </div>
                <MessageSquare size={20} className="text-accent-600" aria-hidden="true" />
              </div>
              {stats.data.recent_messages.length === 0 ? (
                <p className="mt-5 border border-dashed border-navy-200 px-4 py-6 text-center text-sm text-graphite-500">
                  Новых обращений нет.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-navy-100 border-y border-navy-100">
                  {stats.data.recent_messages.map((message) => (
                    <li key={message.id}>
                      <Link to="/admin/messages" className="flex items-center justify-between gap-3 py-3 hover:text-accent-600">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-navy-900">{message.name}</span>
                          <span className="block text-xs text-graphite-500">{TOPIC_LABELS[message.topic] ?? message.topic} · {formatDateTime(message.submitted_at)}</span>
                        </span>
                        <ArrowRight size={14} className="shrink-0 text-graphite-300" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/admin/messages" className="btn btn-outline btn-sm mt-4 w-full">Все обращения</Link>
            </AdminCard>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { to: "/admin/news/new", label: "Опубликовать новость", icon: Newspaper },
              { to: "/admin/documents/new", label: "Загрузить документ", icon: FilePlus2 },
              { to: "/admin/gallery/new", label: "Добавить фото", icon: FilePlus2 },
              { to: "/admin/schedule/new", label: "Изменить расписание", icon: CalendarPlus },
            ].map((action) => (
              <Link key={action.to} to={action.to} className="flex items-center gap-3 border border-navy-100 bg-white p-4 text-sm text-navy-900 hover:border-navy-300">
                <action.icon size={17} className="text-accent-600" aria-hidden="true" />
                {action.label}
              </Link>
            ))}
          </div>

          {user.role === "admin" && (
            <div className="flex flex-wrap items-center justify-between gap-3 border border-navy-100 bg-white p-4">
              <div>
                <p className="text-sm font-medium text-navy-900">Резервная копия контента</p>
                <p className="text-xs text-graphite-500">Экспорт настроек, публикаций и документов в JSON. Файлы хранятся в R2 отдельно.</p>
              </div>
              <a href={api.admin.exportUrl} className="btn btn-outline btn-sm" download>
                <Download size={14} aria-hidden="true" /> Скачать экспорт
              </a>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={demoOpen}
        title="Удалить все демо-данные?"
        text="Будут удалены демонстрационные новости, соревнования и фотографии. Реальные записи останутся без изменений."
        confirmLabel="Удалить демо-данные"
        busy={busy}
        onCancel={() => setDemoOpen(false)}
        onConfirm={deleteDemo}
      />
    </div>
  );
}
