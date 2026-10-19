import { useState } from "react";
import { KeyRound, Pencil, Plus, Shield, Trash2, UserCog, X } from "lucide-react";
import { toast } from "sonner";
import { ApiError, api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { AdminPageHeader, ConfirmDialog } from "./admin-ui";
import { Field, FormAlert, Select, TextInput } from "@/components/ui/Field";
import { formatDateTime } from "@/lib/format";
import type { StaffMember } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Draft {
  id?: string;
  display_name: string;
  email: string;
  role: "admin" | "editor";
  is_active: boolean;
  password: string;
}

const EMPTY: Draft = { display_name: "", email: "", role: "editor", is_active: true, password: "" };

function generatePassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let value = "";
  for (const byte of bytes) value += alphabet[byte % alphabet.length];
  return `${value.slice(0, 10)}${Math.floor(Math.random() * 90 + 10)}${value.slice(10)}`;
}

export default function StaffPage() {
  const staff = useAsync((signal) => api.admin.staff(signal), []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<StaffMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openNew = () => {
    setDraft({ ...EMPTY });
    setError(null);
    setFields({});
  };
  const openEdit = (member: StaffMember) => {
    setDraft({
      id: member.id,
      display_name: member.display_name,
      email: member.email,
      role: member.role,
      is_active: Boolean(member.is_active),
      password: "",
    });
    setError(null);
    setFields({});
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setError(null);
    setFields({});
    if (draft.display_name.trim().length < 2) return setError("Укажите имя сотрудника.");
    if (!draft.id && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(draft.email)) return setError("Укажите корректную почту.");
    if (!draft.id && (draft.password.length < 12 || !/\d/.test(draft.password) || !/[A-Za-zА-Яа-я]/.test(draft.password))) {
      return setError("Пароль: не менее 12 символов, буквы и цифры.");
    }
    setBusy(true);
    try {
      if (draft.id) {
        await api.admin.updateStaff(draft.id, {
          display_name: draft.display_name.trim(),
          role: draft.role,
          is_active: draft.is_active,
          ...(draft.password ? { password: draft.password } : {}),
        });
        toast.success("Доступ обновлён");
      } else {
        await api.admin.createStaff({
          display_name: draft.display_name.trim(),
          email: draft.email.trim().toLowerCase(),
          role: draft.role,
          password: draft.password,
        });
        toast.success("Сотрудник добавлен");
      }
      setDraft(null);
      staff.reload();
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message);
        setFields(cause.fields);
      } else {
        setError("Не удалось сохранить доступ.");
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.admin.removeStaff(toDelete.id);
      toast.success("Учётная запись удалена");
      setToDelete(null);
      staff.reload();
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : "Не удалось удалить учётную запись");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Доступы"
        title="Сотрудники и роли"
        description="Администратор управляет настройками и доступами. Редактор работает с новостями, соревнованиями, документами и другими материалами."
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={openNew}>
            <Plus size={15} aria-hidden="true" /> Добавить сотрудника
          </button>
        }
      />

      {draft && (
        <form onSubmit={save} className="border border-navy-100 bg-white p-5 sm:p-6" noValidate>
          <div className="flex items-center justify-between">
            <h2 className="text-lg normal-case tracking-normal">{draft.id ? "Изменить доступ" : "Новый сотрудник"}</h2>
            <button type="button" className="flex h-8 w-8 items-center justify-center text-graphite-400 hover:text-navy-900" onClick={() => setDraft(null)} aria-label="Закрыть форму">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          {error && <div className="mt-4"><FormAlert>{error}</FormAlert></div>}
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field label="Имя сотрудника" htmlFor="staff-name" required error={fields.display_name}>
              <TextInput id="staff-name" value={draft.display_name} onChange={(event) => setDraft({ ...draft, display_name: event.target.value })} required />
            </Field>
            <Field label="Электронная почта" htmlFor="staff-email" required error={fields.email} hint={draft.id ? "Почту изменить нельзя." : undefined}>
              <TextInput id="staff-email" type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} disabled={Boolean(draft.id)} required />
            </Field>
            <Field label="Роль" htmlFor="staff-role" required error={fields.role}>
              <Select id="staff-role" value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as Draft["role"] })}>
                <option value="editor">Редактор — контент</option>
                <option value="admin">Администратор — полный доступ</option>
              </Select>
            </Field>
            <Field
              label={draft.id ? "Новый пароль (необязательно)" : "Пароль"}
              htmlFor="staff-password"
              required={!draft.id}
              error={fields.password}
              hint="Не менее 12 символов, буквы и цифры."
            >
              <div className="flex gap-2">
                <TextInput id="staff-password" type="text" autoComplete="new-password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} />
                <button type="button" className="btn btn-outline btn-sm shrink-0" onClick={() => setDraft({ ...draft, password: generatePassword() })} title="Сгенерировать пароль">
                  <KeyRound size={14} aria-hidden="true" />
                </button>
              </div>
            </Field>
            {draft.id && (
              <label className="flex cursor-pointer items-center gap-3 border border-navy-100 bg-mist px-4 py-3 sm:col-span-2">
                <input type="checkbox" className="h-4 w-4 accent-accent-600" checked={draft.is_active} onChange={(event) => setDraft({ ...draft, is_active: event.target.checked })} />
                <span className="text-sm text-graphite-700">Учётная запись активна</span>
              </label>
            )}
          </div>
          <div className="mt-5 flex gap-2">
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? "Сохраняем…" : "Сохранить"}</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setDraft(null)}>Отмена</button>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-graphite-500">
            Передайте пароль сотруднику по защищённому каналу. При смене пароля все сеансы сотрудника завершаются.
          </p>
        </form>
      )}

      <div className="border border-navy-100 bg-white">
        {staff.loading && <div className="p-6 text-sm text-graphite-500">Загрузка сотрудников…</div>}
        {staff.error && (
          <div className="p-6 text-sm text-accent-700">
            <p>{staff.error}</p>
            <button type="button" className="btn btn-outline btn-sm mt-3" onClick={staff.reload}>Повторить</button>
          </div>
        )}
        {staff.data && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-mist text-[10px] uppercase tracking-[0.14em] text-graphite-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Сотрудник</th>
                  <th scope="col" className="px-4 py-3 font-medium">Роль</th>
                  <th scope="col" className="px-4 py-3 font-medium">Статус</th>
                  <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">Последний вход</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {staff.data.items.map((member) => (
                  <tr key={member.id} className="hover:bg-mist/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-navy-900">{member.display_name}</p>
                      <p className="text-xs text-graphite-500">{member.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("badge border", member.role === "admin" ? "border-navy-900 bg-navy-900 text-white" : "border-navy-200 bg-white text-navy-800")}>
                        {member.role === "admin" ? "Администратор" : "Редактор"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs", member.is_active ? "text-emerald-700" : "text-graphite-400")}>
                        {member.is_active ? "Активна" : "Отключена"}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-graphite-500 md:table-cell">
                      {member.last_login_at ? formatDateTime(member.last_login_at) : "Не входил"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button type="button" className="flex h-8 w-8 items-center justify-center text-graphite-500 hover:bg-mist hover:text-navy-900" onClick={() => openEdit(member)} aria-label="Редактировать доступ" title="Редактировать">
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button type="button" className="flex h-8 w-8 items-center justify-center text-graphite-500 hover:bg-accent-50 hover:text-accent-700" onClick={() => setToDelete(member)} aria-label="Удалить доступ" title="Удалить">
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="border border-navy-100 bg-white p-5">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-accent-600" aria-hidden="true" />
            <p className="text-sm font-medium text-navy-900">Администратор</p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-graphite-500">
            Полный доступ: контент, настройки, реквизиты, SEO, сотрудники, журнал действий и экспорт.
          </p>
        </div>
        <div className="border border-navy-100 bg-white p-5">
          <div className="flex items-center gap-2">
            <UserCog size={18} className="text-accent-600" aria-hidden="true" />
            <p className="text-sm font-medium text-navy-900">Редактор</p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-graphite-500">
            Публикации, соревнования, достижения, тренеры, фотографии, документы, расписание и обращения.
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Удалить учётную запись?"
        text={`Доступ для «${toDelete?.display_name ?? ""}» будет удалён. Последнего администратора удалить нельзя.`}
        busy={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={remove}
      />
    </div>
  );
}
