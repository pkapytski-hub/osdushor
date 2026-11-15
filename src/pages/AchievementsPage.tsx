import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Medal, Search, ShieldCheck, Trophy, X } from "lucide-react";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/site/PageHero";
import { AchievementCard } from "@/components/site/cards";
import { EmptyState, ErrorState, LoadingBlock, Reveal } from "@/components/site/primitives";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { ACHIEVEMENT_LEVELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { parseDate } from "@/lib/format";

export default function AchievementsPage() {
  const [level, setLevel] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  // Поиск идёт по картотеке спортсменов: по запросу в выдачу попадают и архивные,
  // у которых давно нет турниров, но карточка на сайте осталась.
  const people = useAsync((signal) => api.public.rating({ q: query }, signal), [query], query.length > 0);
  const found = people.data?.items ?? [];
  const shown = found.slice(0, 12);
  const achievements = useAsync((signal) => api.public.achievements({ level }, signal), [level]);
  const birthdays = useAsync((signal) => api.public.birthdays(signal), []);
  const birthdayItems = birthdays.data?.items ?? [];

  const groups = new Map<string, NonNullable<typeof achievements.data>["items"]>();
  if (achievements.data) {
    for (const item of achievements.data.items) {
      const year = item.year || "Без года";
      const list = groups.get(year) ?? [];
      list.push(item);
      groups.set(year, list);
    }
  }

  return (
    <>
      <Seo
        title="Спортсмены и достижения — Гродненская ОСДЮШОР им. Ю. К. Культиясова"
        description="Достижения воспитанников школы на областных, республиканских и международных соревнованиях по настольному теннису. Только подтверждённые результаты."
        path="/sportsmeny"
        image="/images/awards.jpg"
      />
      <PageHero
        label="Воспитанники"
        title="Спортсмены и достижения"
        description="Победы на областных и республиканских соревнованиях, участие в международных турнирах и истории успешных спортсменов. Публикуются только подтверждённые результаты."
        crumbs={[{ label: "Спортсмены и достижения" }]}
        image="/images/awards.jpg"
        imageAlt="Иллюстративное фото награждения"
      >
        <Link to="/rezultaty" className="btn btn-light">
          Результаты соревнований <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </PageHero>

      <section className="section bg-white">
        <div className="container-site">
          {birthdayItems.length > 0 && (
            <div className="mb-8 border border-accent-600/40 bg-mist/60 p-5 sm:p-6">
              <p className="section-label">Сегодня день рождения</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {birthdayItems.map((person) => (
                  <li key={person.id}>
                    <Link to={`/sportsmeny/${person.id}`} className="chip chip-active">
                      {person.full_name}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-graphite-600">Поздравляем воспитанников школы!</p>
            </div>
          )}
          <section className="mb-8 border border-navy-100 bg-mist/50 p-5 sm:p-6" aria-labelledby="athlete-search-title">
            <p className="section-label" id="athlete-search-title">
              Найти спортсмена
            </p>
            <form
              role="search"
              className="mt-4 flex gap-2 sm:max-w-xl"
              onSubmit={(event) => {
                event.preventDefault();
                setQuery(search.trim());
              }}
            >
              <label htmlFor="athlete-search" className="sr-only">
                Поиск спортсмена по фамилии
              </label>
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-graphite-400"
                  aria-hidden="true"
                />
                <input
                  id="athlete-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Фамилия или имя"
                  className="field-input pl-10"
                  autoComplete="off"
                />
                {search && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-graphite-400 hover:text-navy-900"
                    onClick={() => setSearch("")}
                    aria-label="Очистить поиск"
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
            </form>

            {query && (
              <div className="mt-4" aria-live="polite">
                {people.loading && <p className="text-sm text-graphite-500">Ищем совпадения…</p>}
                {people.error && <p className="text-sm text-accent-700">{people.error}</p>}
                {!people.loading && !people.error && found.length === 0 && (
                  <p className="text-sm text-graphite-600">
                    Спортсмен с такой фамилией не найден. Проверьте написание или{" "}
                    <Link
                      to="/reyting"
                      className="font-medium text-navy-900 underline decoration-navy-300 underline-offset-4 transition-colors hover:text-accent-600"
                    >
                      откройте рейтинг
                    </Link>
                    .
                  </p>
                )}
                {shown.length > 0 && (
                  <>
                    <ul className="divide-y divide-navy-100 border-y border-navy-100 bg-white">
                      {shown.map((person) => (
                        <li key={person.id}>
                          <Link to={`/sportsmeny/${person.id}`} className="group flex items-center gap-3 px-3 py-2.5">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-navy-900 transition-colors group-hover:text-accent-600">
                                {person.full_name}
                              </span>
                              <span className="block text-xs text-graphite-500">
                                {person.birth_year ? `${person.birth_year} г. р.` : "год рождения не указан"}
                                {person.place ? ` · ${person.place}-е место в рейтинге` : " · вне рейтинга"}
                              </span>
                            </span>
                            <ArrowRight
                              size={16}
                              className="shrink-0 text-graphite-400 transition-colors group-hover:text-accent-600"
                              aria-hidden="true"
                            />
                          </Link>
                        </li>
                      ))}
                    </ul>
                    {found.length > shown.length && (
                      <p className="mt-3 text-xs text-graphite-500">
                        Показаны первые {shown.length} из {found.length}. Уточните запрос — добавьте имя.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </section>

          <div className="flex flex-col gap-4 border-b border-navy-100 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <button type="button" className={cn("chip", !level && "chip-active")} onClick={() => setLevel("")}>
                Все уровни
              </button>
              {ACHIEVEMENT_LEVELS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={cn("chip", level === item.value && "chip-active")}
                  onClick={() => setLevel(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-graphite-500">
              <ShieldCheck size={14} className="text-accent-600" aria-hidden="true" />
              Только подтверждённые данные
            </p>
          </div>

          <div className="mt-8">
            {achievements.loading && <LoadingBlock rows={3} />}
            {achievements.error && <ErrorState message={achievements.error} onRetry={achievements.reload} />}
            {!achievements.loading && !achievements.error && achievements.data && achievements.data.items.length === 0 && (
              <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                <EmptyState
                  icon={<Medal size={22} aria-hidden="true" />}
                  title={level ? "По этому уровню пока нет публикаций" : "Раздел достижений готов к наполнению"}
                  text="Мы не создаём вымышленные имена, награды и статистику. Администрация добавит результаты после подтверждения протоколами и согласия на публикацию персональных данных."
                  action={
                    level ? (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setLevel("")}>
                        Показать все уровни
                      </button>
                    ) : (
                      <Link to="/rezultaty" className="btn btn-outline btn-sm">Результаты соревнований</Link>
                    )
                  }
                />
                <div className="border border-navy-100 bg-mist p-6">
                  <p className="section-label">Как публикуются достижения</p>
                  <ol className="mt-5 space-y-4 text-sm leading-relaxed text-graphite-700">
                    {[
                      "Завершение соревнования и подведение итогов.",
                      "Проверка протокола и занятых мест администрацией.",
                      "Согласие законных представителей на публикацию имени и фотографии.",
                      "Публикация результата с уровнем и годом.",
                    ].map((text, index) => (
                      <li key={text} className="flex gap-3">
                        <span className="font-display text-lg leading-none text-accent-600">0{index + 1}</span>
                        <span>{text}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
            {achievements.data && achievements.data.items.length > 0 && (
              <div className="space-y-12">
                {[...groups.entries()].map(([year, items]) => (
                  <section key={year}>
                    <div className="flex items-center gap-4">
                      <h2 className="font-display text-3xl text-navy-900">{year}</h2>
                      <span className="h-px flex-1 bg-navy-100" aria-hidden="true" />
                      <Trophy size={18} className="text-accent-600" aria-hidden="true" />
                    </div>
                    <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((item, index) => (
                        <Reveal key={item.id} delay={index * 40}>
                          <AchievementCard item={item} />
                        </Reveal>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-navy-900 py-12 text-white">
        <div className="container-site flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-display text-xl uppercase">Знаете о достижении воспитанника?</p>
            <p className="mt-1 max-w-2xl text-sm text-white/60">
              Передайте сведения администрации школы — после проверки протокола и согласия мы сможем опубликовать результат.
            </p>
          </div>
          <Link to="/obratnaya-svyaz" className="btn btn-light shrink-0">Связаться со школой <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>
    </>
  );
}
