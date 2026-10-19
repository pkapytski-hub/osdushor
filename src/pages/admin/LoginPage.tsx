import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { Field, FormAlert, TextInput } from "@/components/ui/Field";

export default function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const me = useAsync((signal) => api.auth.me(signal), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!me.loading && me.data?.setup_required) return <Navigate to="/admin/setup" replace />;
  if (!me.loading && me.data?.user) {
    const next = params.get("next");
    return <Navigate to={next?.startsWith("/admin") ? next : "/admin"} replace />;
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setError("Укажите корректный адрес электронной почты.");
      return;
    }
    if (!password) {
      setError("Введите пароль.");
      return;
    }
    setBusy(true);
    try {
      await api.auth.login({ email: email.trim(), password });
      toast.success("Вход выполнен");
      const next = params.get("next");
      navigate(next?.startsWith("/admin") ? next : "/admin", { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Не удалось войти. Повторите попытку.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_0.95fr]">
      <div className="relative hidden overflow-hidden bg-navy-950 text-white lg:block">
        <img src="/images/hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/80 to-navy-950/40" aria-hidden="true" />
        <div className="absolute inset-0 bg-grid-dark opacity-40" aria-hidden="true" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden bg-white text-navy-900" aria-hidden="true">
              <span className="font-display text-2xl font-semibold">О</span>
              <span className="absolute bottom-0 left-0 h-1 w-full bg-accent-600" />
            </span>
            <div>
              <p className="font-display text-sm uppercase tracking-[0.1em]">ОСДЮШОР</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/50">Гродно · Настольный теннис</p>
            </div>
          </div>
          <div className="max-w-lg">
            <p className="section-label section-label-light">Панель управления</p>
            <h1 className="display-1 mt-4 text-[clamp(2.2rem,4vw,3.6rem)]">Контент школы — под контролем</h1>
            <p className="mt-4 text-[15px] leading-relaxed text-white/65">
              Публикации, соревнования, документы, фотографии и официальные сведения. Доступ только для
              уполномоченных сотрудников учреждения.
            </p>
          </div>
          <p className="text-[11px] leading-relaxed text-white/35">
            {`© ${new Date().getFullYear()} Гродненская ОСДЮШОР им. Ю. К. Культиясова`}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.12em] text-graphite-500 hover:text-accent-600">
            <ArrowLeft size={14} aria-hidden="true" /> На сайт
          </Link>
          <div className="mt-8 flex h-12 w-12 items-center justify-center bg-navy-900 text-white">
            <LockKeyhole size={22} aria-hidden="true" />
          </div>
          <h2 className="mt-5 text-3xl normal-case tracking-normal">Вход в панель</h2>
          <p className="mt-2 text-sm leading-relaxed text-graphite-600">
            Используйте служебную учётную запись. Пароль должен содержать не менее 12 символов.
          </p>

          {error && <div className="mt-5"><FormAlert>{error}</FormAlert></div>}

          <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
            <Field label="Электронная почта" htmlFor="login-email" required>
              <TextInput
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.by"
                required
                autoFocus
              />
            </Field>
            <Field label="Пароль" htmlFor="login-password" required>
              <div className="relative">
                <TextInput
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pr-12"
                  required
                />
                <button
                  type="button"
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-graphite-400 hover:text-navy-900"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                >
                  {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                </button>
              </div>
            </Field>
            <button type="submit" className="btn btn-primary w-full" disabled={busy}>
              {busy ? "Проверяем…" : "Войти"}
            </button>
          </form>

          <div className="mt-6 border-t border-navy-100 pt-5 text-xs leading-relaxed text-graphite-500">
            <p>
              Нет доступа? Обратитесь к администратору учреждения. Первичная настройка выполняется на странице{" "}
              <Link to="/admin/setup" className="underline underline-offset-2 hover:text-accent-600">создания администратора</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
