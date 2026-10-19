import { useRef, useCallback, useEffect, type ReactNode } from "react";

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

// Единый контейнер состояния виджета на страницу (виджет один).
const state: {
  token: string | null;
  widgetId: string | null;
  mounted: boolean;
} = {
  token: null,
  widgetId: null,
  mounted: false,
};

function clearToken() {
  state.token = null;
  state.widgetId && window.turnstile && window.turnstile.reset(state.widgetId);
  state.widgetId = null;
}

function onToken(token: string) {
  state.token = token;
}

function removeWidget() {
  state.widgetId && window.turnstile && window.turnstile.remove(state.widgetId);
  state.widgetId = null;
}

interface TurnstileProps {
  sitekey: string;
  onError?: (error: unknown) => void;
}

export interface TurnstileHandle {
  /** Вернуть текущий токен, если виджет уже ответил. */
  getToken: () => string | null;
  /** Сбросить виджет перед повторной отправкой, чтобы попросить свежий токен. */
  reset: () => void;
}

export function useTurnstileHandle(): TurnstileHandle {
  return {
    getToken: () => state.token,
    reset: () => {
      state.token = null;
      state.widgetId && window.turnstile && window.turnstile.reset(state.widgetId);
      state.widgetId = null;
    },
  };
}

export function Turnstile({ sitekey, onError }: TurnstileProps): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);

  // Удаление виджета при размонтировании компонента.
  useEffect(() => {
    return () => {
      removeWidget();
      state.mounted = false;
    };
  }, []);

  // Рендер виджета после загрузки скрипта и при изменении sitekey.
  useEffect(() => {
    if (!containerRef.current || !sitekey) return;

    // Удаляем предыдущий виджет, если был.
    removeWidget();

    ensureScript().then(() => {
      if (!window.turnstile || !containerRef.current) return;

      try {
        state.widgetId = window.turnstile.render(containerRef.current, {
          sitekey,
          callback: onToken,
          "expired-callback": clearToken,
          "error-callback": onError,
        });
        state.mounted = true;
      } catch (err) {
        onError?.(err);
      }
    });
  }, [sitekey, onError]);

  return (
    <div
      ref={containerRef}
      className="cf-turnstile"
      aria-label="Проверка, что вы не робот"
      tabIndex={-1}
    />
  );
}

// Загрузка скрипта один раз.
function ensureScript(): Promise<void> {
  if (!realScriptPromise) {
    realScriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const tag = document.createElement("script");
      tag.src = SCRIPT_URL;
      tag.async = true;
      tag.onload = () => resolve();
      tag.onerror = reject;
      document.head.appendChild(tag);
    });
  }
  return realScriptPromise;
}
let realScriptPromise: Promise<void> | null = null;
