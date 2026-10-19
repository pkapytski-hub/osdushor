import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError, api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { RESOURCES } from "./resources";
import { useAdmin } from "./AdminGuard";
import { AdminPageHeader, ConfirmDialog, StatusBadge } from "./admin-ui";
import { ResourcePreview } from "./ResourcePreview";
import { DemoBadge } from "@/components/site/primitives";
import { formatFileSize } from "@/lib/format";

type Row = Record<string, unknown>;

export default function ResourceListPage({ resourceKey }: { resourceKey: string }) {
  const config = RESOURCES[resourceKey];
  const { user } = useAdmin();
  const list = useAsync((signal) => api.admin.list<Row>(resourceKey, signal), [resourceKey]);
  const [search, setSearch] = useState("");
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Row | null>(null);

  if (!config) return <p>Раздел не найден.</p>;

  const items = (list.data?.items ?? []).filter((item) => {
    if (!search.trim()) return true;
    const value = Object.values(item).map(String).join(" ").toLowerCase();
    return value.includes(search.trim().toLowerCase());
  });

  const confirmDelete = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api.admin.remove(resourceKey, String(toDelete.id));
      toast.success("Запись удалена");
      setToDelete(null);
      list.reload();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Не удалось удалить запись");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Управление контентом"
        title={config.title}
        description={config.description}
        actions={
          <Link to={`/admin/${resourceKey}/new`} className="btn btn-primary btn-sm">
            <Plus size={15} aria-hidden="true" /> Добавить
          </Link>
        }
      />
      {user.role === "editor" && (
        <p className="border-l-2 border-navy-300 bg-white px-4 py-2 text-xs leading-relaxed text-graphite-500">
          Роль редактора: доступно управление контентом. Настройки сайта и доступы изменяет администратор.
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-graphite-400" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="field-input pl-10"
            placeholder="Поиск по записям"
            aria-label="Поиск по записям"
          />
        </div>
        <p className="text-xs text-graphite-500">Всего: {list.data?.items.length ?? 0}</p>
      </div>

      <div className="border border-navy-100 bg-white">
        {list.loading && (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse bg-navy-50" />
            ))}
          </div>
        )}
        {list.error && (
          <div className="p-6 text-sm text-accent-700">
            <p>{list.error}</p>
            <button type="button" className="btn btn-outline btn-sm mt-3" onClick={list.reload}>Повторить</button>
          </div>
        )}
        {!list.loading && !list.error && items.length === 0 && (
          <div className="p-10 text-center">
            <p className="font-display text-lg uppercase text-navy-900">{search ? "Ничего не найдено" : "Записей пока нет"}</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-graphite-500">
              {search ? "Измените поисковый запрос." : "Создайте первую запись — она появится в этом списке и, после публикации, на сайте."}
            </p>
            {!search && (
              <Link to={`/admin/${resourceKey}/new`} className="btn btn-primary btn-sm mt-4">
                <Plus size={14} aria-hidden="true" /> Добавить
              </Link>
            )}
          </div>
        )}
        {items.length > 0 && (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-mist text-[10px] uppercase tracking-[0.14em] text-graphite-500">
                  <tr>
                    {config.columns.map((column) => (
                      <th key={column.key} scope="col" className="px-4 py-3 font-medium">{column.label}</th>
                    ))}
                    <th scope="col" className="px-4 py-3 text-right font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-100">
                  {items.map((item) => (
                    <tr key={String(item.id)} className="align-middle hover:bg-mist/50">
                      {config.columns.map((column, index) => (
                        <td key={column.key} className={index === 0 ? "max-w-[340px] px-4 py-3 font-medium text-navy-900" : "px-4 py-3 text-graphite-600"}>
                          <div className="flex items-center gap-2">
                            {column.render ? column.render(item) : String(item[column.key] ?? "—")}
                            {index === 0 && item.is_demo ? <DemoBadge /> : null}
                            {index === 0 && resourceKey === "documents" && item.file_size ? (
                              <span className="text-[10px] text-graphite-400">{formatFileSize(Number(item.file_size))}</span>
                            ) : null}
                          </div>
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {config.preview && (
                            <button type="button" className="flex h-8 w-8 items-center justify-center text-graphite-500 hover:bg-mist hover:text-navy-900" onClick={() => setPreview(item)} aria-label="Предпросмотр" title="Предпросмотр">
                              <Eye size={16} aria-hidden="true" />
                            </button>
                          )}
                          <Link to={`/admin/${resourceKey}/${item.id}`} className="flex h-8 w-8 items-center justify-center text-graphite-500 hover:bg-mist hover:text-navy-900" aria-label="Редактировать" title="Редактировать">
                            <Pencil size={16} aria-hidden="true" />
                          </Link>
                          <button type="button" className="flex h-8 w-8 items-center justify-center text-graphite-500 hover:bg-accent-50 hover:text-accent-700" onClick={() => setToDelete(item)} aria-label="Удалить" title="Удалить">
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-navy-100 md:hidden">
              {items.map((item) => (
                <li key={String(item.id)} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium leading-snug text-navy-900">{String(item[config.titleField] ?? "Без названия")}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-graphite-500">
                        {config.columns.slice(1).map((column) =>
                          column.hideOnMobile ? null : (
                            <span key={column.key}>{column.render ? column.render(item) : String(item[column.key] ?? "")}</span>
                          ),
                        )}
                        {item.is_demo ? <DemoBadge /> : null}
                      </div>
                      {"is_published" in item && (
                        <div className="mt-2"><StatusBadge published={Boolean(item.is_published)} /></div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    {config.preview && (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setPreview(item)}>
                        <Eye size={14} aria-hidden="true" /> Просмотр
                      </button>
                    )}
                    <Link to={`/admin/${resourceKey}/${item.id}`} className="btn btn-primary btn-sm">
                      <Pencil size={14} aria-hidden="true" /> Изменить
                    </Link>
                    <button type="button" className="btn btn-ghost btn-sm !text-accent-700" onClick={() => setToDelete(item)}>
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Удалить запись?"
        text={`Запись «${toDelete ? String(toDelete[config.titleField] ?? "") : ""}» будет удалена без возможности восстановления.`}
        busy={busy}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
      {config.preview && (
        <ResourcePreview
          open={Boolean(preview)}
          kind={config.preview}
          value={preview ?? {}}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
