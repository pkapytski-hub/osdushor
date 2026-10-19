import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, Contact, ShieldCheck } from "lucide-react";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/site/PageHero";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { CoachCard } from "@/components/site/cards";
import { EmptyState, ErrorState, LoadingBlock, Reveal } from "@/components/site/primitives";

export default function CoachesPage() {
  const coaches = useAsync((signal) => api.public.coaches(signal), []);
  return (
    <>
      <Seo
        title="Тренерский состав — настольный теннис в Гродно"
        description="Тренеры по настольному теннису Гродненской ОСДЮШОР им. Ю. К. Культиясова: квалификация, спортивные достижения и контакты. Публикуются только подтверждённые сведения."
        path="/trenery"
        image="/images/training.jpg"
      />
      <PageHero
        label="Тренерский состав"
        title="Люди, которые ведут к результату"
        description="В карточках публикуются только подтверждённые сведения: должность, квалификационная категория, спортивные звания, биография и достижения."
        crumbs={[{ label: "О школе", to: "/o-shkole" }, { label: "Тренерский состав" }]}
        image="/images/training.jpg"
        imageAlt="Иллюстративное фото тренировки"
      >
        <Link to="/nabor" className="btn btn-primary">Записаться на занятия <ArrowRight size={16} aria-hidden="true" /></Link>
      </PageHero>

      <section className="section bg-white">
        <div className="container-site">
          {coaches.loading && <LoadingBlock rows={3} />}
          {coaches.error && <ErrorState message={coaches.error} onRetry={coaches.reload} />}
          {!coaches.loading && !coaches.error && coaches.data && coaches.data.items.length === 0 && (
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              <EmptyState
                icon={<BadgeCheck size={22} aria-hidden="true" />}
                title="Карточки тренеров готовятся к публикации"
                text="Мы не публикуем фамилии, звания и фотографии без согласия и проверки документов. Как только сведения будут подтверждены, они появятся на этой странице."
                action={<Link to="/obratnaya-svyaz" className="btn btn-primary btn-sm">Задать вопрос администрации</Link>}
              />
              <div className="border border-navy-100 bg-mist p-6">
                <p className="section-label">Что будет в карточке</p>
                <ul className="mt-5 space-y-4">
                  {[
                    { icon: BadgeCheck, title: "Квалификация", text: "Должность, категория и спортивные звания." },
                    { icon: ShieldCheck, title: "Опыт", text: "Краткая биография и достижения воспитанников." },
                    { icon: Contact, title: "Связь", text: "Контактные данные, разрешённые к публикации." },
                  ].map((item) => (
                    <li key={item.title} className="flex gap-3">
                      <item.icon size={19} className="mt-0.5 shrink-0 text-accent-600" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-semibold text-navy-900">{item.title}</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-graphite-600">{item.text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {coaches.data && coaches.data.items.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {coaches.data.items.map((coach, index) => (
                <Reveal key={coach.id} delay={index * 60}>
                  <CoachCard coach={coach} />
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="bg-navy-900 py-12 text-white">
        <div className="container-site flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-display text-xl uppercase">Хотите попасть в группу?</p>
            <p className="mt-1 text-sm text-white/60">Оставьте обращение — администрация расскажет о свободных местах и порядке записи.</p>
          </div>
          <Link to="/nabor" className="btn btn-light shrink-0">Набор в школу <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>
    </>
  );
}
