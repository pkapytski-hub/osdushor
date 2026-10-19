const NEWS = [
  {
    slug: "demo-otkrytie-sezona",
    title: "Демо-новость: открытие нового спортивного сезона",
    category: "school",
    cover: "/images/training.jpg",
    summary: "Так будет выглядеть новость о начале сезона. Текст и дата — демонстрационные.",
    body: "Это демонстрационная публикация для проверки дизайна. Она помечена как «Демо» и не является официальным сообщением школы.\n\nЗдесь администрация сможет рассказать о начале тренировочного года, расписании групп и организационных встречах с родителями.\n\nРеальные новости публикуются через панель управления и не содержат пометки «Демо».",
    daysAgo: 2,
  },
  {
    slug: "demo-turnir-grodno",
    title: "Демо-новость: турнир по настольному теннису в Гродно",
    category: "competitions",
    cover: "/images/hero.jpg",
    summary: "Пример анонса соревнования с датой, местом и возрастными категориями.",
    body: "Демонстрационный анонс. Реальное соревнование, площадка и сроки будут указаны администрацией.\n\nВ карточке соревнования публикуются положение, возрастные категории и ссылка на результаты после завершения турнира.",
    daysAgo: 6,
  },
  {
    slug: "demo-rezultaty",
    title: "Демо-новость: как публикуются результаты соревнований",
    category: "results",
    cover: "/images/racket-ball.jpg",
    summary: "Пример публикации итогов. Итоговые места и фамилии в демо-материале не указаны.",
    body: "Это демонстрационный материал. Мы не публикуем вымышленные имена, места и награды.\n\nПосле турнира администратор добавляет подтверждённые результаты в карточку соревнования и при необходимости прикрепляет протокол.",
    daysAgo: 9,
  },
  {
    slug: "demo-nabor",
    title: "Демо-объявление: приём детей на занятия",
    category: "enrollment",
    cover: "/images/awards.jpg",
    summary: "Пример объявления о наборе. Возраст приёма и условия заполняет администрация.",
    body: "Демонстрационное объявление о наборе. Возраст приёма, наличие мест, перечень документов и контакты ответственного лица должны быть заполнены администрацией школы в разделе «Набор».\n\nДо публикации эти сведения отображаются с пометкой «Уточняется».",
    daysAgo: 12,
  },
  {
    slug: "demo-pozdravlenie",
    title: "Демо-новость: поздравление воспитанникам",
    category: "congratulations",
    cover: "/images/training.jpg",
    summary: "Шаблон поздравительной публикации. Имена и достижения не вымышлены.",
    body: "Демонстрационный шаблон. Имена спортсменов, названия турниров и занятые места добавляются только после подтверждения.\n\nПубликация достижений возможна при наличии согласия на обработку персональных данных.",
    daysAgo: 16,
  },
  {
    slug: "demo-obyavlenie",
    title: "Демо-объявление: изменения в расписании",
    category: "announcements",
    cover: "/images/racket-ball.jpg",
    summary: "Пример служебного объявления для родителей и воспитанников.",
    body: "Демонстрационное объявление. Реальные изменения расписания публикуются администрацией и дублируются в разделе «Расписание занятий».",
    daysAgo: 20,
  },
];

