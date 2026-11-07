import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./globals.css";

// Каждый раздел сайта — отдельный файл с хешем в имени. После нового деплоя
// старых файлов уже нет, и в открытой вкладке переход на ещё не загруженный
// раздел обрывается: вместо кода приходит страница 404. Один автоматический
// перезапуск подтягивает актуальные файлы; повторный сбой не зацикливаем.
const RELOAD_KEY = "chunk-reload-at";

window.addEventListener("vite:preloadError", () => {
  const last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
  if (Date.now() - last < 60_000) return;
  window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
