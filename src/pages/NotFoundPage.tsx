import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Seo } from "@/components/Seo";

export default function NotFoundPage() {
  return (
    <>
      <Seo
        title="Страница не найдена — Гродненская ОСДЮШОР им. Ю. К. Культиясова"
        description="Запрошенная страница не найдена. Перейдите на главную страницу или воспользуйтесь основными разделами сайта."
        path="/404"
        noindex
      />
      <section className="bg-navy-900 py-20 text-white sm:py-28">
        <div className="container-site relative">
          <div className="absolute right-0 top-0 hidden font-display text-[160px] leading-none text-white/5 sm:block" aria-hidden="true">404</div>
          <p className="section-label section-label-light">Ошибка 404</p>
          <h1 className="display-1 mt-4 max-w-3xl text-[clamp(2.2rem,6vw,4.2rem)]">Страница не найдена</h1>
          <p className="mt-4 max-w-xl text-[15.5px] leading-relaxed text-white/70">
            Возможно, адрес изменился или страница была снята с публикации. Вернитесь на главную или выберите нужный
            раздел.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/" className="btn btn-primary">На главную <ArrowRight size={16} aria-hidden="true" /></Link>
            <Link to="/novosti" className="btn btn-light">Новости</Link>
            <Link to="/kontakty" className="btn btn-light">Контакты</Link>
          </div>
        </div>
      </section>
    </>
  );
}
