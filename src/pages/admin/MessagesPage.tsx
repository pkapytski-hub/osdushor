import { useEffect, useMemo, useState } from "react";
import { Archive, Check, Mail, MailOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError, api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { AdminPageHeader, ConfirmDialog } from "./admin-ui";
import { formatDateTime } from "@/lib/format";
import type { FeedbackMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

const TOPIC_LABELS: Record<string, string> = {
  general: "Общий вопрос",
  enrollment: "Набор и запись",
  schedule: "Расписание",
  documents: "Документы",
  competitions: "Соревнования",
};

const STATUS_LABELS: Record<string, string> = {
  new: "Новое",
  read: "Прочитано",
  archived: "В архиве",
};

export default function MessagesPage() {
  const [status, setStatus] = useState("");
  const messages = useAsync((signal) => api.admin.messages(status, signal), [status]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<FeedbackMessage | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (messages.data?.items.length && !messages.data.items.some((item) => item.id === selectedId)) {
      setSelectedId(messages.data.items[0].id);
    }
    if (messages.data?.items.length === 0) setSelectedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.data]);

  const selected = useMemo(
    () => messages.data?.items.find((item) => item.id === selectedId) ?? null,
    [messages.data, selectedId],
  );

  const updateStatus = async (id: string, next: string) => {
    try {
      await api.admin.updateMessage(id, next);
      toast.success("Статус обновлён");
      messages.reload();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Не удалось обновить статус");
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api.admin.removeMessage(toDelete.id);
      toast.success("Обращение удалено");
      setToDelete(null);
      setSelectedId(null);
      messages.reload();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Не удалось удалить обращение");
    } finally {
      setBusy(false);
    }
  };

  const tabs = [
    { value: "", label: "Все" },
    { value: "new", label: "Новые" },
    { value: "read", label: "Прочитанные" },
    { value: "archived", label: "Архив" },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Обратная связь"
        title="Обращения"
        description="Сообщения из формы обратной связи. Персональные данные видны только сотрудникам с доступом."
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={cn("chip", status === tab.value && "chip-active")}
            onClick={() => setStatus(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {messages.loading && <div className="border border-navy-100 bg-white p-8 text-sm text-graphite-500">Загрузка обращений…</div>}
      {messages.error && (
        <div className="border border-accent-600/30 bg-white p-6 text-sm text-accent-700">
          <p>{messages.error}</p>
          <button type="button" className="btn btn-outline btn-sm mt-3" onClick={messages.reload}>Повторить</button>
        </div>
      )}
      {messages.data && messages.data.items.length === 0 && (
        <div className="border border-dashed border-navy-200 bg-white px-6 py-12 text-center">
          <Mail size={24} className="mx-auto text-graphite-400" aria-hidden="true" />
          <p className="mt-3 font-display text-lg uppercase text-navy-900">Обращений нет</p>
          <p className="mt-1 text-sm text-graphite-500">Сообщения из формы появятся здесь после отправки посетителями.</p>
        </div>
      )}

      {messages.data && messages.data.items.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="border border-navy-100 bg-white">
            <ul className="max-h-[680px] divide-y divide-navy-100 overflow-y-auto">
              {messages.data.items.map((message) => (
                <li key={message.id}>
                  <button
                    type="button"
                    className={cn(
                      "w-full px-4 py-3 text-left transition-colors",
                      selectedId === message.id ? "bg-mist" : "hover:bg-mist/50",
                    )}
                    onClick={() => setSelectedId(message.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-sm", message.status === "new" ? "font-semibold text-navy-900" : "text-graphite-700")}>
                        {message.name}
                      </span>
                      <span className={cn("badge shrink-0 border", message.status === "new" ? "border-accent-600 bg-accent-600 text-white" : "border-navy-200 text-graphite-500")}>
                        {STATUS_LABELS[message.status]}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-graphite-500">{TOPIC_LABELS[message.topic] ?? message.topic}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-graphite-600">{message.message}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-graphite-400">{formatDateTime(message.submitted_at)}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {selected ? (
            <article className="border border-navy-100 bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-navy-100 pb-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-accent-700">{TOPIC_LABELS[selected.topic] ?? selected.topic}</p>
                  <h2 className="mt-1 text-xl normal-case tracking-normal">{selected.name}</h2>
                  <p className="mt-1 text-xs text-graphite-500">{formatDateTime(selected.submitted_at)}</p>
                </div>
                <span className="badge border border-navy-200 text-graphite-600">{STATUS_LABELS[selected.status]}</span>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.14em] text-graphite-400">Контакт</dt>
                  <dd className="mt-0.5 break-all">
                    {/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(selected.contact) ? (
                      <a href={`mailto:${selected.contact}`} className="link-underline">{selected.contact}</a>
                    ) : (
                      <a href={`tel:${selected.contact.replace(/[^\d+]/g, "")}`} className="link-underline">{selected.contact}</a>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.14em] text-graphite-400">Согласие на обработку</dt>
                  <dd className="mt-0.5 text-graphite-700">{selected.consent ? "Получено" : "Не подтверждено"}</dd>
                </div>
              </dl>
              <div className="mt-5 border-l-2 border-navy-200 bg-mist p-4 text-[15px] leading-relaxed text-graphite-800">
                <p className="whitespace-pre-line">{selected.message}</p>
              </div>
              <div className="mt-6 flex flex-wrap gap-2 border-t border-navy-100 pt-4">
                {selected.status !== "read" && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => updateStatus(selected.id, "read")}>
                    <Check size={14} aria-hidden="true" /> Отметить прочитанным
                  </button>
                )}
                {selected.status !== "new" && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => updateStatus(selected.id, "new")}>
                    <MailOpen size={14} aria-hidden="true" /> Вернуть в новые
                  </button>
                )}
                {selected.status !== "archived" && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => updateStatus(selected.id, "archived")}>
                    <Archive size={14} aria-hidden="true" /> В архив
                  </button>
                )}
                <button type="button" className="btn btn-ghost btn-sm !text-accent-700" onClick={() => setToDelete(selected)}>
                  <Trash2 size={14} aria-hidden="true" /> Удалить
                </button>
              </div>
            </article>
          ) : (
            <div className="border border-dashed border-navy-200 bg-white p-8 text-center text-sm text-graphite-500">
              Выберите обращение из списка.
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Удалить обращение?"
        text="Сообщение будет удалено из базы без возможности восстановления."
        busy={busy}
        onCancel={() => setToDelete(null)}
        onConfirm={remove}
      />
    </div>
  );
}
