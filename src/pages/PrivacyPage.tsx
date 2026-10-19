import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/site/PageHero";
import { useSiteSettings } from "@/lib/site-context";
import { setting } from "@/lib/utils";

const SECTIONS = [
  ["general", "1. Общие положения"],
  ["operator", "2. Оператор персональных данных"],
  ["data", "3. Какие данные обрабатываются"],
  ["purposes", "4. Цели и правовые основания"],
  ["children", "5. Данные несовершеннолетних"],
  ["cookies", "6. Файлы cookie и аналитика"],
  ["storage", "7. Хранение и защита"],
  ["rights", "8. Права субъекта персональных данных"],
  ["contact", "9. Контакты и изменения"],
];

export default function PrivacyPage() {
  const { settings } = useSiteSettings();
  const org = setting(settings, "org_full_name");
  const email = setting(settings, "contact_email", "уточняется");
  return (
    <>
      <Seo
        title="Политика обработки персональных данных — Гродненская ОСДЮШОР им. Ю. К. Культиясова"
        description="Как школа обрабатывает и защищает персональные данные посетителей сайта, законных представителей и воспитанников. Проект политики, подлежащий утверждению."
        path="/politika-personalnyh-dannyh"
      />
      <PageHero
        label="Правовая информация"
        title="Политика обработки персональных данных"
        description="Документ описывает подход школы к обработке данных посетителей сайта и обращений. Перед публикацией он подлежит утверждению руководителем учреждения."
        crumbs={[{ label: "Персональные данные" }]}
        compact
      />

      <section className="section bg-white">
        <div className="container-site grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-16">
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="flex items-start gap-3 border border-accent-600/30 bg-accent-50 p-4 text-[12px] leading-relaxed text-accent-900">
              <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>
                <strong className="block">Проект документа</strong>
                Требует проверки юристом и утверждения руководителем учреждения. Не является официально принятым
                локальным актом до утверждения.
              </p>
            </div>
            <nav aria-label="Содержание политики" className="mt-6 hidden border-l border-navy-200 lg:block">
              {SECTIONS.map(([id, label]) => (
                <a key={id} href={`#${id}`} className="block border-l-2 border-transparent px-4 py-2 text-[13px] text-graphite-600 transition-colors hover:border-accent-600 hover:text-navy-900">
                  {label}
                </a>
              ))}
            </nav>
          </aside>

          <div className="min-w-0">
            <div className="space-y-10 text-[15.5px] leading-[1.75] text-graphite-700">
              <section id="general">
                <h2 className="text-2xl normal-case tracking-normal">1. Общие положения</h2>
                <p className="mt-3">
                  Настоящая Политика определяет порядок обработки персональных данных посетителей официального сайта
                  учреждения и лиц, направляющих обращения через формы сайта. Политика разработана с учётом Закона
                  Республики Беларусь от 7 мая 2021 г. № 99-З «О защите персональных данных».
                </p>
                <p className="mt-3">
                  Используя сайт и отправляя обращение, субъект персональных данных подтверждает, что ознакомлен с
                  настоящей Политикой. Для обработки данных в отдельных случаях требуется отдельное согласие.
                </p>
              </section>

              <section id="operator">
                <h2 className="text-2xl normal-case tracking-normal">2. Оператор персональных данных</h2>
                <p className="mt-3">Оператором персональных данных является:</p>
                <div className="mt-3 border-l-2 border-navy-200 bg-mist p-4 text-sm">
                  <p className="font-medium text-navy-900">{org}</p>
                  <p className="mt-1">Адрес: {setting(settings, "official_legal_address")}</p>
                  <p className="mt-1">Электронная почта: {email}</p>
                  {setting(settings, "contact_phone", "") && <p className="mt-1">Телефон: {settings.contact_phone}</p>}
                  <p className="mt-1 text-graphite-500">УНП: {setting(settings, "official_unp")}</p>
                </div>
              </section>

              <section id="data">
                <h2 className="text-2xl normal-case tracking-normal">3. Какие данные обрабатываются</h2>
                <ul className="mt-3 space-y-2">
                  {[
                    "Имя, указанное в форме обратной связи.",
                    "Телефон или адрес электронной почты для ответа.",
                    "Тема и содержание обращения.",
                    "Технические сведения: IP-адрес, сведения о браузере, дата и время запроса — в объёме, необходимом для работы сайта и защиты от злоупотреблений.",
                    "Обезличенная статистика посещений — только при наличии согласия посетителя.",
                  ].map((text) => (
                    <li key={text} className="flex gap-3">
                      <span className="mt-2.5 h-1.5 w-1.5 shrink-0 bg-accent-600" aria-hidden="true" />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3">
                  Через форму обратной связи не следует направлять медицинские документы, копии документов,
                  удостоверяющих личность, и иные избыточные сведения.
                </p>
              </section>

              <section id="purposes">
                <h2 className="text-2xl normal-case tracking-normal">4. Цели и правовые основания</h2>
                <p className="mt-3">Персональные данные обрабатываются в целях:</p>
                <ul className="mt-3 space-y-2">
                  {[
                    "рассмотрения обращений и подготовки ответа;",
                    "консультирования по вопросам набора, расписания и соревнований;",
                    "обеспечения работы сайта, защиты от спама и злоупотреблений;",
                    "ведения обезличенной статистики посещаемости при наличии согласия.",
                  ].map((text) => (
                    <li key={text} className="flex gap-3">
                      <span className="mt-2.5 h-1.5 w-1.5 shrink-0 bg-accent-600" aria-hidden="true" />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3">
                  Обработка осуществляется на основании согласия субъекта, а также в случаях, предусмотренных
                  законодательством Республики Беларусь.
                </p>
              </section>

              <section id="children">
                <h2 className="text-2xl normal-case tracking-normal">5. Данные несовершеннолетних</h2>
                <p className="mt-3">
                  Сайт не предназначен для самостоятельного направления персональных данных детьми. Обращения,
                  связанные с записью в школу, направляются законными представителями.
                </p>
                <p className="mt-3">
                  Публикация имени, фотографии, достижений и иных сведений о несовершеннолетнем воспитаннике
                  допускается только при наличии необходимых согласий, оформленных в установленном порядке.
                  Администрация вправе скрыть или удалить сведения при отзыве согласия.
                </p>
              </section>

              <section id="cookies">
                <h2 className="text-2xl normal-case tracking-normal">6. Файлы cookie и аналитика</h2>
                <p className="mt-3">
                  Сайт использует технически необходимые механизмы хранения данных (в том числе localStorage) для
                  сохранения выбора посетителя в отношении аналитики. Сервисы веб-аналитики подключаются только после
                  явного согласия посетителя и обрабатывают обезличенные сведения о посещениях.
                </p>
                <p className="mt-3">
                  Согласие можно отозвать, очистив данные сайта в браузере. После этого аналитические сервисы не
                  загружаются до нового согласия.
                </p>
              </section>

              <section id="storage">
                <h2 className="text-2xl normal-case tracking-normal">7. Хранение и защита</h2>
                <p className="mt-3">
                  Персональные данные хранятся в течение срока, необходимого для достижения целей обработки и
                  исполнения требований законодательства. Доступ к обращениям имеют только уполномоченные сотрудники
                  учреждения.
                </p>
                <p className="mt-3">
                  Применяются организационные и технические меры защиты: разграничение прав доступа, защищённые
                  каналы передачи данных, ограничение состава собираемых сведений и защита форм от автоматических
                  отправок.
                </p>
              </section>

              <section id="rights">
                <h2 className="text-2xl normal-case tracking-normal">8. Права субъекта персональных данных</h2>
                <p className="mt-3">
                  Субъект вправе получить сведения об обработке своих персональных данных, требовать их уточнения,
                  блокирования или удаления, отозвать согласие, а также обратиться в уполномоченный орган по защите
                  прав субъектов персональных данных в порядке, установленном законодательством.
                </p>
                <p className="mt-3">
                  Для реализации прав направьте обращение на адрес{" "}
                  {settings.contact_email ? (
                    <a href={`mailto:${settings.contact_email}`} className="link-underline">{settings.contact_email}</a>
                  ) : (
                    "электронной почты учреждения (уточняется)"
                  )}{" "}
                  или через <Link to="/obratnaya-svyaz" className="link-underline">форму обратной связи</Link>.
                </p>
              </section>

              <section id="contact">
                <h2 className="text-2xl normal-case tracking-normal">9. Контакты и изменения</h2>
                <p className="mt-3">
                  Учреждение вправе изменять настоящую Политику. Актуальная редакция публикуется на этой странице.
                  Дата утверждения и номер редакции: уточняются.
                </p>
                <div className="mt-4 border-l-2 border-navy-200 bg-mist p-4 text-sm">
                  <p>Ответственный за организацию обработки персональных данных: уточняется.</p>
                  <p className="mt-1">Контакт: {email}</p>
                </div>
              </section>
            </div>

            <div className="mt-10 flex flex-wrap gap-3 border-t border-navy-100 pt-6">
              <Link to="/oficialnaya-informaciya" className="btn btn-outline">
                Официальная информация <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link to="/obratnaya-svyaz" className="btn btn-primary">Задать вопрос</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
