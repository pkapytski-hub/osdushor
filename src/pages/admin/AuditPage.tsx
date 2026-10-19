import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { AdminPageHeader } from "./admin-ui";
import { formatDateTime } from "@/lib/format";

const ACTION_LABELS: Record<string, string> = {
  create: "Создание",
  update: "Изменение",
  delete: "Удаление",
  upload: "Загрузка файла",
  login: "Вход",
  logout: "Выход",
  setup: "Первичная настройка",
  password_change: "Смена пароля",
};

export default function AuditPage() {
  const audit = useAsync((signal) => api.admin.audit(signal), []);
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Безопасность"
        title="Журнал действий"
        description="Последние 100 операций в панели управления: кто и когда изменил контент, настройки или доступы."
      />
      <div className="border border-navy-100 bg-white">
        {audit.loading && <div className="p-6 text-sm text-graphite-500">Загрузка журнала…</div>}
        {audit.error && (
          <div className="p-6 text-sm text-accent-700">
            <p>{audit.error}</p>
            <button type="button" className="btn btn-outline btn-sm mt-3" onClick={audit.reload}>Повторить</button>
          </div>
        )}
        {audit.data && audit.data.items.length === 0 && (
          <div className="p-10 text-center text-sm text-graphite-500">Записей пока нет.</div>
        )}
        {audit.data && audit.data.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-mist text-[10px] uppercase tracking-[0.14em] text-graphite-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Время</th>
                  <th scope="col" className="px-4 py-3 font-medium">Сотрудник</th>
                  <th scope="col" className="px-4 py-3 font-medium">Действие</th>
                  <th scope="col" className="px-4 py-3 font-medium">Объект</th>
                  <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">Детали</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {audit.data.items.map((entry) => (
                  <tr key={entry.id} className="hover:bg-mist/40">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-graphite-500">{formatDateTime(entry.created_at)}</td>
                    <td className="px-4 py-3 text-xs text-graphite-700">{entry.actor_email || "—"}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="badge border border-navy-200 text-navy-800">{ACTION_LABELS[entry.action] ?? entry.action}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-graphite-600">
                      {entry.entity}
                      {entry.entity_id ? <span className="ml-1 text-graphite-400">· {entry.entity_id.slice(0, 8)}…</span> : null}
                    </td>
                    <td className="hidden max-w-[320px] truncate px-4 py-3 text-xs text-graphite-500 md:table-cell">{entry.details ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
