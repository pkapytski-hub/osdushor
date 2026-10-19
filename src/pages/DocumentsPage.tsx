import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FileQuestion, ShieldCheck } from "lucide-react";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/site/PageHero";
import { DocumentRow } from "@/components/site/cards";
import { EmptyState, ErrorState, LoadingBlock, Reveal } from "@/components/site/primitives";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { DOCUMENT_CATEGORIES, documentCategoryLabel } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function DocumentsPage() {
  const [category, setCategory] = useState("");
  const documents = useAsync((signal) => api.public.documents({ category }, signal), [category]);

  const groups = new Map<string, NonNullable<typeof documents.data>["items"]>();
  if (documents.data) {
    for (const item of documents.data.items) {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    }
  }

  return (
    <>
      <Seo
        title="Документы — Гродненская ОСДЮШОР им. Ю. К. Культиясова"
        description="Нормативные документы, локальные акты и материалы о деятельности учреждения. Документы с персональными данными не публикуются."
        path="/dokumenty"
      />
      <PageHero
        label="Документы"
        title="Официальные документы и материалы"
        description="Нормативная база учреждения, документы о деятельности и материалы по защите персональных данных."
        crumbs={[{ label: "Документы" }]}
        compact
      >
        <Link to="/oficialnaya-informaciya" className="btn btn-light">
          Официальная информация <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </PageHero>

      <section className="section bg-white">
        <div className="container-site">
          <div className="flex flex-wrap gap-2 border-b border-navy-100 pb-6">
            <button type="button" className={cn("chip", !category && "chip-active")} onClick={() => setCategory("")}>
              Все документы
            </button>
            {DOCUMENT_CATEGORIES.map((item) => (
              <button key={item.value} type="button" className={cn("chip", category === item.value && "chip-active")} onClick={() => setCategory(item.value)}>
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-6 flex items-start gap-3 border border-navy-100 bg-mist px-4 py-3 text-[12px] leading-relaxed text-graphite-600">
            <ShieldCheck size={17} className="mt-0.5 shrink-0 text-accent-600" aria-hidden="true" />
            <p>
              Документы, содержащие персональные данные, медицинскую информацию или сведения о несовершеннолетних,
              не публикуются в открытом доступе. Такие материалы предоставляются в установленном порядке по запросу.
            </p>
          </div>

          <div className="mt-8">
            {documents.loading && <LoadingBlock rows={4} />}
            {documents.error && <ErrorState message={documents.error} onRetry={documents.reload} />}
            {!documents.loading && !documents.error && documents.data && documents.data.items.length === 0 && (
              <EmptyState
                icon={<FileQuestion size={22} aria-hidden="true" />}
                title="Документы готовятся к публикации"
                text="Администрация школы добавит нормативные и локальные акты, подлежащие открытому опубликованию."
                action={<Link to="/obratnaya-svyaz?topic=documents" className="btn btn-outline btn-sm">Запросить документ</Link>}
              />
            )}
            {documents.data && documents.data.items.length > 0 && (
              <div className="space-y-10">
                {[...groups.entries()].map(([key, items]) => (
                  <section key={key}>
                    <div className="flex items-center gap-4">
                      <h2 className="text-xl sm:text-2xl">{documentCategoryLabel(key)}</h2>
                      <span className="h-px flex-1 bg-navy-100" aria-hidden="true" />
                      <span className="text-xs text-graphite-400">{items.length}</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {items.map((item, index) => (
                        <Reveal key={item.id} delay={index * 30}>
                          <DocumentRow item={item} />
                        </Reveal>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          <div className="mt-12 grid gap-6 border-t border-navy-100 pt-8 sm:grid-cols-2">
            <div>
              <h2 className="text-lg">Нужен конкретный документ?</h2>
              <p className="mt-2 text-sm leading-relaxed text-graphite-600">
                Направьте запрос администрации школы. Мы уточним, подлежит ли документ открытому опубликованию и в каком порядке он предоставляется.
              </p>
            </div>
            <div className="flex items-end justify-start sm:justify-end">
              <Link to="/obratnaya-svyaz?topic=documents" className="btn btn-outline">Направить запрос <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
