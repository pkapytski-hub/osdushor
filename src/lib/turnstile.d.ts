/**
 * Скрипт Cloudflare Turnstile: https://challenges.cloudflare.com/turnstile/v0/api.js
 * Подключается в FeedbackPage только когда sitekey непуст и доступен (после загрузки настроек).
 */
declare global {
  interface Window {
    /** API явно загружаемая скриптом Cloudflare Turnstile. */
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: (err: unknown) => void;
          [key: string]: unknown;
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
      execute: (widgetId?: string) => void;
    };
  }
}
export {};
