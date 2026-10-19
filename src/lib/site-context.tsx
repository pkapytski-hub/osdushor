import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import type { SiteSettings } from "./types";

const DEFAULTS: SiteSettings = {
  org_full_name:
    "Гродненская областная специализированная детско-юношеская школа олимпийского резерва имени Ю. К. Культиясова",
  org_short_name: "Гродненская ОСДЮШОР им. Ю. К. Культиясова",
  org_sport: "Настольный теннис",
  org_city: "Гродно",
  org_tagline: "Воспитываем чемпионов. Открываем возможности.",
  seo_title: "Гродненская ОСДЮШОР им. Ю. К. Культиясова — настольный теннис в Гродно",
  seo_description:
    "Официальный сайт школы олимпийского резерва по настольному теннису в Гродно: набор детей, тренировки, соревнования и достижения.",
  photo_disclaimer:
    "На сайте используются иллюстративные фотографии. Фотографии воспитанников публикуются только с согласия законных представителей.",
};

interface SiteContextValue {
  settings: SiteSettings;
  turnstileSitekey: string;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const SiteContext = createContext<SiteContextValue>({
  settings: DEFAULTS,
  turnstileSitekey: "",
  loading: true,
  error: null,
  reload: () => undefined,
});

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api.public
      .settings(controller.signal)
      .then((response) => {
        setSettings({ ...DEFAULTS, ...response.settings });
        setTurnstileSitekey(response.turnstile_sitekey_?.trim() ?? "");
        setError(null);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError("Настройки сайта временно недоступны.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [nonce]);

  return (
    <SiteContext.Provider value={{ settings, loading, error, reload }}>{children}</SiteContext.Provider>
  );
}

export function useSiteSettings(): SiteContextValue {
  return useContext(SiteContext);
}