const COMPETITIONS = [
  {
    slug: "demo-kubok-oblasti",
    title: "Демо-турнир: кубок области по настольному теннису",
    description:
      "Демонстрационная карточка соревнования. Название, место проведения и возрастные категории приведены для проверки дизайна и не являются официальным календарём.",
    location: "Демонстрационная запись — место будет указано администрацией",
    offsetDays: 12,
    duration: 2,
    status: "upcoming",
    age: ["Юноши и девушки", "Возрастные группы уточняются"],
  },
  {
    slug: "demo-pervenstvo-shkoly",
    title: "Демо-турнир: первенство школы",
    description:
      "Демонстрационный материал. Здесь будут опубликованы положение, программа и ссылка на протоколы после завершения соревнования.",
    location: "Демонстрационная запись — спортивный зал уточняется",
    offsetDays: 0,
    duration: 1,
    status: "ongoing",
    age: ["Начинающие", "Учебно-тренировочные группы"],
  },
  {
    slug: "demo-mezhdunarodnyy-turnir",
    title: "Демо-турнир: международная встреча",
    description:
      "Пример карточки для турнира с участием приглашённых команд. Реальные сроки и площадка появятся после утверждения календаря.",
    location: "Демонстрационная запись — адрес уточняется",
    offsetDays: 34,
    duration: 3,
    status: "upcoming",
    age: ["Юниоры", "Юниорки"],
  },
  {
    slug: "demo-zavershennyy-turnir",
    title: "Демо-турнир: завершённое соревнование",
    description:
      "Демонстрационная карточка завершённого турнира. Итоговые протоколы и фамилии не публикуются, чтобы не создавать ложное впечатление о реальных результатах.",
    location: "Демонстрационная запись — место будет указано администрацией",
    offsetDays: -14,
    duration: 1,
    status: "finished",
    age: ["Юноши и девушки до 16 лет"],
  },
];

const GALLERY = [
  { title: "Иллюстративное изображение: атакующий удар", image: "/images/hero.jpg", category: "Тренировки" },
  { title: "Иллюстративное изображение: тренировочный процесс", image: "/images/training.jpg", category: "Тренировки" },
  { title: "Иллюстративное изображение: награждение", image: "/images/awards.jpg", category: "Соревнования" },
  { title: "Иллюстративное изображение: ракетка и мяч", image: "/images/racket-ball.jpg", category: "Инвентарь" },
];

function isoDay(offset: number): string {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function isoDateTime(offset: number, hour = 10): string {
  return `${isoDay(offset)}T${String(hour).padStart(2, "0")}:00`;
}

export async function seedDemo(env: Env): Promise<void> {
  if (env.DEMO_DATA !== "true") return;
  const existing = await env.DB.prepare("SELECT COUNT(*) AS count FROM news WHERE is_demo = 1").first<{
    count: number;
  }>();
  if ((existing?.count ?? 0) > 0) return;

  const statements: D1PreparedStatement[] = [];
  for (const item of NEWS) {
    const published = new Date();
    published.setUTCDate(published.getUTCDate() - item.daysAgo);
    statements.push(
      env.DB.prepare(
        `INSERT INTO news (id, slug, title, summary, body, category, cover_path, is_demo, is_published, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`,
      ).bind(
        crypto.randomUUID(),
        item.slug,
        item.title,
        item.summary,
        item.body,
        item.category,
        item.cover,
        published.toISOString(),
      ),
    );
  }
  for (const item of COMPETITIONS) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO competitions (id, slug, title, description, location, starts_on, ends_on, age_categories, status, is_demo, is_published, results_text)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`,
      ).bind(
        crypto.randomUUID(),
        item.slug,
        item.title,
        item.description,
        item.location,
        isoDateTime(item.offsetDays, 10),
        item.duration > 1 ? isoDateTime(item.offsetDays + item.duration - 1, 18) : null,
        JSON.stringify(item.age),
        item.status,
        item.status === "finished"
          ? "Демонстрационные данные. Реальные результаты не публиковались."
          : null,
      ),
    );
  }
  GALLERY.forEach((item, index) => {
    statements.push(
      env.DB.prepare(
        "INSERT INTO gallery_items (id, title, image_path, category, sort_order, is_demo, is_published) VALUES (?, ?, ?, ?, ?, 1, 1)",
      ).bind(crypto.randomUUID(), item.title, item.image, item.category, index),
    );
  });
  await env.DB.batch(statements);
}

export async function removeDemo(env: Env): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM news WHERE is_demo = 1"),
    env.DB.prepare("DELETE FROM competitions WHERE is_demo = 1"),
    env.DB.prepare("DELETE FROM gallery_items WHERE is_demo = 1"),
    env.DB.prepare("DELETE FROM achievements WHERE id LIKE 'demo-%'"),
  ]);
}
