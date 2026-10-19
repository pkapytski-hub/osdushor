import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { AdminPageHeader, MediaInput } from "./admin-ui";
import { SETTINGS_GROUPS, type SettingField } from "./settings-config";
import { Field, FormAlert, TextInput, Textarea } from "@/components/ui/Field";
import { cn } from "@/lib/utils";

type Values = Record<string, string>;

export default function SettingsPage() {
  const settings = useAsync((signal) => api.admin.settings(signal), []);
  const [values, setValues] = useState<Values>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data) {
      setValues(Object.fromEntries(settings.data.items.map((item) => [item.key, item.value])));
      setDirty(false);
    }
  }, [settings.data]);

  const emptyCount = useMemo(
    () => SETTINGS_GROUPS.flatMap((group) => group.fields).filter((field) => field.type !== "checkbox" && !values[field.key]?.trim()).length,
    [values],
  );

  const update = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.admin.saveSettings(values);
      toast.success("Настройки сохранены");
      setDirty(false);
      settings.reload();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Не удалось сохранить настройки.");
      toast.error("Не удалось сохранить настройки");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Организация"
        title="Настройки сайта"
        description="Официальные сведения, контакты, условия набора и SEO. Пустые поля публикуются с пометкой «Уточняется»."
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving || !dirty}>
            <Save size={15} aria-hidden="true" /> {saving ? "Сохраняем…" : "Сохранить"}
          </button>
        }
      />
      {error && <FormAlert>{error}</FormAlert>}
      {settings.loading && <div className="border border-navy-100 bg-white p-8 text-sm text-graphite-500">Загрузка настроек…</div>}
      {settings.error && (
        <div className="border border-accent-600/30 bg-white p-6 text-sm text-accent-700">
          <p>{settings.error}</p>
          <button type="button" className="btn btn-outline btn-sm mt-3" onClick={settings.reload}>Повторить</button>
        </div>
      )}

      {settings.data && (
        <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden xl:block">
            <nav aria-label="Разделы настроек" className="sticky top-24 border-l border-navy-200">
              {SETTINGS_GROUPS.map((group) => (
                <a key={group.id} href={`#settings-${group.id}`} className="block border-l-2 border-transparent px-3 py-2 text-[13px] text-graphite-600 hover:border-accent-600 hover:text-navy-900">
                  {group.title}
                </a>
              ))}
            </nav>
            <p className="mt-5 border-l-2 border-navy-200 pl-3 text-xs leading-relaxed text-graphite-500">
              Незаполненных полей: <span className="font-medium text-navy-900">{emptyCount}</span>. Пометка «Уточняется» видна посетителям.
            </p>
          </aside>

          <div className="space-y-6">
            {SETTINGS_GROUPS.map((group) => (
              <section key={group.id} id={`settings-${group.id}`} className="scroll-mt-24 border border-navy-100 bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg normal-case tracking-normal">{group.title}</h2>
                  <span className="text-[11px] uppercase tracking-[0.12em] text-graphite-400">
                    {group.fields.filter((field) => field.type !== "checkbox" && !values[field.key]?.trim()).length} пустых
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-graphite-500">{group.description}</p>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  {group.fields.map((field) => (
                    <div key={field.key} className={cn(field.span === 2 && "sm:col-span-2")}>
                      <SettingInput field={field} value={values[field.key] ?? ""} onChange={(value) => update(field.key, value)} />
                    </div>
                  ))}
                </div>
              </section>
            ))}
            <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-navy-100 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_-24px_rgba(10,22,49,0.5)] backdrop-blur">
              <p className="text-xs text-graphite-500">{dirty ? "Есть несохранённые изменения" : "Все изменения сохранены"}</p>
              <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving || !dirty}>
                <Save size={15} aria-hidden="true" /> {saving ? "Сохраняем…" : "Сохранить настройки"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingInput({ field, value, onChange }: { field: SettingField; value: string; onChange: (value: string) => void }) {
  const id = `setting-${field.key}`;
  if (field.type === "checkbox") {
    return (
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 border border-navy-100 bg-mist px-4 py-3">
        <input id={id} type="checkbox" className="mt-0.5 h-4 w-4 accent-accent-600" checked={value === "1"} onChange={(event) => onChange(event.target.checked ? "1" : "0")} />
        <span>
          <span className="block text-sm text-graphite-800">{field.label}</span>
          {field.hint && <span className="mt-0.5 block text-xs leading-relaxed text-graphite-500">{field.hint}</span>}
        </span>
      </label>
    );
  }
  if (field.type === "image") {
    return (
      <Field label={field.label} htmlFor={id} hint={field.hint}>
        <MediaInput value={value || null} onChange={(path) => onChange(path ?? "")} kind="image" />
      </Field>
    );
  }
  if (field.type === "textarea") {
    return (
      <Field label={field.label} htmlFor={id} hint={field.hint}>
        <Textarea id={id} rows={field.rows ?? 4} value={value} onChange={(event) => onChange(event.target.value)} />
      </Field>
    );
  }
  return (
    <Field label={field.label} htmlFor={id} hint={field.hint}>
      <TextInput
        id={id}
        type={field.type === "email" ? "email" : field.type === "url" ? "url" : field.type === "number" ? "text" : "text"}
        inputMode={field.type === "phone" ? "tel" : field.type === "number" ? "numeric" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
