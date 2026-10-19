import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "@/lib/site-context";

const STORAGE_KEY = "osdushor_consent_v1";

type Consent = "accepted" | "declined" | null;

function readConsent(): Consent {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "accepted" || value === "declined" ? value : null;
  } catch {
    return null;
  }
}

function injectYandex(id: string): void {
  if (!/^\d{4,12}$/.test(id) || document.getElementById("ym-script")) return;
  const script = document.createElement("script");
  script.id = "ym-script";
  script.async = true;
  script.src = "https://mc.yandex.ru/metrika/tag.js";
  script.onload = () => {
    const ym = (window as unknown as { ym?: (...args: unknown[]) => void }).ym;
    ym?.(Number(id), "init", {
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
      webvisor: false,
    });
  };
  document.head.appendChild(script);
}

function injectGoogle(id: string): void {
  if (!/^G-[A-Z0-9]{6,14}$/i.test(id) || document.getElementById("ga-script")) return;
  const script = document.createElement("script");
  script.id = "ga-script";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
  const inline = document.createElement("script");
  inline.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id.replace(/[^A-Za-z0-9-]/g, "")}',{anonymize_ip:true});`;
  document.head.appendChild(inline);
}

export function Analytics() {
  const { settings } = useSiteSettings();
  const [consent, setConsent] = useState<Consent>(() => readConsent());
  const yandex = settings.analytics_yandex?.trim() ?? "";
  const google = settings.analytics_google?.trim() ?? "";
  const configured = Boolean(yandex || google);

  useEffect(() => {
    if (consent !== "accepted") return;
    if (yandex) injectYandex(yandex);
    if (google) injectGoogle(google);
  }, [consent, yandex, google]);

  if (!configured || consent) return null;

  const choose = (value: Exclude<Consent, null>) => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Приватный режим браузера может запрещать localStorage.
    }
    setConsent(value);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-navy-700 bg-navy-950/98 px-4 py-4 text-white shadow-2xl backdrop-blur">
      <div className="container-site flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <p className="max-w-3xl text-[13px] leading-relaxed text-white/70">
          Мы используем обезличенную статистику посещения, чтобы улучшать сайт. Аналитические сервисы подключаются
          только с вашего согласия. Подробнее — в{" "}
          <Link to="/politika-personalnyh-dannyh" className="text-white underline decoration-white/40 underline-offset-2">
            политике обработки персональных данных
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button type="button" className="btn btn-light btn-sm" onClick={() => choose("declined")}>
            Отклонить
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => choose("accepted")}>
            Принять
          </button>
        </div>
      </div>
    </div>
  );
}
