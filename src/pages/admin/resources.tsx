import type { ReactNode } from "react";
import { formatDate } from "@/lib/format";
import {
  ACHIEVEMENT_LEVELS,
  COMPETITION_STATUSES,
  DOCUMENT_CATEGORIES,
  NEWS_CATEGORIES,
  achievementLevelLabel,
  competitionStatusLabel,
  documentCategoryLabel,
  newsCategoryLabel,
} from "@/lib/types";
import { nowDateTimeInput } from "@/lib/format";

export type AdminFieldType =
  | "text"
  | "textarea"
  | "select"
  | "checkbox"
  | "number"
  | "datetime"
  | "date"
  | "time"
  | "tags"
  | "image"
  | "file"
  | "relation";

export interface AdminField {
  name: string;
  label: string;
  type: AdminFieldType;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  rows?: number;
  span?: 1 | 2;
  relation?: "locations";
  hidden?: boolean;
  max?: number;
  group?: string;
}

export interface AdminColumn {
  key: string;
  label: string;
  render?: (item: Record<string, unknown>) => ReactNode;
  hideOnMobile?: boolean;
}

export interface ResourceConfig {
  key: string;
  title: string;
  singular: string;
  description: string;
  fields: AdminField[];
  columns: AdminColumn[];
  defaults: Record<string, unknown>;
  preview?: "news" | "competition";
  titleField: string;
  sort?: (a: Record<string, unknown>, b: Record<string, unknown>) => number;
}

const WEEKDAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

const publishColumn: AdminColumn = {
  key: "is_published",
  label: "Публикация",
  render: (item) => (
    <span className={`badge ${item.is_published ? "border border-emerald-600/30 bg-emerald-50 text-emerald-800" : "border border-graphite-300 bg-mist text-graphite-500"}`}>
      {item.is_published ? "Опубликовано" : "Черновик"}
    </span>
  ),
};

