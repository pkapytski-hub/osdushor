import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock, MapPin, UserRound } from "lucide-react";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/site/PageHero";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { formatTime } from "@/lib/format";
import { EmptyState, ErrorState, LoadingBlock, Reveal } from "@/components/site/primitives";

const WEEK = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

export default function SchedulePage() {
  const schedule = useAsync((signal) => api.public.schedule(signal), []);
  const todayIndex = (new Date().getDay() + 6) % 7;
  return (
    <>
      <Seo
        title="Расписание занятий — настольный теннис, Гродно"
        description="Расписание тренировок по настольному теннису в Гродненской ОСДЮШОР им. Ю. К. Культиясова: группы, время, тренеры и места проведения."
        path="/raspisanie"
        image="/images/training.jpg"
      />
      <PageHero
        label="Расписание"
        title="Тренировки по группам"
        description="Актуальное расписание публикует администрация школы. Перед первым занятием уточните группу и время у тренера или администрации."
        crumbs={[{ label: "Поступление", to: "/nabor" }, { label: "Расписание" }]}
        compact
      >
        <div className="flex flex-wrap gap-3">
          <Link to="/nabor" className="btn btn-primary">Набор в школу <ArrowRight size={16} aria-hidden="true" /></Link>
          <Link to="/kontakty" className="btn btn-light">Спортивные базы</Link>
        </div>
      </PageHero>

      <section className="section bg-white">
        <div className="container-site">
          {schedule.loading && <LoadingBlock rows={4} />}
          {schedule.error && <ErrorState message={schedule.error} onRetry={schedule.reload} />}
          {!schedule.loading && !schedule.error && schedule.data && schedule.data.items.length === 0 && (
            <EmptyState
              icon={<CalendarClock size={22} aria-hidden="true" />}
              title="Расписание готовится к публикации"
              text="Администрация школы ещё не опубликовала группы и время тренировок. Свяжитесь со школой, чтобы узнать актуальное расписание."
              action={<Link to="/obratnaya-svyaz?topic=schedule" className="btn btn-primary btn-sm">Уточнить расписание</Link>}
            />
          )}
          {schedule.data && schedule.data.items.length > 0 && (
            <div className="space-y-8">
              {WEEK.map((day, index) => {
                const entries = schedule.data!.items.filter((entry) => entry.weekday === day);
                if (entries.length === 0) return null;
                return (
                  <Reveal key={day}>
                    <section aria-labelledby={`day-${index}`}>
                      <div className="flex items-center gap-3">
                        <h2 id={`day-${index}`} className="text-xl sm:text-2xl">{day}</h2>
                        {index === todayIndex && (
                          <span className="badge border border-accent-600 bg-accent-600 text-white">Сегодня</span>
                        )}
                        <span className="h-px flex-1 bg-navy-100" aria-hidden="true" />
                      </div>
                      <div className="mt-4 overflow-hidden border border-navy-100">
                        <table className="w-full border-collapse text-left text-sm">
                          <thead className="hidden bg-mist text-[11px] uppercase tracking-[0.14em] text-graphite-500 sm:table-header-group">
                            <tr>
                              <th scope="col" className="px-4 py-3 font-medium">Время</th>
                              <th scope="col" className="px-4 py-3 font-medium">Группа</th>
                              <th scope="col" className="px-4 py-3 font-medium">Тренер</th>
                              <th scope="col" className="px-4 py-3 font-medium">Место</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-navy-100">
                            {entries.map((entry) => (
                              <tr key={entry.id} className="block p-4 sm:table-row sm:p-0">
                                <td className="block pb-2 font-display text-base font-medium text-navy-900 sm:table-cell sm:px-4 sm:py-4 sm:pb-4">
                                  {formatTime(entry.time_start)} — {formatTime(entry.time_end)}
                                </td>
                                <td className="block pb-1 sm:table-cell sm:px-4 sm:py-4">
                                  <span className="sm:hidden text-[10px] uppercase tracking-[0.14em] text-graphite-400">Группа: </span>
                                  {entry.group_name}
                                  {entry.note && <span className="mt-1 block text-xs text-graphite-500">{entry.note}</span>}
                                </td>
                                <td className="block pb-1 text-graphite-600 sm:table-cell sm:px-4 sm:py-4">
                                  {entry.coach ? (
                                    <span className="inline-flex items-center gap-1.5">
                                      <UserRound size={14} className="text-accent-600 sm:hidden" aria-hidden="true" />
                                      {entry.coach}
                                    </span>
                                  ) : (
                                    <span className="text-graphite-400">Тренер уточняется</span>
                                  )}
                                </td>
                                <td className="block text-graphite-600 sm:table-cell sm:px-4 sm:py-4">
                                  {entry.location_name ? (
                                    <span>
                                      {entry.location_name}
                                      {entry.location_address && <span className="mt-0.5 block text-xs text-graphite-500">{entry.location_address}</span>}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 text-graphite-400">
                                      <MapPin size={14} aria-hidden="true" /> Место уточняется
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </Reveal>
                );
              })}
            </div>
          )}
          <div className="mt-10 max-w-3xl border-l-2 border-navy-200 pl-4 text-xs leading-relaxed text-graphite-500">
            Расписание может меняться в зависимости от учебного и соревновательного календаря. Перед посещением
            уточните информацию у администрации школы.
          </div>
        </div>
      </section>
    </>
  );
}
