import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, KeyRound, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { Field, FormAlert, TextInput } from "@/components/ui/Field";

export default function SetupPage() {
  const me = useAsync((signal) => api.auth.me(signal), []);
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!me.loading && me.data && !me.data.setup_required) return <Navigate to="/admin/login" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!token.trim()) return setError("Введите код первичной настройки.");
    if (name.trim().length < 2) return setError("Укажите имя администратора.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return setError("Укажите корректную почту.");
    if (password.length < 12 || !/\d/.test(password) || !/[A-Za-zА-Яа-я]/.test(password)) {
      return setError("Пароль: не менее 12 символов, обязательно буквы и цифры.");
    }
    if (password !== confirm) return setError("Пароли не совпадают.");
    setBusy(true);
    try {
      await api.auth.setup({ token: token.trim(), name: name.trim(), email: email.trim().toLowerCase(), password });
      toast.success("Администратор создан");
      navigate("/admin", { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Не удалось завершить настройку.");
      me.reload();
    } finally {
      setBusy(false);
    }
  };

  const unavailable = me.data && !me.data.setup_available;

  return (
    <div className="min-h-screen bg-mist">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.12em] text-graphite-500 hover:text-accent-600">
          <ArrowLeft size={14} aria-hidden="true" /> На сайт
        </Link>
        <div className="mt-8 border border-navy-100 bg-white p-6 sm:p-10">
          <div className="flex h-12 w-12 items-center justify-center bg-navy-900 text-white">
            <KeyRound size={22} aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-3xl normal-case tracking-normal">Первичная настройка</h1>
          <p className="mt-2 text-sm leading-relaxed text-graphite-600">
            Создание первой учётной записи администратора. Страница доступна только пока в системе нет сотрудников.
            Код настройки задаётся на сервере в секрете <code className="bg-mist px-1 py-0.5 text-[12px]">SETUP_TOKEN</code>.
          </p>

          {unavailable && (
            <div className="mt-5">
              <FormAlert tone="error">
                Секрет SETUP_TOKEN не настроен на сервере. Добавьте его в переменные окружения Worker и перезагрузите
                страницу. Без этого создание администратора невозможно.
              </FormAlert>
            </div>
          )}
          {error && <div className="mt-5"><FormAlert>{error}</FormAlert></div>}

          <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
            <Field label="Код первичной настройки" htmlFor="setup-token" required hint="Выдаётся техническим администратором. Не публикуйте код.">
              <TextInput id="setup-token" type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" required />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Имя администратора" htmlFor="setup-name" required>
                <TextInput id="setup-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
              </Field>
              <Field label="Электронная почта" htmlFor="setup-email" required>
                <TextInput id="setup-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Пароль" htmlFor="setup-password" required hint="Не менее 12 символов, буквы и цифры.">
                <TextInput id="setup-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required />
              </Field>
              <Field label="Повторите пароль" htmlFor="setup-confirm" required>
                <TextInput id="setup-confirm" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" required />
              </Field>
            </div>
            <div className="flex items-start gap-3 border border-navy-100 bg-mist p-4 text-xs leading-relaxed text-graphite-600">
              <ShieldAlert size={16} className="mt-0.5 shrink-0 text-accent-600" aria-hidden="true" />
              <p>
                После создания администратора страница настройки закроется автоматически. Передайте доступы
                ответственному сотруднику и настройте остальные учётные записи в разделе «Доступы».
              </p>
            </div>
            <button type="submit" className="btn btn-primary w-full" disabled={busy || Boolean(unavailable)}>
              {busy ? "Создаём…" : "Создать администратора"}
            </button>
          </form>
        </div>
        <p className="mt-5 text-center text-xs text-graphite-500">
          Уже есть аккаунт? <Link to="/admin/login" className="underline underline-offset-2 hover:text-accent-600">Перейти ко входу</Link>
        </p>
      </div>
    </div>
  );
}
