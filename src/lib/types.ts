export type NewsCategory =
  | "school"
  | "competitions"
  | "results"
  | "announcements"
  | "enrollment"
  | "congratulations";

export const NEWS_CATEGORIES: { value: NewsCategory; label: string }[] = [
  { value: "school", label: "Новости школы" },
  { value: "competitions", label: "Соревнования" },
  { value: "results", label: "Результаты" },
  { value: "announcements", label: "Объявления" },
  { value: "enrollment", label: "Набор детей" },
  { value: "congratulations", label: "Поздравления и достижения" },
];

export const newsCategoryLabel = (value: string): string =>
  NEWS_CATEGORIES.find((c) => c.value === value)?.label ?? "Новости";

export interface NewsItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  category: NewsCategory;
  cover_path: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  is_demo: boolean;
  is_published: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export type CompetitionStatus = "upcoming" | "ongoing" | "finished";

export const COMPETITION_STATUSES: { value: CompetitionStatus; label: string }[] = [
  { value: "upcoming", label: "Предстоящее" },
  { value: "ongoing", label: "Проходит" },
  { value: "finished", label: "Завершено" },
];

export const competitionStatusLabel = (value: string): string =>
  COMPETITION_STATUSES.find((c) => c.value === value)?.label ?? "";

export interface Competition {
  id: string;
  slug: string;
  title: string;
  description: string;
  location: string;
  starts_on: string;
  ends_on: string | null;
  age_categories: string[];
  status: CompetitionStatus;
  regulation_path: string | null;
  results_path: string | null;
  results_text: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  is_demo: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Coach {
  id: string;
  full_name: string;
  position: string;
  category: string | null;
  bio: string | null;
  achievements: string | null;
  contacts: string | null;
  photo_path: string | null;
  sort_order: number;
  is_published: boolean;
}

export type AchievementLevel = "oblast" | "respublika" | "international";

export const ACHIEVEMENT_LEVELS: { value: AchievementLevel; label: string }[] = [
  { value: "international", label: "Международный уровень" },
  { value: "respublika", label: "Республиканский уровень" },
  { value: "oblast", label: "Областной уровень" },
];

export const achievementLevelLabel = (value: string): string =>
  ACHIEVEMENT_LEVELS.find((c) => c.value === value)?.label ?? "";

export interface Achievement {
  id: string;
  year: string | null;
  level: AchievementLevel;
  title: string;
  athlete: string | null;
  place: string | null;
  description: string | null;
  sort_order: number;
  is_published: boolean;
}

export interface GalleryItem {
  id: string;
  title: string;
  image_path: string;
  category: string | null;
  sort_order: number;
  is_demo?: boolean;
  is_published: boolean;
}

export type DocumentCategory = "normative" | "activity" | "personal-data" | "other";

export const DOCUMENT_CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: "normative", label: "Нормативные документы" },
  { value: "activity", label: "Деятельность учреждения" },
  { value: "personal-data", label: "Персональные данные" },
  { value: "other", label: "Другие материалы" },
];

export const documentCategoryLabel = (value: string): string =>
  DOCUMENT_CATEGORIES.find((c) => c.value === value)?.label ?? "Документы";

export interface DocumentItem {
  id: string;
  title: string;
  category: DocumentCategory;
  description: string | null;
  file_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  sort_order: number;
  is_published: boolean;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  schedule_note: string | null;
  map_url: string | null;
  photo_path: string | null;
  sort_order: number;
  is_published: boolean;
}

export interface ScheduleEntry {
  id: string;
  group_name: string;
  coach: string | null;
  weekday: string;
  time_start: string;
  time_end: string;
  location_id: string | null;
  location_name?: string | null;
  location_address?: string | null;
  note: string | null;
  sort_order: number;
  is_published: boolean;
}

export interface HistoryEvent {
  id: string;
  year: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_published: boolean;
}

export interface PageSeo {
  path: string;
  title: string;
  description: string;
  og_image: string | null;
  is_indexable: boolean;
  updated_at: string;
}

export type StaffRole = "admin" | "editor";

export interface StaffMember {
  id: string;
  email: string;
  display_name: string;
  role: StaffRole;
  is_active: number;
  created_at: string;
  last_login_at: string | null;
}

export interface FeedbackMessage {
  id: string;
  submitted_at: string;
  name: string;
  contact: string;
  topic: string;
  message: string;
  status: "new" | "read" | "archived";
  consent: number;
}

export interface AuditEntry {
  id: string;
  actor_email: string;
  action: string;
  entity: string;
  entity_id: string | null;
  details: string | null;
  created_at: string;
}

export interface MeInfo {
  user: { id: string; email: string; name: string; role: StaffRole } | null;
  setup_required: boolean;
  setup_available: boolean;
  demo_mode: boolean;
}

export interface SiteSettings {
  [key: string]: string;
}

export interface AdminStats {
  counts: {
    news: number;
    competitions: number;
    coaches: number;
    achievements: number;
    gallery: number;
    new_messages: number;
    demo: number;
  };
  empty_settings: string[];
  verification: Record<string, boolean>;
  recent_messages: { id: string; name: string; topic: string; submitted_at: string }[];
  role: StaffRole;
  demo_mode: boolean;
}

export interface ListResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}
