import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Clock, Mail, Phone, ShieldAlert } from "lucide-react";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/site/PageHero";
import { Field, FormAlert, Select, TextInput, Textarea } from "@/components/ui/Field";
import { useSiteSettings } from "@/lib/site-context";
import { ApiError, api } from "@/lib/api";
import { hasSetting } from "@/lib/utils";

const PHONE_RE = /^[+\d][\d\s()+-]{6,20}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const schema = z.object({
  name: z.string().trim().min(2, "Укажите имя (не менее 2 символов).").max(120, "Слишком длинное имя."),
  contact: z
    .string()
    .trim()
    .min(5, "Укажите телефон или электронную почту.")
    .max(200, "Слишком длинный контакт.")
    .refine((value) => PHONE_RE.test(value) || EMAIL_RE.test(value), "Укажите телефон или адрес электронной почты."),
  topic: z.enum(["general", "enrollment", "schedule", "competitions", "documents"]),
  message: z.string().trim().min(10, "Опишите вопрос подробнее (не менее 10 символов).").max(4000, "Сообщение слишком длинное."),
  consent: z.boolean().refine((value) => value, "Необходимо согласие на обработку персональных данных."),
  company: z.string().max(100).optional(),
});

type FormValues = z.infer<typeof schema>;

const TOPICS = [
  { value: "enrollment", label: "Набор и запись в школу" },
  { value: "schedule", label: "Расписание занятий" },
  { value: "competitions", label: "Соревнования и результаты" },
  { value: "documents", label: "Документы и официальная информация" },
  { value: "general", label: "Другой вопрос" },
];

