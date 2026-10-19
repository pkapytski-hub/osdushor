import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Eye, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError, api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { useAdmin } from "./AdminGuard";
import { RESOURCES, type AdminField } from "./resources";
import { AdminPageHeader, ConfirmDialog, MediaInput } from "./admin-ui";
import { ResourcePreview } from "./ResourcePreview";
import { Field, FormAlert, Select, TextInput, Textarea } from "@/components/ui/Field";
import { toDateTimeInput } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Location } from "@/lib/types";

type Values = Record<string, unknown>;

export default function ResourceFormPage({ resourceKey }: { resourceKey: string }) {
  const config = RESOURCES[resourceKey];
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const { user } = useAdmin();
  const [values, setValues] = useState<Values>(config?.defaults ?? {});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const existing = useAsync<{ item: Values | null }>(
    (signal) =>
      isNew
        ? Promise.resolve({ item: null as Values | null })
        : api.admin.item<Values>(resourceKey, id!, signal),
    [resourceKey, id, isNew],
    !isNew,
  );

  const relationField = config?.fields.find((field) => field.type === "relation");
  const relations = useAsync(
    (signal) => (relationField ? api.admin.list<Location>("locations", signal) : Promise.resolve({ items: [] })),
    [relationField?.relation],
    Boolean(relationField),
  );

  useEffect(() => {
    if (existing.data?.item) {
      const item = existing.data.item as Values;
      const next: Values = { ...config.defaults, ...item };
      for (const field of config.fields) {
        if (field.type === "datetime" || field.type === "date") {
          const raw = item[field.name];
          if (typeof raw === "string" && (field.type === "datetime" ? raw.includes("T") : true)) {
            next[field.name] = field.type === "datetime" ? toDateTimeInput(raw) : raw.slice(0, 10);
          }
        }
        if (field.type === "tags" && Array.isArray(item[field.name])) {
          next[field.name] = (item[field.name] as string[]).join(", ");
        }
      }
      setValues(next);
    }
  }, [existing.data, config]);

  const primaryFields = useMemo(() => config.fields.filter((field) => !field.hidden && field.group !== "SEO"), [config]);
  const seoFields = useMemo(() => config.fields.filter((field) => !field.hidden && field.group === "SEO"), [config]);
  const hasDemo = Boolean(values.is_demo);

  if (!config) return <p>Раздел не найден.</p>;

  if (!isNew && existing.loading) {
    return <div className="border border-navy-100 bg-white p-8 text-sm text-graphite-500">Загрузка записи…</div>;
  }
  if (!isNew && existing.error) {
    return (
      <div className="border border-accent-600/30 bg-white p-6">
        <p className="text-sm text-accent-700">{existing.error}</p>
        <Link to={`/admin/${resourceKey}`} className="btn btn-outline btn-sm mt-4">К списку</Link>
      </div>
    );
  }

  const update = (field: AdminField, value: unknown) => {
    setValues((current) => ({ ...current, [field.name]: value }));
    setFieldErrors((current) => {
      if (!current[field.name]) return current;
      const next = { ...current };
      delete next[field.name];
      return next;
    });
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    for (const field of config.fields) {
      if (!field.required || field.hidden) continue;
      const value = values[field.name];
      if (value === null || value === undefined || String(value).trim() === "") {
        errors[field.name] = "Поле обязательно для заполнения.";
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setServerError(null);
    if (!validate()) {
      toast.error("Проверьте обязательные поля");
      return;
    }
    setSaving(true);
    const payload: Values = { ...values };
    for (const field of config.fields) {
      if (field.type === "tags" && typeof payload[field.name] === "string") {
        payload[field.name] = (payload[field.name] as string)
          .split(/[,;\n]+/)
          .map((item) => item.trim())
          .filter(Boolean);
      }
      if (field.type === "checkbox") payload[field.name] = Boolean(payload[field.name]);
    }
    if (payload.published_at === "") payload.published_at = new Date().toISOString();
    try {
      if (isNew) {
        await api.admin.create(resourceKey, payload);
        toast.success("Запись создана");
      } else {
        await api.admin.update(resourceKey, id!, payload);
        toast.success("Изменения сохранены");
      }
      navigate(`/admin/${resourceKey}`);
    } catch (error) {
      if (error instanceof ApiError) {
        setServerError(error.message);
        setFieldErrors(error.fields);
        toast.error(error.message);
      } else {
        setServerError("Не удалось сохранить запись.");
        toast.error("Не удалось сохранить запись");
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id || isNew) return;
    setDeleting(true);
    try {
      await api.admin.remove(resourceKey, id);
      toast.success("Запись удалена");
      navigate(`/admin/${resourceKey}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Не удалось удалить запись");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const publicHref =
    !isNew && (resourceKey === "news" || resourceKey === "competitions") && values.slug
      ? resourceKey === "news"
        ? `/novosti/${values.slug}`
        : `/kalendar/${values.slug}`
      : null;

  return (
    <div className="space-y-6">
      <Link to={`/admin/${resourceKey}`} className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.12em] text-graphite-500 hover:text-accent-600">
        <ArrowLeft size={14} aria-hidden="true" /> {config.title}
      </Link>
      <AdminPageHeader
        title={isNew ? `Новая запись: ${config.singular}` : `Редактирование: ${config.singular}`}
        description={hasDemo ? "Демонстрационная запись. После редактирования она останется помеченной как демо." : undefined}
        actions={
          <>
            {config.preview && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setPreviewOpen(true)}>
                <Eye size={15} aria-hidden="true" /> Предпросмотр
              </button>
            )}
            {publicHref && (
              <Link to={publicHref} target="_blank" className="btn btn-ghost btn-sm">
                На сайте
              </Link>
            )}
          </>
        }
      />

      {hasDemo && (
        <div className="border border-accent-600/30 bg-accent-50 px-4 py-3 text-[13px] leading-relaxed text-accent-800">
          Это демонстрационная запись. Публичное отображение зависит от режима DEMO_DATA. Удалить все демо-данные можно на дашборде.
        </div>
      )}
      {serverError && <FormAlert>{serverError}</FormAlert>}

      <form onSubmit={submit} noValidate className="space-y-6">
        <section className="border border-navy-100 bg-white p-5 sm:p-6">
          <h2 className="text-lg normal-case tracking-normal">Основные сведения</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {primaryFields.map((field) => (
              <div key={field.name} className={cn(field.span === 2 && "sm:col-span-2")}>
                <FieldRenderer
                  field={field}
                  value={values[field.name]}
                  error={fieldErrors[field.name]}
                  onChange={(value) => update(field, value)}
                  relations={relations.data?.items ?? []}
                  onMeta={(meta) => {
                    setValues((current) => ({
                      ...current,
                      file_size: meta.file_size,
                      mime_type: meta.mime_type,
                    }));
                  }}
                />
              </div>
            ))}
          </div>
        </section>

        {seoFields.length > 0 && (
          <section className="border border-navy-100 bg-white p-5 sm:p-6">
            <h2 className="text-lg normal-case tracking-normal">SEO и соцсети</h2>
            <p className="mt-1 text-xs leading-relaxed text-graphite-500">
              Если поля пусты, используются заголовок и краткое описание записи. Обложка применяется для Open Graph.
            </p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {seoFields.map((field) => (
                <div key={field.name} className={cn(field.span === 2 && "sm:col-span-2")}>
                  <FieldRenderer
                    field={field}
                    value={values[field.name]}
                    error={fieldErrors[field.name]}
                    onChange={(value) => update(field, value)}
                    relations={[]}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t border-navy-200 bg-white px-4 py-3 shadow-[0_-10px_30px_-24px_rgba(10,22,49,0.65)] sm:px-5">
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              <Save size={15} aria-hidden="true" /> {saving ? "Сохраняем…" : "Сохранить"}
            </button>
            <Link to={`/admin/${resourceKey}`} className="btn btn-outline btn-sm">Отмена</Link>
          </div>
          {!isNew && user.role && (
            <button type="button" className="btn btn-ghost btn-sm !text-accent-700" onClick={() => setDeleteOpen(true)}>
              <Trash2 size={15} aria-hidden="true" /> Удалить
            </button>
          )}
        </div>
      </form>

      {config.preview && (
        <ResourcePreview open={previewOpen} kind={config.preview} value={values} onClose={() => setPreviewOpen(false)} />
      )}
      <ConfirmDialog
        open={deleteOpen}
        title="Удалить запись?"
        text="Действие необратимо. Если публикация нужна на сайте, снимите флажок «Опубликовать» вместо удаления."
        busy={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={remove}
      />
    </div>
  );
}

function FieldRenderer({
  field,
  value,
  error,
  onChange,
  relations,
  onMeta,
}: {
  field: AdminField;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
  relations: Location[];
  onMeta?: (meta: { file_size: number; mime_type: string }) => void;
}) {
  const id = `field-${field.name}`;
  if (field.type === "checkbox") {
    return (
      <label htmlFor={id} className="flex cursor-pointer items-center gap-3 border border-navy-100 bg-mist px-4 py-3">
        <input
          id={id}
          type="checkbox"
          className="h-4 w-4 accent-accent-600"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="text-sm text-graphite-700">{field.label}</span>
      </label>
    );
  }
  if (field.type === "image" || field.type === "file") {
    return (
      <Field label={field.label} htmlFor={id} required={field.required} hint={field.hint} error={error}>
        <MediaInput value={value ? String(value) : null} onChange={onChange} kind={field.type === "image" ? "image" : "file"} onMeta={onMeta} />
      </Field>
    );
  }
  if (field.type === "select" || field.type === "relation") {
    return (
      <Field label={field.label} htmlFor={id} required={field.required} hint={field.hint} error={error}>
        <Select id={id} value={value ? String(value) : ""} onChange={(event) => onChange(event.target.value)}>
          <option value="">{field.type === "relation" ? "Не выбрано" : "Выберите значение"}</option>
          {field.type === "relation"
            ? relations.map((item) => (
                <option key={item.id} value={item.id}>{item.name}{item.address ? ` — ${item.address}` : ""}</option>
              ))
            : field.options?.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
        </Select>
      </Field>
    );
  }
  if (field.type === "textarea") {
    return (
      <Field label={field.label} htmlFor={id} required={field.required} hint={field.hint} error={error}>
        <Textarea
          id={id}
          rows={field.rows ?? 4}
          value={value == null ? "" : String(value)}
          onChange={(event) => onChange(event.target.value)}
          maxLength={field.max}
          placeholder={field.placeholder}
        />
      </Field>
    );
  }
  if (field.type === "tags") {
    return (
      <Field label={field.label} htmlFor={id} required={field.required} hint={field.hint} error={error}>
        <TextInput
          id={id}
          value={Array.isArray(value) ? value.join(", ") : value == null ? "" : String(value)}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Например: до 12 лет, юноши, девушки"
        />
      </Field>
    );
  }
  const inputType =
    field.type === "datetime"
      ? "datetime-local"
      : field.type === "date"
        ? "date"
        : field.type === "time"
          ? "time"
          : field.type === "number"
            ? "number"
            : "text";
  return (
    <Field label={field.label} htmlFor={id} required={field.required} hint={field.hint} error={error}>
      <TextInput
        id={id}
        type={inputType}
        value={value == null ? "" : String(value)}
        onChange={(event) => onChange(event.target.value)}
        maxLength={field.type === "text" ? field.max : undefined}
        placeholder={field.placeholder}
      />
    </Field>
  );
}