export const RESOURCES: Record<string, ResourceConfig> = {
  news: {
    key: "news",
    title: "Новости",
    singular: "новость",
    description: "Публикации школы, анонсы, результаты и объявления.",
    titleField: "title",
    preview: "news",
    defaults: {
      title: "",
      slug: "",
      summary: "",
      body: "",
      category: "school",
      cover_path: null,
      meta_title: "",
      meta_description: "",
      is_published: true,
      published_at: nowDateTimeInput(),
    },
    columns: [
      { key: "title", label: "Заголовок" },
      { key: "category", label: "Категория", render: (item) => newsCategoryLabel(String(item.category)) },
      { key: "published_at", label: "Дата", render: (item) => formatDate(String(item.published_at)), hideOnMobile: true },
      publishColumn,
    ],
    fields: [
      { name: "title", label: "Заголовок", type: "text", required: true, span: 2, max: 200 },
      { name: "slug", label: "Адрес (slug)", type: "text", hint: "Оставьте пустым — сформируется автоматически. Меняйте осторожно: старый адрес перестанет работать." },
      { name: "category", label: "Категория", type: "select", required: true, options: NEWS_CATEGORIES },
      { name: "published_at", label: "Дата публикации", type: "datetime", required: true },
      { name: "is_published", label: "Опубликовать на сайте", type: "checkbox" },
      { name: "summary", label: "Краткое описание", type: "textarea", rows: 3, span: 2, max: 400, hint: "Показывается в ленте новостей и в поиске." },
      { name: "cover_path", label: "Обложка", type: "image", span: 2, hint: "JPG, PNG, WebP или AVIF до 8 МБ. Необязательно." },
      { name: "body", label: "Текст публикации", type: "textarea", rows: 14, span: 2, hint: "Абзацы разделяйте пустой строкой. Заголовок раздела начинайте с «## ». Список — с «— »." },
      { name: "meta_title", label: "SEO-заголовок", type: "text", span: 2, max: 120, group: "SEO", hint: "Необязательно. Если пусто, используется заголовок публикации." },
      { name: "meta_description", label: "SEO-описание", type: "textarea", rows: 2, span: 2, max: 300, group: "SEO", hint: "Необязательно. Если пусто, используется краткое описание." },
    ],
  },
  competitions: {
    key: "competitions",
    title: "Соревнования",
    singular: "соревнование",
    description: "Календарь турниров, положения и результаты.",
    titleField: "title",
    preview: "competition",
    defaults: {
      title: "",
      slug: "",
      description: "",
      location: "",
      starts_on: nowDateTimeInput(),
      ends_on: "",
      age_categories: [],
      status: "upcoming",
      regulation_path: null,
      results_path: null,
      results_text: "",
      meta_title: "",
      meta_description: "",
      is_published: true,
    },
    columns: [
      { key: "title", label: "Название" },
      { key: "starts_on", label: "Дата", render: (item) => formatDate(String(item.starts_on)), hideOnMobile: true },
      { key: "status", label: "Статус", render: (item) => competitionStatusLabel(String(item.status)) },
      publishColumn,
    ],
    fields: [
      { name: "title", label: "Название", type: "text", required: true, span: 2, max: 200 },
      { name: "slug", label: "Адрес (slug)", type: "text", hint: "Оставьте пустым для автоматического формирования." },
      { name: "status", label: "Статус", type: "select", required: true, options: COMPETITION_STATUSES },
      { name: "starts_on", label: "Начало", type: "datetime", required: true },
      { name: "ends_on", label: "Окончание", type: "datetime", hint: "Необязательно для однодневного турнира." },
      { name: "location", label: "Место проведения", type: "text", required: true, span: 2, max: 300 },
      { name: "age_categories", label: "Возрастные категории", type: "tags", span: 2, hint: "Введите категории через запятую." },
      { name: "description", label: "Описание", type: "textarea", rows: 8, span: 2 },
      { name: "regulation_path", label: "Положение (PDF)", type: "file", hint: "PDF до 20 МБ." },
      { name: "results_path", label: "Протоколы (PDF)", type: "file" },
      { name: "results_text", label: "Итоги текстом", type: "textarea", rows: 5, span: 2, hint: "Публикуется после завершения. Указывайте только подтверждённые результаты." },
      { name: "is_published", label: "Опубликовать на сайте", type: "checkbox" },
      { name: "meta_title", label: "SEO-заголовок", type: "text", span: 2, max: 120, group: "SEO" },
      { name: "meta_description", label: "SEO-описание", type: "textarea", rows: 2, span: 2, max: 300, group: "SEO" },
    ],
  },
  coaches: {
    key: "coaches",
    title: "Тренеры",
    singular: "карточку тренера",
    description: "Карточки тренерского состава с подтверждёнными сведениями.",
    titleField: "full_name",
    defaults: {
      full_name: "",
      position: "Тренер-преподаватель по настольному теннису",
      category: "",
      bio: "",
      achievements: "",
      contacts: "",
      photo_path: null,
      sort_order: 0,
      is_published: true,
    },
    columns: [
      { key: "full_name", label: "ФИО" },
      { key: "position", label: "Должность" },
      publishColumn,
    ],
    fields: [
      { name: "full_name", label: "Фамилия, имя, отчество", type: "text", required: true, span: 2, max: 160 },
      { name: "position", label: "Должность", type: "text", max: 160 },
      { name: "sort_order", label: "Порядок", type: "number" },
      { name: "category", label: "Квалификационная категория и звания", type: "text", span: 2, max: 200, hint: "Только подтверждённые сведения." },
      { name: "photo_path", label: "Фотография", type: "image", span: 2, hint: "Публикуйте только с согласия тренера." },
      { name: "bio", label: "Краткая биография", type: "textarea", rows: 5, span: 2 },
      { name: "achievements", label: "Спортивные достижения", type: "textarea", rows: 4, span: 2 },
      { name: "contacts", label: "Контакты для публикации", type: "text", span: 2, max: 300, hint: "Заполняйте только если согласовано с тренером." },
      { name: "is_published", label: "Опубликовать на сайте", type: "checkbox" },
    ],
  },
  achievements: {
    key: "achievements",
    title: "Достижения",
    singular: "достижение",
    description: "Подтверждённые результаты и достижения воспитанников.",
    titleField: "title",
    defaults: {
      year: String(new Date().getFullYear()),
      level: "oblast",
      title: "",
      athlete: "",
      place: "",
      description: "",
      sort_order: 0,
      is_published: true,
    },
    columns: [
      { key: "title", label: "Достижение" },
      { key: "athlete", label: "Спортсмен" },
      { key: "level", label: "Уровень", render: (item) => achievementLevelLabel(String(item.level)), hideOnMobile: true },
      publishColumn,
    ],
    fields: [
      { name: "title", label: "Название достижения", type: "text", required: true, span: 2, max: 300 },
      { name: "year", label: "Год", type: "text", max: 10 },
      { name: "level", label: "Уровень", type: "select", required: true, options: ACHIEVEMENT_LEVELS },
      { name: "athlete", label: "Спортсмен", type: "text", max: 200, hint: "Только при наличии согласия на публикацию." },
      { name: "place", label: "Занятое место", type: "text", max: 100 },
      { name: "description", label: "Описание", type: "textarea", rows: 5, span: 2 },
      { name: "sort_order", label: "Порядок", type: "number" },
      { name: "is_published", label: "Опубликовать на сайте", type: "checkbox" },
    ],
  },
  gallery: {
    key: "gallery",
    title: "Фотогалерея",
    singular: "фотографию",
    description: "Фотографии тренировок, турниров и награждений.",
    titleField: "title",
    defaults: { title: "", image_path: null, category: "", sort_order: 0, is_published: true },
    columns: [
      { key: "title", label: "Подпись" },
      { key: "category", label: "Категория" },
      {
        key: "is_demo",
        label: "Тип",
        render: (item) => (item.is_demo ? <span className="badge badge-demo">Демо</span> : <span className="text-xs text-graphite-500">Фото</span>),
      },
      publishColumn,
    ],
    fields: [
      { name: "image_path", label: "Изображение", type: "image", required: true, span: 2, hint: "JPG, PNG, WebP или AVIF до 8 МБ." },
      { name: "title", label: "Подпись", type: "text", span: 2, max: 200 },
      { name: "category", label: "Категория", type: "text", max: 60, hint: "Например: Тренировки, Соревнования, Награждения." },
      { name: "sort_order", label: "Порядок", type: "number" },
      { name: "is_published", label: "Опубликовать на сайте", type: "checkbox" },
    ],
  },
  documents: {
    key: "documents",
    title: "Документы",
    singular: "документ",
    description: "PDF-документы, подлежащие открытому опубликованию.",
    titleField: "title",
    defaults: { title: "", category: "normative", description: "", file_path: null, file_size: null, mime_type: null, sort_order: 0, is_published: true },
    columns: [
      { key: "title", label: "Название" },
      { key: "category", label: "Категория", render: (item) => documentCategoryLabel(String(item.category)) },
      { key: "file_path", label: "Файл", render: (item) => (item.file_path ? <span className="text-xs text-emerald-700">PDF загружен</span> : <span className="text-xs text-accent-700">Нет файла</span>), hideOnMobile: true },
      publishColumn,
    ],
    fields: [
      { name: "title", label: "Название документа", type: "text", required: true, span: 2, max: 300 },
      { name: "category", label: "Категория", type: "select", required: true, options: DOCUMENT_CATEGORIES },
      { name: "sort_order", label: "Порядок", type: "number" },
      { name: "file_path", label: "Файл PDF", type: "file", span: 2, hint: "PDF до 20 МБ. Не публикуйте документы с персональными данными и медицинскими сведениями." },
      { name: "description", label: "Описание", type: "textarea", rows: 3, span: 2, max: 600 },
      { name: "is_published", label: "Опубликовать на сайте", type: "checkbox" },
      { name: "file_size", label: "", type: "number", hidden: true },
      { name: "mime_type", label: "", type: "text", hidden: true },
    ],
  },
  locations: {
    key: "locations",
    title: "Спортивные базы",
    singular: "объект",
    description: "Адреса залов, телефоны и маршруты.",
    titleField: "name",
    defaults: { name: "", address: "", phone: "", schedule_note: "", map_url: "", photo_path: null, sort_order: 0, is_published: true },
    columns: [
      { key: "name", label: "Название" },
      { key: "address", label: "Адрес" },
      publishColumn,
    ],
    fields: [
      { name: "name", label: "Название объекта", type: "text", required: true, span: 2, max: 200 },
      { name: "address", label: "Точный адрес", type: "text", required: true, span: 2, max: 300, hint: "Публикуйте только подтверждённый адрес." },
      { name: "phone", label: "Телефон", type: "text", max: 100 },
      { name: "map_url", label: "Ссылка на карту / маршрут", type: "text", max: 500, hint: "Например, ссылка на Яндекс Карты." },
      { name: "schedule_note", label: "Сведения о расписании", type: "textarea", rows: 3, span: 2, max: 1000 },
      { name: "photo_path", label: "Фотография входа", type: "image", span: 2 },
      { name: "sort_order", label: "Порядок", type: "number" },
      { name: "is_published", label: "Опубликовать на сайте", type: "checkbox" },
    ],
  },
  schedule: {
    key: "schedule",
    title: "Расписание",
    singular: "занятие",
    description: "Группы, время, тренеры и места проведения.",
    titleField: "group_name",
    defaults: { group_name: "", coach: "", weekday: "Понедельник", time_start: "16:00", time_end: "17:30", location_id: "", note: "", sort_order: 0, is_published: true },
    columns: [
      { key: "weekday", label: "День" },
      { key: "time_start", label: "Время", render: (item) => `${item.time_start}–${item.time_end}` },
      { key: "group_name", label: "Группа" },
      publishColumn,
    ],
    fields: [
      { name: "group_name", label: "Название группы", type: "text", required: true, span: 2, max: 160 },
      { name: "weekday", label: "День недели", type: "select", required: true, options: WEEKDAYS.map((value) => ({ value, label: value })) },
      { name: "coach", label: "Тренер", type: "text", max: 160 },
      { name: "time_start", label: "Начало", type: "time", required: true },
      { name: "time_end", label: "Окончание", type: "time", required: true },
      { name: "location_id", label: "Место проведения", type: "relation", relation: "locations", span: 2 },
      { name: "note", label: "Примечание", type: "text", span: 2, max: 500 },
      { name: "sort_order", label: "Порядок", type: "number" },
      { name: "is_published", label: "Опубликовать на сайте", type: "checkbox" },
    ],
  },
  history: {
    key: "history",
    title: "История",
    singular: "событие",
    description: "Подтверждённые этапы развития школы.",
    titleField: "title",
    defaults: { year: "", title: "", description: "", sort_order: 0, is_published: true },
    columns: [
      { key: "year", label: "Год" },
      { key: "title", label: "Событие" },
      publishColumn,
    ],
    fields: [
      { name: "year", label: "Год", type: "text", required: true, max: 10 },
      { name: "sort_order", label: "Порядок", type: "number" },
      { name: "title", label: "Событие", type: "text", required: true, span: 2, max: 200 },
      { name: "description", label: "Описание", type: "textarea", rows: 5, span: 2 },
      { name: "is_published", label: "Опубликовать на сайте", type: "checkbox" },
    ],
  },
};
