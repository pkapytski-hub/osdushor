export interface SettingField {
  key: string;
  label: string;
  type: "text" | "textarea" | "email" | "phone" | "url" | "image" | "checkbox" | "number";
  hint?: string;
  rows?: number;
  span?: 1 | 2;
}

export interface SettingsGroup {
  id: string;
  title: string;
  description: string;
  fields: SettingField[];
}

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: "organization",
    title: "Организация и школа",
    description: "Официальное наименование, описание и материалы о школе.",
    fields: [
      { key: "org_full_name", label: "Полное наименование", type: "text", span: 2 },
      { key: "org_short_name", label: "Сокращённое наименование", type: "text", span: 2 },
      { key: "org_sport", label: "Вид спорта", type: "text" },
      { key: "org_city", label: "Город", type: "text" },
      { key: "org_tagline", label: "Девиз", type: "text", span: 2 },
      { key: "logo_path", label: "Официальный логотип", type: "image", span: 2, hint: "Если не загружен, используется типографический знак-заглушка." },
      { key: "about_lead", label: "Краткое описание школы", type: "textarea", rows: 3, span: 2, hint: "Используется на главной странице и в подвале сайта." },
      { key: "about_text", label: "Текст о школе", type: "textarea", rows: 6, span: 2 },
      { key: "about_training", label: "О спортивной подготовке", type: "textarea", rows: 5, span: 2 },
      { key: "about_halls", label: "О залах и местах занятий", type: "textarea", rows: 4, span: 2 },
      { key: "history_intro", label: "Вступление к истории", type: "textarea", rows: 3, span: 2 },
      { key: "history_note", label: "Примечание к истории", type: "textarea", rows: 3, span: 2, hint: "Например, пояснение, что раздел наполняется подтверждёнными сведениями." },
    ],
  },
  {
    id: "contacts",
    title: "Контакты и соцсети",
    description: "Публикуйте только проверенные адреса, телефоны и официальные страницы.",
    fields: [
      { key: "contact_email", label: "Электронная почта", type: "email" },
      { key: "contact_phone", label: "Телефон", type: "phone" },
      { key: "contact_address", label: "Адрес", type: "text", span: 2 },
      { key: "work_hours", label: "Режим работы", type: "textarea", rows: 3, span: 2 },
      { key: "social_telegram", label: "Telegram", type: "url" },
      { key: "social_vk", label: "ВКонтакте", type: "url" },
      { key: "social_instagram", label: "Instagram", type: "url" },
      { key: "social_youtube", label: "YouTube", type: "url" },
      { key: "contacts_verified", label: "Контактные данные проверены", type: "checkbox", span: 2, hint: "Уберите флажок, если сведения требуют повторной проверки." },
    ],
  },
  {
    id: "enrollment",
    title: "Набор детей",
    description: "Условия приёма, документы и контакты ответственного за набор.",
    fields: [
      { key: "enrollment_age", label: "С какого возраста принимаются дети", type: "text", span: 2 },
      { key: "enrollment_status", label: "Наличие набора / свободных мест", type: "textarea", rows: 3, span: 2 },
      { key: "enrollment_documents", label: "Необходимые документы", type: "textarea", rows: 4, span: 2 },
      { key: "enrollment_schedule", label: "Где и когда проходят занятия", type: "textarea", rows: 4, span: 2 },
      { key: "enrollment_contact_name", label: "Ответственный за набор", type: "text" },
      { key: "enrollment_contact_phone", label: "Телефон ответственного", type: "phone" },
      { key: "enrollment_contact_email", label: "Почта ответственного", type: "email", span: 2 },
      { key: "enrollment_verified", label: "Условия набора проверены", type: "checkbox", span: 2 },
    ],
  },
  {
    id: "official",
    title: "Официальные сведения",
    description: "Реквизиты и сведения об учреждении на основании документов.",
    fields: [
      { key: "official_unp", label: "УНП", type: "text" },
      { key: "official_registration", label: "Регистрационные сведения", type: "text" },
      { key: "official_legal_address", label: "Юридический адрес", type: "text", span: 2 },
      { key: "official_superior", label: "Вышестоящая организация", type: "text", span: 2 },
      { key: "official_work_hours", label: "Официальный режим работы", type: "textarea", rows: 3, span: 2 },
      { key: "official_reception", label: "Приём граждан", type: "textarea", rows: 3, span: 2 },
      { key: "official_note", label: "Примечание к официальному разделу", type: "textarea", rows: 3, span: 2 },
      { key: "official_verified", label: "Официальные сведения проверены", type: "checkbox", span: 2, hint: "После подтверждения снимите предупреждение на публичной странице." },
    ],
  },
  {
    id: "seo",
    title: "SEO и общие тексты",
    description: "Базовые заголовки, описание и правовые пометки.",
    fields: [
      { key: "seo_title", label: "SEO-заголовок главной", type: "text", span: 2 },
      { key: "seo_description", label: "SEO-описание главной", type: "textarea", rows: 3, span: 2 },
      { key: "photo_disclaimer", label: "Пометка о фотографиях", type: "textarea", rows: 3, span: 2 },
    ],
  },
  {
    id: "analytics",
    title: "Аналитика",
    description: "Сервисы подключаются только после согласия посетителя.",
    fields: [
      { key: "analytics_yandex", label: "Номер счётчика Яндекс Метрики", type: "number", hint: "Только цифры. Оставьте пустым, чтобы отключить." },
      { key: "analytics_google", label: "Идентификатор Google Analytics", type: "text", hint: "Формат G-XXXXXXXX. Оставьте пустым, чтобы отключить." },
    ],
  },
];

export const SETTING_LABELS: Record<string, string> = Object.fromEntries(
  SETTINGS_GROUPS.flatMap((group) => group.fields.map((field) => [field.key, field.label])),
);

export const SETTING_GROUP_BY_KEY: Record<string, string> = Object.fromEntries(
  SETTINGS_GROUPS.flatMap((group) => group.fields.map((field) => [field.key, group.id])),
);