export default function FeedbackPage() {
  const { settings } = useSiteSettings();
  const [params] = useSearchParams();
  const requestedTopic = params.get("topic");
  const initialTopic = TOPICS.some((item) => item.value === requestedTopic) ? requestedTopic! : "general";
  const startedAt = useRef(Date.now());
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", contact: "", topic: initialTopic as FormValues["topic"], message: "", consent: false, company: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await api.public.feedback({ ...values, started_at: startedAt.current });
      setSent(true);
      reset({ name: "", contact: "", topic: values.topic, message: "", consent: false, company: "" });
      startedAt.current = Date.now();
    } catch (error) {
      if (error instanceof ApiError) {
        setServerError(error.message);
        for (const [key, message] of Object.entries(error.fields)) {
          if (["name", "contact", "message", "consent", "topic"].includes(key)) {
            setError(key as keyof FormValues, { type: "server", message });
          }
        }
      } else {
        setServerError("Не удалось отправить обращение. Попробуйте ещё раз.");
      }
    }
  });

  return (
    <>
      <Seo
        title="Обратная связь — Гродненская ОСДЮШОР им. Ю. К. Культиясова"
        description="Задайте вопрос администрации школы о наборе, тренировках и соревнованиях по настольному теннису. Форма обратной связи и контакты."
        path="/obratnaya-svyaz"
      />
      <PageHero
        label="Обратная связь"
        title="Задайте вопрос школе"
        description="Набор в школу, расписание, соревнования, документы — напишите нам. Администрация ответит по указанному вами контакту."
        crumbs={[{ label: "Обратная связь" }]}
        compact
      />

      <section className="section bg-white">
        <div className="container-site grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div>
            {sent ? (
              <div className="border border-emerald-600/30 bg-emerald-50 p-8 text-center">
                <CheckCircle2 size={42} className="mx-auto text-emerald-700" aria-hidden="true" />
                <h2 className="mt-4 text-2xl text-navy-900">Обращение отправлено</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-graphite-600">
                  Спасибо! Администрация школы получила сообщение и ответит по указанному контакту. Если вопрос срочный,
                  позвоните по телефону, указанному на сайте.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setSent(false)}>
                    Отправить ещё одно
                  </button>
                  <Link to="/" className="btn btn-primary btn-sm">На главную</Link>
                </div>
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl">Форма обращения</h2>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-graphite-400">Все поля обязательны</span>
                </div>
                {serverError && (
                  <div className="mt-5">
                    <FormAlert tone="error">{serverError}</FormAlert>
                  </div>
                )}
                <div className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden" aria-hidden="true">
                  <label htmlFor="fb-company">Не заполняйте</label>
                  <input id="fb-company" type="text" tabIndex={-1} autoComplete="off" {...register("company")} />
                </div>
                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <Field label="Ваше имя" htmlFor="fb-name" required error={errors.name?.message}>
                    <TextInput
                      id="fb-name"
                      autoComplete="name"
                      placeholder="Имя и фамилия"
                      aria-invalid={Boolean(errors.name)}
                      {...register("name")}
                    />
                  </Field>
                  <Field
                    label="Телефон или почта"
                    htmlFor="fb-contact"
                    required
                    hint="Нужен для ответа. Не публикуется на сайте."
                    error={errors.contact?.message}
                  >
                    <TextInput
                      id="fb-contact"
                      autoComplete="email"
                      placeholder="+375 ... или name@example.by"
                      aria-invalid={Boolean(errors.contact)}
                      {...register("contact")}
                    />
                  </Field>
                </div>
                <div className="mt-5">
                  <Field label="Тема обращения" htmlFor="fb-topic" required error={errors.topic?.message}>
                    <Select id="fb-topic" {...register("topic")}>
                      {TOPICS.map((topic) => (
                        <option key={topic.value} value={topic.value}>{topic.label}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <div className="mt-5">
                  <Field label="Сообщение" htmlFor="fb-message" required error={errors.message?.message}>
                    <Textarea
                      id="fb-message"
                      rows={7}
                      placeholder="Расскажите, что вас интересует. Не указывайте медицинские сведения и персональные данные детей."
                      aria-invalid={Boolean(errors.message)}
                      {...register("message")}
                    />
                  </Field>
                </div>
                <div className="mt-5">
                  <label htmlFor="fb-consent" className="flex cursor-pointer items-start gap-3">
                    <input
                      id="fb-consent"
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 accent-accent-600"
                      aria-invalid={Boolean(errors.consent)}
                      {...register("consent")}
                    />
                    <span className="text-sm leading-relaxed text-graphite-700">
                      Я согласен(на) на обработку персональных данных в целях рассмотрения обращения и ознакомлен(а) с{" "}
                      <Link to="/politika-personalnyh-dannyh" className="link-underline">политикой обработки персональных данных</Link>.
                    </span>
                  </label>
                  {errors.consent && <p className="mt-1.5 text-xs font-medium text-accent-700" role="alert">{errors.consent.message}</p>}
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? "Отправляем…" : "Отправить обращение"}
                  </button>
                  <p className="max-w-xs text-[11px] leading-relaxed text-graphite-400">
                    Форма защищена от автоматических отправок. Ответ приходит по указанному контакту.
                  </p>
                </div>
              </form>
            )}
          </div>

          <aside className="space-y-5">
            <div className="border border-navy-100 bg-mist p-6">
              <p className="section-label">Контакты</p>
              <div className="mt-4 space-y-3 text-sm">
                {hasSetting(settings, "contact_email") ? (
                  <a href={`mailto:${settings.contact_email}`} className="flex items-center gap-2 break-all link-underline">
                    <Mail size={16} className="shrink-0" aria-hidden="true" /> {settings.contact_email}
                  </a>
                ) : (
                  <p className="flex items-center gap-2 text-graphite-500"><Mail size={16} aria-hidden="true" /> Почта уточняется</p>
                )}
                {hasSetting(settings, "contact_phone") ? (
                  <a href={`tel:${settings.contact_phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-2 link-underline">
                    <Phone size={16} className="shrink-0" aria-hidden="true" /> {settings.contact_phone}
                  </a>
                ) : (
                  <p className="flex items-center gap-2 text-graphite-500"><Phone size={16} aria-hidden="true" /> Телефон уточняется</p>
                )}
                {hasSetting(settings, "work_hours") && (
                  <p className="flex items-start gap-2 text-graphite-600">
                    <Clock size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> {settings.work_hours}
                  </p>
                )}
              </div>
            </div>
            <div className="border border-navy-100 bg-white p-6">
              <p className="flex items-center gap-2 font-display text-[12px] uppercase tracking-[0.16em] text-accent-700">
                <ShieldAlert size={16} aria-hidden="true" /> Важно
              </p>
              <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-graphite-600">
                <li>Не отправляйте медицинские документы и копии документов детей через форму.</li>
                <li>Не указывайте личные телефоны несовершеннолетних.</li>
                <li>Для записи в школу администрация свяжется с законным представителем.</li>
              </ul>
            </div>
            <div className="border border-navy-100 bg-navy-900 p-6 text-white">
              <p className="font-display text-lg uppercase">Нужно записаться?</p>
              <p className="mt-1 text-sm text-white/65">Выберите тему «Набор и запись в школу» — мы подскажем дальнейшие шаги.</p>
              <Link to="/nabor" className="btn btn-light mt-4 btn-sm">О наборе</Link>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
