-- Схема базы данных сайта Гродненской ОСДЮШОР им. Ю. К. Культиясова.
-- Один источник истины: применяется воркером при первом обращении
-- и может быть применён вручную через wrangler d1 execute --file.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor')),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  iterations INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS news (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'school',
  cover_path TEXT,
  meta_title TEXT,
  meta_description TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  published_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_news_published ON news(is_published, is_demo, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_category ON news(category);

CREATE TABLE IF NOT EXISTS competitions (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  age_categories TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'upcoming',
  regulation_path TEXT,
  results_path TEXT,
  results_text TEXT,
  meta_title TEXT,
  meta_description TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_competitions_date ON competitions(starts_on, status);
CREATE INDEX IF NOT EXISTS idx_competitions_published ON competitions(is_published, is_demo);

CREATE TABLE IF NOT EXISTS coaches (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  position TEXT NOT NULL DEFAULT '',
  category TEXT,
  bio TEXT,
  achievements TEXT,
  contacts TEXT,
  photo_path TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  year TEXT,
  level TEXT NOT NULL DEFAULT 'oblast',
  title TEXT NOT NULL,
  athlete TEXT,
  place TEXT,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_achievements_level ON achievements(level, year);

CREATE TABLE IF NOT EXISTS gallery_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  image_path TEXT NOT NULL,
  category TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_demo INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT,
  file_path TEXT,
  file_size INTEGER,
  mime_type TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  phone TEXT,
  schedule_note TEXT,
  map_url TEXT,
  photo_path TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schedule_entries (
  id TEXT PRIMARY KEY,
  group_name TEXT NOT NULL,
  coach TEXT,
  weekday TEXT NOT NULL,
  time_start TEXT NOT NULL,
  time_end TEXT NOT NULL,
  location_id TEXT,
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS history_events (
  id TEXT PRIMARY KEY,
  year TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS page_seo (
  path TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  og_image TEXT,
  is_indexable INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS feedback_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  consent INTEGER NOT NULL DEFAULT 0,
  ip_hash TEXT,
  user_agent TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback_messages(status, submitted_at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Настройки по умолчанию. Пустые значения — осознанные заготовки:
-- администрация заполняет их через панель, публичный сайт показывает «Уточняется».
INSERT OR IGNORE INTO site_settings (key, value) VALUES
  ('org_full_name', 'Гродненская областная специализированная детско-юношеская школа олимпийского резерва имени Ю. К. Культиясова'),
  ('org_short_name', 'Гродненская ОСДЮШОР им. Ю. К. Культиясова'),
  ('org_sport', 'Настольный теннис'),
  ('org_city', 'Гродно'),
  ('org_tagline', 'Воспитываем чемпионов. Открываем возможности.'),
  ('logo_path', ''),
  ('about_lead', 'Гродненская ОСДЮШОР им. Ю. К. Культиясова — учреждение спортивной подготовки, где дети и подростки делают первые шаги в настольном теннисе и растут до уверенных турнирных результатов.'),
  ('about_text', 'Школа сочетает системную спортивную подготовку с вниманием к каждому ребёнку: от первых занятий и базовой техники до тренировочных групп и соревновательной практики. Настольный теннис здесь — не только спорт, но и школа характера, дисциплины и уважения к сопернику.'),
  ('about_training', 'Тренировочный процесс строится последовательно: общая физическая подготовка, техника ударов и подач, работа у стола, тактика, игровая практика и участие в соревнованиях. Группы формируются с учётом возраста и уровня подготовки.'),
  ('about_halls', 'Сведения о спортивных залах и местах проведения занятий публикуются в разделе «Спортивные базы». Администрация школы может добавить адреса, фотографии и схему проезда.'),
  ('history_intro', 'История школы — это история тренеров, воспитанников и традиций настольного тенниса Гродненской области. Мы публикуем только подтверждённые сведения.'),
  ('history_note', 'Раздел находится в наполнении. Даты, имена основателей и значимые этапы будут добавлены администрацией после проверки архивных данных.'),
  ('enrollment_age', ''),
  ('enrollment_status', ''),
  ('enrollment_documents', ''),
  ('enrollment_schedule', ''),
  ('enrollment_contact_name', ''),
  ('enrollment_contact_phone', ''),
  ('enrollment_contact_email', ''),
  ('contact_email', 'tttennis.grodno@gmail.com'),
  ('contact_phone', ''),
  ('contact_address', ''),
  ('work_hours', ''),
  ('social_telegram', ''),
  ('social_vk', ''),
  ('social_instagram', ''),
  ('social_youtube', ''),
  ('official_unp', ''),
  ('official_registration', ''),
  ('official_legal_address', ''),
  ('official_superior', ''),
  ('official_work_hours', ''),
  ('official_reception', ''),
  ('official_note', 'Сведения об организации заполняются администрацией на основании учредительных документов.'),
  ('seo_title', 'Гродненская ОСДЮШОР им. Ю. К. Культиясова — настольный теннис в Гродно'),
  ('seo_description', 'Официальный сайт Гродненской ОСДЮШОР им. Ю. К. Культиясова: детская секция настольного тенниса в Гродно, набор детей, тренировки, календарь соревнований и достижения воспитанников.'),
  ('analytics_yandex', ''),
  ('analytics_google', ''),
  ('photo_disclaimer', 'На сайте используются иллюстративные фотографии. Фотографии воспитанников публикуются только с согласия законных представителей.'),
  ('contacts_verified', '0'),
  ('enrollment_verified', '0'),
  ('official_verified', '0');

INSERT OR IGNORE INTO page_seo (path, title, description) VALUES
  ('/', 'Гродненская ОСДЮШОР им. Ю. К. Культиясова — настольный теннис в Гродно', 'Официальный сайт школы олимпийского резерва по настольному теннису в Гродно: набор детей, тренировки, соревнования, результаты и достижения воспитанников.'),
  ('/o-shkole', 'О школе — Гродненская ОСДЮШОР им. Ю. К. Культиясова', 'О специализации, спортивной подготовке и традициях Гродненской ОСДЮШОР им. Ю. К. Культиясова. Настольный теннис для детей и подростков в Гродно.'),
  ('/istoriya', 'История школы — Гродненская ОСДЮШОР им. Ю. К. Культиясова', 'История Гродненской школы олимпийского резерва по настольному теннису: значимые этапы, тренеры и воспитанники.'),
  ('/trenery', 'Тренерский состав — настольный теннис в Гродно', 'Тренеры по настольному теннису Гродненской ОСДЮШОР им. Ю. К. Культиясова: квалификация, спортивные достижения и контакты.'),
  ('/nabor', 'Набор в секцию настольного тенниса в Гродно — ОСДЮШОР им. Ю. К. Культиясова', 'Как записать ребёнка в секцию настольного тенниса в Гродно: возраст приёма, документы, порядок собеседования и контакты школы.'),
  ('/raspisanie', 'Расписание занятий — настольный теннис, Гродно', 'Расписание тренировок по настольному теннису в Гродненской ОСДЮШОР им. Ю. К. Культиясова.'),
  ('/novosti', 'Новости школы — Гродненская ОСДЮШОР им. Ю. К. Культиясова', 'Новости, объявления, соревнования и результаты Гродненской ОСДЮШОР им. Ю. К. Культиясова.'),
  ('/kalendar', 'Календарь соревнований по настольному теннису — Гродненская область', 'Календарь соревнований по настольному теннису: даты, места проведения, возрастные категории и положения.'),
  ('/rezultaty', 'Результаты соревнований — настольный теннис, Гродно', 'Результаты соревнований по настольному теннису и достижения воспитанников Гродненской ОСДЮШОР им. Ю. К. Культиясова.'),
  ('/sportsmeny', 'Спортсмены и достижения — Гродненская ОСДЮШОР им. Ю. К. Культиясова', 'Достижения воспитанников школы на областных, республиканских и международных соревнованиях по настольному теннису.'),
  ('/fotogalereya', 'Фотогалерея — Гродненская ОСДЮШОР им. Ю. К. Культиясова', 'Фотографии тренировок, соревнований и награждений школы настольного тенниса в Гродно.'),
  ('/dokumenty', 'Документы — Гродненская ОСДЮШОР им. Ю. К. Культиясова', 'Нормативные документы, локальные акты и материалы о деятельности учреждения.'),
  ('/kontakty', 'Контакты и спортивные базы — Гродненская ОСДЮШОР им. Ю. К. Культиясова', 'Адреса спортивных баз, телефоны, режим работы и карта проезда к Гродненской ОСДЮШОР им. Ю. К. Культиясова.'),
  ('/obratnaya-svyaz', 'Обратная связь — Гродненская ОСДЮШОР им. Ю. К. Культиясова', 'Задайте вопрос администрации школы о наборе, тренировках и соревнованиях по настольному теннису.'),
  ('/oficialnaya-informaciya', 'Официальная информация — Гродненская ОСДЮШОР им. Ю. К. Культиясова', 'Сведения об организации, режим работы, нормативные документы и обязательная информация государственного учреждения.'),
  ('/politika-personalnyh-dannyh', 'Политика обработки персональных данных — Гродненская ОСДЮШОР им. Ю. К. Культиясова', 'Как школа обрабатывает и защищает персональные данные посетителей сайта и законных представителей воспитанников.');
