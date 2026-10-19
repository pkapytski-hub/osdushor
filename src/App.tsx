import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { SiteSettingsProvider } from "@/lib/site-context";
import HomePage from "@/pages/HomePage";

// Каждый публичный раздел — отдельный чанк, который догружается при переходе.
// Главная остаётся в основном бандле, чтобы первый экран не ждал лишнего запроса.
const AboutPage = lazy(() => import("@/pages/AboutPage"));
const HistoryPage = lazy(() => import("@/pages/HistoryPage"));
const CoachesPage = lazy(() => import("@/pages/CoachesPage"));
const EnrollmentPage = lazy(() => import("@/pages/EnrollmentPage"));
const SchedulePage = lazy(() => import("@/pages/SchedulePage"));
const NewsPage = lazy(() => import("@/pages/NewsPage"));
const NewsDetailPage = lazy(() => import("@/pages/NewsDetailPage"));
const CompetitionsPage = lazy(() => import("@/pages/CompetitionsPage"));
const CompetitionDetailPage = lazy(() => import("@/pages/CompetitionDetailPage"));
const ResultsPage = lazy(() => import("@/pages/ResultsPage"));
const AchievementsPage = lazy(() => import("@/pages/AchievementsPage"));
const GalleryPage = lazy(() => import("@/pages/GalleryPage"));
const DocumentsPage = lazy(() => import("@/pages/DocumentsPage"));
const ContactsPage = lazy(() => import("@/pages/ContactsPage"));
const FeedbackPage = lazy(() => import("@/pages/FeedbackPage"));
const OfficialInfoPage = lazy(() => import("@/pages/OfficialInfoPage"));
const PrivacyPage = lazy(() => import("@/pages/PrivacyPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));
const AdminApp = lazy(() => import("@/pages/admin/AdminApp"));

export default function App() {
  return (
    <BrowserRouter>
      <SiteSettingsProvider>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<HomePage />} />
            <Route path="o-shkole" element={<AboutPage />} />
            <Route path="istoriya" element={<HistoryPage />} />
            <Route path="trenery" element={<CoachesPage />} />
            <Route path="nabor" element={<EnrollmentPage />} />
            <Route path="raspisanie" element={<SchedulePage />} />
            <Route path="novosti" element={<NewsPage />} />
            <Route path="novosti/:slug" element={<NewsDetailPage />} />
            <Route path="kalendar" element={<CompetitionsPage />} />
            <Route path="kalendar/:slug" element={<CompetitionDetailPage />} />
            <Route path="rezultaty" element={<ResultsPage />} />
            <Route path="sportsmeny" element={<AchievementsPage />} />
            <Route path="fotogalereya" element={<GalleryPage />} />
            <Route path="dokumenty" element={<DocumentsPage />} />
            <Route path="kontakty" element={<ContactsPage />} />
            <Route path="obratnaya-svyaz" element={<FeedbackPage />} />
            <Route path="oficialnaya-informaciya" element={<OfficialInfoPage />} />
            <Route path="politika-personalnyh-dannyh" element={<PrivacyPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route
            path="admin/*"
            element={
              <Suspense
                fallback={
                  <div className="flex min-h-screen items-center justify-center bg-mist">
                    <p className="font-display text-sm uppercase tracking-[0.16em] text-graphite-500">Загрузка панели…</p>
                  </div>
                }
              >
                <AdminApp />
              </Suspense>
            }
          />
        </Routes>
        <Toaster position="bottom-right" richColors closeButton />
      </SiteSettingsProvider>
    </BrowserRouter>
  );
}
