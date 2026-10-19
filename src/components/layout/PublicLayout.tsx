import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { Analytics } from "@/components/Analytics";

export function ScrollToTop() {
  const location = useLocation();
  useEffect(() => {
    if (location.hash) {
      const id = decodeURIComponent(location.hash.slice(1));
      const timer = window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
      return () => window.clearTimeout(timer);
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.hash, location.key]);
  return null;
}

/**
 * Заглушка на время загрузки чанка раздела. Держит минимальную высоту,
 * чтобы шапка и подвал не «прыгали» при первом переходе.
 */
function PageFallback() {
  return (
    <div className="container-site section min-h-[60vh]" aria-busy="true" aria-live="polite">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-graphite-500">Загрузка страницы…</p>
    </div>
  );
}

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Header />
      <main id="main" className="flex-1">
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <Analytics />
    </div>
  );
}
