import { useRef, useCallback, useEffect, type ReactNode } from "react";

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise: Promise<void> | null = null;
let onInstalledCallback: (() => void)[] = [];

function ensureScript() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      `script[src="${SCRIPT_URL}"]`,
    );
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

  const installed = () => {
    if (window.turnstile) {
      for (const cb of onInstalledCallback) cb();
      onInstalledCallback.length = 0;
    }
  };
  window.addEventListener("turnstile_loaded", installed, { once: false });
  onInstalledCallback.push(installed);
  return scriptPromise;
}

interface TurnstileProps {
  sitekey: string;
  onToken?: (token: string | null) => void;
  onError?: (error: unknown) => void;
  children?: ReactNode;
}

export interface TurnstileHandle {
  /**
   * Вернуть текущий токен, если виджет уже ответил.
   (Если ответа ещё нет — вернуть null, отправитель попросит «подтвердите».)
   */
  getToken: () => string | null;
  /** Сбросить виджет, чтобы при повторной отправке попросился свежий токен. */
  reset: () => void;
}

export let turnstileHandle: TurnstileHandle | null = null;
export function useTurnstile() {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    let disposed = false;
    const dispose = () => {
      widgetIdRef.current && window.turnstile && window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
      tokenRef.current = null;
    };
    return () => { disposed = true; dispose(); };
  }, []);

  const clearToken = useCallback(() => {
    tokenRef.current = null;
    widgetIdRef.current && !disposed && window.turnstile && window.turnstile.reset(widgetIdRef.current);
  }, []);

  useEffect(() => {
    if (!sitekey || !containerRef.current) return;

    ensureScript().then(() => {
      if (!window.turnstile || !containerRef.current) return;

      widgetIdRef.current && window.turnstile && window.turnstile.remove(widgetIdRef.current);

      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey,
          callback: (token: string) => {
            tokenRef.current = token;
          },
          "expired-callback": clearToken,
          "error-callback": () => {
            // Если виджет вообще не рендерится — это видимо проблема домена/скрипта;
            // отправка будет заблокирована сервером, но пользователь сразу увидит это.
          },
        });
      } catch (err: unknown) {
        // Виджет не рендерится — сбрасываем, чтобы отправитель попросил «подтвердите».
        tokenRef.current = null;
        widgetIdRef.current && window.turnstile && window.turnstile.reset(widgetIdRef.current);
      }
    });
  }, [sitekey, clearToken]);

  return (
    <div
      ref={containerRef}
      className="cf-turnstile"
      aria-label="Проверка, что вы не робот"
      tabIndex={-1}
    />
  );
}

export function useTurnstileHandle(): TurnstileHandle {
  const reset = useCallback(() => {
    tokenRef.current = null;
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  const getToken = useCallback(() => tokenRef.current, []);

  // Стабильный хендл, но он живёт пока жив Turnstile; при размонтировании
  // остаётся «мёртвым» — это нормально, страница одна.
  turnstileHandle ??= { getToken, reset };
  return turnstileHandle;
}

