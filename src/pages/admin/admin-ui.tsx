import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ImagePlus, Loader2, Upload, X } from "lucide-react";
import { ApiError, api, fileUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-navy-100 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="section-label">{eyebrow}</p>}
        <h1 className="mt-2 text-2xl normal-case tracking-normal sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-graphite-600">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{actions}</div>}
    </div>
  );
}

export function AdminCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("border border-navy-100 bg-white p-5 sm:p-6", className)}>{children}</div>;
}

export function StatusBadge({ published }: { published: boolean }) {
  return (
    <span
      className={cn(
        "badge",
        published
          ? "border border-emerald-600/30 bg-emerald-50 text-emerald-800"
          : "border border-graphite-300 bg-mist text-graphite-500",
      )}
    >
      {published ? "Опубликовано" : "Черновик"}
    </span>
  );
}

export function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel = "Удалить",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  text: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="w-[min(440px,92vw)] border border-navy-100 bg-white p-0 text-graphite-900 shadow-2xl backdrop:bg-navy-950/60"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClose={() => {
        if (open) onCancel();
      }}
      aria-labelledby="confirm-title"
    >
      <div className="p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-accent-50 text-accent-700">
            <AlertTriangle size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 id="confirm-title" className="text-lg normal-case tracking-normal">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-graphite-600">{text}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn btn-outline btn-sm" onClick={onCancel} disabled={busy}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onConfirm} disabled={busy}>
            {busy ? "Удаляем…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export function MediaInput({
  value,
  onChange,
  kind,
  onMeta,
}: {
  value: string | null;
  onChange: (path: string | null) => void;
  kind: "image" | "file";
  onMeta?: (meta: { file_size: number; mime_type: string }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    const isImage = kind === "image";
    const allowed = isImage ? ["image/jpeg", "image/png", "image/webp", "image/avif"] : ["application/pdf"];
    if (!allowed.includes(file.type)) {
      setError(isImage ? "Допустимы JPG, PNG, WebP и AVIF." : "Допустим только PDF.");
      return;
    }
    if (file.size > (isImage ? 8 : 20) * 1024 * 1024) {
      setError(isImage ? "Файл больше 8 МБ." : "Файл больше 20 МБ.");
      return;
    }
    setBusy(true);
    try {
      const result = await api.admin.upload(file);
      onChange(result.path);
      onMeta?.({ file_size: result.size, mime_type: result.mime });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Не удалось загрузить файл.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const preview = value ? fileUrl(value) : "";
  return (
    <div>
      <div className="flex flex-wrap items-start gap-3">
        {kind === "image" && preview ? (
          <div className="relative h-24 w-32 shrink-0 overflow-hidden border border-navy-100 bg-mist">
            <img src={preview} alt="Предпросмотр" className="h-full w-full object-cover" />
          </div>
        ) : kind === "image" ? (
          <div className="flex h-24 w-32 shrink-0 items-center justify-center border border-dashed border-navy-200 bg-mist text-graphite-400">
            <ImagePlus size={22} aria-hidden="true" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          {value && (
            <p className="mb-2 break-all text-xs text-graphite-500">
              {kind === "file" && <Upload size={12} className="mr-1 inline" aria-hidden="true" />}
              {value}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}
              {busy ? "Загрузка…" : value ? "Заменить" : "Загрузить"}
            </button>
            {value && (
              <button type="button" className="btn btn-ghost btn-sm !text-graphite-500" onClick={() => onChange(null)} disabled={busy}>
                <X size={14} aria-hidden="true" /> Убрать
              </button>
            )}
            {kind === "file" && preview && (
              <a href={preview} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                Открыть
              </a>
            )}
          </div>
          {error && <p className="mt-2 text-xs font-medium text-accent-700" role="alert">{error}</p>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={kind === "image" ? "image/jpeg,image/png,image/webp,image/avif" : "application/pdf"}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}
