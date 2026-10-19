import { Navigate, Route, Routes } from "react-router-dom";
import { AdminGuard } from "./AdminGuard";
import DashboardPage from "./DashboardPage";
import ResourceListPage from "./ResourceListPage";
import ResourceFormPage from "./ResourceFormPage";
import SettingsPage from "./SettingsPage";
import SeoAdminPage from "./SeoAdminPage";
import StaffPage from "./StaffPage";
import MessagesPage from "./MessagesPage";
import AuditPage from "./AuditPage";
import SecurityPage from "./SecurityPage";
import LoginPage from "./LoginPage";
import SetupPage from "./SetupPage";

const RESOURCE_ROUTES = [
  "news",
  "competitions",
  "achievements",
  "coaches",
  "gallery",
  "documents",
  "history",
  "locations",
  "schedule",
] as const;

export default function AdminApp() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route path="setup" element={<SetupPage />} />
      <Route element={<AdminGuard />}>
        <Route index element={<DashboardPage />} />
        {RESOURCE_ROUTES.map((resource) => (
          <Route key={resource} path={resource} element={<ResourceListPage resourceKey={resource} />} />
        ))}
        {RESOURCE_ROUTES.map((resource) => (
          <Route key={`${resource}-new`} path={`${resource}/new`} element={<ResourceFormPage resourceKey={resource} />} />
        ))}
        {RESOURCE_ROUTES.map((resource) => (
          <Route key={`${resource}-edit`} path={`${resource}/:id`} element={<ResourceFormPage resourceKey={resource} />} />
        ))}
        <Route path="settings" element={<SettingsPage />} />
        <Route path="seo" element={<SeoAdminPage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="security" element={<SecurityPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
