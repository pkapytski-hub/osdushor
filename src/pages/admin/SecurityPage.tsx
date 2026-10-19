import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { AdminCard, AdminPageHeader } from "./admin-ui";
import { useAdmin } from "./AdminGuard";
import { Field, FormAlert, TextInput } from "@/components/ui/Field";

export default function SecurityPage() {
  const { user } = useAdmin();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (next.length < 12 || !/\d/.test(next) || !/[A-Za-zА-Яа-я]/.test(next)) {
      setError("Новый пароль: не менее 12 символов, обязательно буквы и цифры.");
      return;
    }
    if (next !== confirm) {
      setError("Пароли не совпадают.");
      return;
    }
    setBusy(true);
    try {
      const response = await api.auth.changePassword({ current_password: current, new_password: next });
      toast.success(response.message);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Не удалось сменить пароль.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Аккаунт"
        title="Безопасность"
        description="Смена пароля служебной учётной записи. После изменения остальные сеансы завершаются."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,480px)_1fr]">
        <AdminCard>
          <form onSubmit={submit} className="space-y-5" noValidate>
            {error && <FormAlert>{error}</FormAlert>}
            <Field label="Текущий пароль" htmlFor="sec-current" required>
              <TextInput id="sec-current" type="password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} required />
            </Field>
            <Field label="Новый пароль" htmlFor="sec-next" required hint="Не менее 12 символов, буквы и цифры.">
              <TextInput id="sec-next" type="password" autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} required />
            </Field>
            <Field label="Повторите новый пароль" htmlFor="sec-confirm" required>
              <TextInput id="sec-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
            </Field>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Сохраняем…" : "Сменить пароль"}</button>
          </form>
        </AdminCard>
        <AdminCard>
          <div className="flex items-center gap-3">
            <ShieldCheck size={22} className="text-accent-600" aria-hidden="true" />
            <h2 className="text-lg normal-case tracking-normal">Учётная запись</h2>
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.14em] text-graphite-500">Имя</dt>
              <dd className="mt-0.5 text-navy-900">{user.name}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.14em] text-graphite-500">Электронная почта</dt>
              <dd className="mt-0.5 break-all text-navy-900">{user.email}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.14em] text-graphite-500">Роль</dt>
              <dd className="mt-0.5 text-navy-900">{user.role === "admin" ? "Администратор" : "Редактор"}</dd>
            </div>
          </dl>
          <p className="mt-5 border-l-2 border-navy-200 pl-3 text-xs leading-relaxed text-graphite-500">
            Сеанс действует 12 часов. При смене пароля все другие устройства будут отключены. Если вы подозреваете
            компрометацию, смените пароль и сообщите администратору.
          </p>
        </AdminCard>
      </div>
    </div>
  );
}
