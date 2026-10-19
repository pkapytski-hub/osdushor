import { useEffect, useState } from "react";
import { Save, Search } from "lucide-react";
import { toast } from "sonner";
import { ApiError, api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { AdminPageHeader, MediaInput } from "./admin-ui";
import { Field, FormAlert, TextInput, Textarea } from "@/components/ui/Field";
import type { PageSeo } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_LABELS: Record<string, string> = {
  "/": "Главная",
  "/o-shkole": "О школе",
  "/istoriya": "История",
  "/trenery": "Тренерский состав",
  "/nabor": "Набор в школу",
  "/raspisanie": "Расписание",
  "/novosti": "Новости",
  "/kalendar": "Календарь соревнований",
  "/rezultaty": "Результаты",
  "/sportsmeny": "Спортсмены и достижения",
  "/fotogalereya": "Фотогалерея",
  "/dokumenty": "Документы",
  "/kontakty": "Контакты",
  "/obratnaya-svyaz": "Обратная связь",
  "/oficialnaya-informaciya": "Официальная информация",
  "/politika-personalnyh-dannyh": "Персональные данные",
};

export default function SeoAdminPage() {
  const seo = useAsync((signal) => api.admin.seo(signal), []);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [draft, setDraft] = useState<PageSeo | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!seo.data?.items.length) return;
    const current = selectedPath ? seo.data.items.find((item) => item.path === selectedPath) : seo.data.items[0];
    if (current) {
      setSelectedPath(current.path);
      setDraft(current);
      setDirty(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seo.data]);

  const select = (path: string) => {
    if (dirty && !window.confirm("Несохранённые изменения будут потеряны. Продолжить?")) return;
    const item = seo.data?.items.find((entry) => entry.path === path);
    if (!item) return;
    setSelectedPath(path);
    setDraft(item);
    setDirty(false);
    setError(null);
  };

  const update = (patch: Partial<PageSeo>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    setDirty(true);
  };

  const save = async () => {
    if (!draft) return;
    setError(null);
    if (draft.title.trim().length < 5) {
      setError("SEO-заголовок слишком короткий.");
      return;
    }
    if (draft.description.trim().length < 20) {
      setError("SEO-описание должно содержать не менее 20 символов.");
      return;
    }
    setSaving(true);
    try {
      await api.admin.saveSeo(draft.path, {
        title: draft.title,
        description: draft.description,
        og_image: draft.og_image,
        is_indexable: draft.is_indexable,
      });
      toast.success("SEO-настройки сохранены");
      setDirty(false);
      seo.reload();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Не удалось сохранить SEO-настройки.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Поиск и соцсети"
        title="SEO страниц"
        description="Уникальные заголовки и описания для статических страниц. Заголовки новостей и соревнований настраиваются в их карточках."
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving || !dirty}>
            <Save size={15} aria-hidden="true" /> {saving ? "Сохраняем…" : "Сохранить"}
          </button>
        }
      />
      {error && <FormAlert>{error}</FormAlert>}
      {seo.loading && <div className="border border-navy-100 bg-white p-8 text-sm text-graphite-500">Загрузка SEO-настроек…</div>}
      {seo.error && (
        <div className="border border-accent-600/30 bg-white p-6 text-sm text-accent-700">
          <p>{seo.error}</p>
          <button type="button" className="btn btn-outline btn-sm mt-3" onClick={seo.reload}>Повторить</button>
        </div>
      )}

      {seo.data && draft && (
        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside>
            <div className="border border-navy-100 bg-white">
              <p className="border-b border-navy-100 px-4 py-3 text-[11px] uppercase tracking-[0.14em] text-graphite-500">Страницы</p>
              <ul className="max-h-[520px] overflow-y-auto">
                {seo.data.items.map((item) => (
                  <li key={item.path}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between gap-2 border-b border-navy-50 px-4 py-2.5 text-left text-[13px] transition-colors",
                        selectedPath === item.path ? "bg-mist font-medium text-navy-900" : "text-graphite-600 hover:bg-mist/60",
                      )}
                      onClick={() => select(item.path)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate">{PAGE_LABELS[item.path] ?? item.path}</span>
                        <span className="block truncate text-[10px] text-graphite-400">{item.path}</span>
                      </span>
                      {!item.is_indexable && <span className="badge border border-graphite-300 text-graphite-500">noindex</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-4 border-l-2 border-navy-200 pl-3 text-xs leading-relaxed text-graphite-500">
              Рекомендуемая длина: заголовок 50–60 символов, описание 120–160. Не дублируйте тексты между страницами.
            </p>
          </aside>

          <div className="space-y-6">
            <section className="border border-navy-100 bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg normal-case tracking-normal">{PAGE_LABELS[draft.path] ?? draft.path}</h2>
                  <p className="text-xs text-graphite-400">{draft.path}</p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-graphite-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-accent-600"
                    checked={draft.is_indexable}
                    onChange={(event) => update({ is_indexable: event.target.checked })}
                  />
                  Индексировать
                </label>
              </div>
              <div className="mt-5 space-y-5">
                <Field label="SEO-заголовок" htmlFor="seo-title" required hint={`${draft.title.length} символов`}>
                  <TextInput id="seo-title" value={draft.title} onChange={(event) => update({ title: event.target.value })} maxLength={120} />
                </Field>
                <Field label="SEO-описание" htmlFor="seo-description" required hint={`${draft.description.length} символов`}>
                  <Textarea id="seo-description" rows={3} value={draft.description} onChange={(event) => update({ description: event.target.value })} maxLength={300} />
                </Field>
                <Field label="Изображение для соцсетей" hint="Необязательно. Используется для Open Graph, если не задано изображение публикации.">
                  <MediaInput value={draft.og_image} onChange={(path) => update({ og_image: path })} kind="image" />
                </Field>
              </div>
              <div className="mt-6 flex justify-end">
                <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving || !dirty}>
                  <Save size={15} aria-hidden="true" /> {saving ? "Сохраняем…" : "Сохранить"}
                </button>
              </div>
            </section>

            <section className="border border-navy-100 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-graphite-500">
                <Search size={14} aria-hidden="true" /> Предпросмотр в поиске
              </div>
              <div className="mt-4 max-w-2xl border border-navy-100 bg-white p-4">
                <p className="text-[12px] text-graphite-500">osdushor.by{draft.path === "/" ? "" : draft.path}</p>
                <p className="mt-1 line-clamp-2 text-[18px] leading-snug text-[#1a0dab]">{draft.title || "Заголовок страницы"}</p>
                <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-graphite-600">{draft.description || "Описание страницы появится здесь."}</p>
              </div>
              <p className="mt-3 text-[11px] text-graphite-400">
                Домен в предпросмотре условный. Фактический адрес определяется при публикации.
              </p>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
