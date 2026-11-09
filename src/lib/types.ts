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

export interface Athlete {
  id: string;
  full_name: string;
  birth_year: number | null;
  gender: string;
  rating: number;
  is_active: boolean | number;
  /** Дата последнего турнира (YYYY-MM-DD); null — не участвовал ни разу. */
  last_tournament_on?: string | null;
  /** Архивный спортсмен: играет редко, в рейтинге не показывается и места не занимает. */
  is_archived?: boolean | number;
  created_at?: string;
  updated_at?: string;
}

export interface AthleteRating extends Athlete {
  /** Место в общем рейтинге; null — спортсмен в архиве и места не занимает. */
  place: number | null;
  /** Лига по месту в общем рейтинге школы: 1, 2 или 3; null — вне рейтинга. */
  league: number | null;
}

export type TournamentFormat = "round_robin" | "groups_playoff" | "olympic";

export const TOURNAMENT_FORMATS: { value: TournamentFormat; label: string; hint: string }[] = [
  { value: "round_robin", label: "Круговой турнир в группах", hint: "Все играют с каждым в своей группе." },
  { value: "groups_playoff", label: "Группы + плей-офф", hint: "После групп сильнейшие выходят в сетку." },
  { value: "olympic", label: "Олимпийская система", hint: "Сетка на вылет без групп: проигравший выбывает." },
];

export interface Tournament {
  id: string;
  title: string;
  held_on: string;
  format: TournamentFormat;
  group_size: number;
  playoff_size: number;
  /** Длина встречи: до 3, 5 или 7 партий (2, 3 или 4 до победы). */
  best_of: number;
  coefficient: number;
  notes: string | null;
  is_published: boolean;
  is_finished: boolean;
  created_at?: string;
  updated_at?: string;
  participants?: number;
  matches?: number;
  played?: number;
  winner?: string | null;
}

export interface TournamentParticipant {
  athlete_id: string;
  full_name: string;
  birth_year: number | null;
  /** Лига по месту в общем рейтинге школы: 1, 2 или 3. Влияет только на время турнира. До жеребьёвки — null. */
  league: number | null;
  group_no: number | null;
  seed: number;
  rating_before: number;
  rating_after: number | null;
  place: number | null;
  wins: number;
  losses: number;
  projected_rating?: number | null;
  projected_delta?: number | null;
}

export interface TournamentMatch {
  id: string;
  stage: "group" | "playoff";
  group_no: number | null;
  round: number;
  slot: number;
  /** Блок сетки олимпийской системы: разыгрываемые им места. */
  place_from?: number | null;
  place_to?: number | null;
  /** Номер встречи в порядке игры (олимпийская система): 1, 2, 3 … */
  number?: number | null;
  player_a: string;
  player_b: string;
  player_a_name: string;
  player_b_name: string;
  score_a: number | null;
  score_b: number | null;
  /** Техническое поражение стороны A/B: 0 очков в таблице. */
  tech_loss_a: boolean;
  tech_loss_b: boolean;
  winner_id: string | null;
  delta_a: number | null;
  delta_b: number | null;
  /** Когда встречу вызвали на стол (вызов снимается в null). */
  called_at?: string | null;
}

export interface TournamentStanding extends TournamentParticipant {
  played: number;
  wins: number;
  losses: number;
  /** Сумма очков: победа — 2, поражение — 1, техническое поражение — 0. */
  points: number;
  sets_for: number;
  sets_against: number;
  diff: number;
}

export interface TournamentGroup {
  group_no: number;
  standings: TournamentStanding[];
  matches: TournamentMatch[];
  /** Сколько человек в группе: от этого зависит длина встреч. */
  player_count: number;
  /** Встречи в группе играются до стольких партий (7, 5 или 3). */
  best_of: number;
  /** Сколько партий нужно выиграть для победы. */
  sets_to_win: number;
}

export interface TournamentPlayoffRound {
  round: number;
  /** Блок сетки: с какого по какое место (null для групп с плей-офф). */
  place_from: number | null;
  place_to: number | null;
  /** Подпись круга: «1/2 финала», «1/2 финала (9–16)», «5–6». */
  label: string;
  matches: TournamentMatch[];
  best_of: number;
  sets_to_win: number;
}

/** Лига — справочная информация: она определяет только время начала турнира. */
export interface TournamentLeague {
  league: number;
  title: string;
  start_time: string;
  participants: number;
  matches: number;
  played: number;
}

export interface TournamentDetail {
  tournament: Tournament;
  participants: TournamentParticipant[];
  leagues: TournamentLeague[];
  groups: TournamentGroup[];
  playoff: TournamentPlayoffRound[];
  group_done: boolean;
  can_playoff: boolean;
  can_finalize: boolean;
  champion: TournamentParticipant | null;
  match_count: number;
  played_count: number;
}

export interface RatingResponse {
  items: AthleteRating[];
  years: number[];
}

export interface TournamentListResponse {
  items: Tournament[];
  years: string[];
}

export interface ArchiveResult {
  id: string;
  athlete_id: string;
  full_name: string;
  birth_year: number | null;
  /** Пол спортсмена в базе: "m" или "f"; может быть пустым у архивных. */
  gender: string | null;
  place: number | null;
  age_category: string | null;
  event_kind: string | null;
  city: string | null;
}

export interface ArchiveCompetition {
  id: string;
  slug: string | null;
  title: string;
  starts_on: string;
  ends_on: string | null;
  location: string;
  age_categories: string[];
  results: ArchiveResult[];
}

export interface AthleteProfileResult {
  id: string;
  held_on: string | null;
  place: number | null;
  age_category: string | null;
  event_kind: string | null;
  city: string | null;
  source_title: string;
  competition_id: string | null;
  competition_slug: string | null;
  competition_title: string | null;
  starts_on: string | null;
}

/** Личная встреча из протокола: соперник, его карточка и счёт. */
export interface AthleteProfileMatch {
  id: string;
  held_on: string | null;
  stage: string | null;
  opponent_name: string;
  opponent_city: string | null;
  opponent_birth_year: number | null;
  opponent_rank: string | null;
  result: "win" | "loss" | "";
  score: string | null;
  source_title: string;
  competition_slug: string | null;
  competition_title: string | null;
}

/** Карточка спортсмена: год рождения, разряд и история мест. */
export interface AthleteProfile {
  id: string;
  full_name: string;
  birth_year: number | null;
  sport_rank: string | null;
  results: AthleteProfileResult[];
  matches: AthleteProfileMatch[];
}

/** Спортсмен, у которого сегодня день рождения. */
export interface BirthdayItem {
  id: string;
  full_name: string;
}

export interface ListResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface CompetitionListResult extends ListResult<Competition> {
  /** Годы календаря с опубликованными соревнованиями — для фильтра по годам. */
  years: string[];
}
