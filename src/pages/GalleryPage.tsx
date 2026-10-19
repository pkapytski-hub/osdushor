import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, X } from "lucide-react";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/site/PageHero";
import { SmartImage } from "@/components/site/Media";
import { EmptyState, ErrorState, LoadingBlock, Reveal } from "@/components/site/primitives";
import { api, fileUrl } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { cn } from "@/lib/utils";
import { useSiteSettings } from "@/lib/site-context";
import { setting } from "@/lib/utils";

export default function GalleryPage() {
  const gallery = useAsync((signal) => api.public.gallery({}, signal), []);
  const { settings } = useSiteSettings();
  const [category, setCategory] = useState("");
  const [active, setActive] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const items = useMemo(() => {
    const all = gallery.data?.items ?? [];
    return category ? all.filter((item) => item.category === category) : all;
  }, [gallery.data, category]);

  const categories = useMemo(
    () => [...new Set((gallery.data?.items ?? []).map((item) => item.category).filter(Boolean))] as string[],
    [gallery.data],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (active !== null && !dialog.open) {
      dialog.showModal();
      document.body.style.overflow = "hidden";
    }
    if (active === null && dialog.open) dialog.close();
    return () => {
      document.body.style.overflow = "";
    };
  }, [active]);

  useEffect(() => {
    if (active === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") setActive((value) => (value === null ? null : (value + 1) % items.length));
      if (event.key === "ArrowLeft") setActive((value) => (value === null ? null : (value - 1 + items.length) % items.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, items.length]);

  const current = active !== null ? items[active] : null;
  const hasDemo = gallery.data?.items.some((item) => item.is_demo) ?? false;

  return (
    <>
      <Seo
        title="Фотогалерея — Гродненская ОСДЮШОР им. Ю. К. Культиясова"
        description="Фотографии тренировок, соревнований и награждений школы настольного тенниса в Гродно. Публикация фотографий воспитанников — только с согласия законных представителей."
        path="/fotogalereya"
        image="/images/awards.jpg"
      />
      <PageHero
        label="Фотогалерея"
        title="Тренировки, турниры, награждения"
        description="Фотографии публикуются с согласия законных представителей. Иллюстративные кадры помечены отдельно."
        crumbs={[{ label: "Воспитанники", to: "/sportsmeny" }, { label: "Фотогалерея" }]}
        compact
      />

      <section className="section bg-white">
        <div className="container-site">
          {(categories.length > 0 || hasDemo) && (
            <div className="flex flex-wrap gap-2 border-b border-navy-100 pb-6">
              <button type="button" className={cn("chip", !category && "chip-active")} onClick={() => setCategory("")}>
                Все фотографии
              </button>
              {categories.map((item) => (
                <button key={item} type="button" className={cn("chip", category === item && "chip-active")} onClick={() => setCategory(item)}>
                  {item}
                </button>
              ))}
            </div>
          )}
          {hasDemo && (
            <p className="mt-5 border-l-2 border-accent-600 bg-accent-50 px-4 py-2.5 text-[12px] leading-relaxed text-accent-800">
              Часть изображений — демонстрационные иллюстрации, а не фотографии воспитанников школы. Они помечены в подписи.
            </p>
          )}

          <div className="mt-8">
            {gallery.loading && <LoadingBlock rows={3} />}
            {gallery.error && <ErrorState message={gallery.error} onRetry={gallery.reload} />}
            {!gallery.loading && !gallery.error && items.length === 0 && (
              <EmptyState
                icon={<ImageIcon size={22} aria-hidden="true" />}
                title="Фотографии готовятся к публикации"
                text="Галерея наполняется администрацией школы с учётом согласий на публикацию изображений."
              />
            )}
            {items.length > 0 && (
              <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
                {items.map((item, index) => (
                  <Reveal key={item.id} className="mb-4 break-inside-avoid">
                    <button
                      type="button"
                      className="group block w-full overflow-hidden border border-navy-100 bg-white text-left"
                      onClick={() => setActive(index)}
                      aria-label={`Открыть фотографию: ${item.title}`}
                    >
                      <SmartImage
                        path={item.image_path}
                        alt={item.title}
                        className={index % 5 === 0 ? "aspect-[4/5]" : index % 3 === 0 ? "aspect-square" : "aspect-[4/3]"}
                        imgClassName="transition-transform duration-500 group-hover:scale-[1.03]"
                        fallbackLabel={item.category ?? "Фотография"}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/75 via-transparent to-transparent opacity-80" aria-hidden="true" />
                        <div className="absolute inset-x-0 bottom-0 p-4">
                          {item.category && <p className="text-[10px] uppercase tracking-[0.18em] text-white/60">{item.category}</p>}
                          <p className="mt-1 text-sm font-medium leading-snug text-white">{item.title}</p>
                        </div>
                      </SmartImage>
                    </button>
                  </Reveal>
                ))}
              </div>
            )}
          </div>
          <p className="mt-8 max-w-3xl text-xs leading-relaxed text-graphite-500">{setting(settings, "photo_disclaimer", "")}</p>
        </div>
      </section>

      <dialog
        ref={dialogRef}
        className="m-0 h-full max-h-none w-full max-w-none border-0 bg-navy-950/98 p-0 text-white backdrop:bg-navy-950/90"
        onClose={() => setActive(null)}
        onCancel={() => setActive(null)}
        aria-label="Просмотр фотографии"
      >
        {current && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-6">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{current.title}</p>
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
                  {current.category ?? "Фотогалерея"} · {(active ?? 0) + 1} / {items.length}
                </p>
              </div>
              <button
                type="button"
                className="flex h-11 w-11 shrink-0 items-center justify-center border border-white/20 text-white hover:bg-white/10"
                onClick={() => setActive(null)}
                aria-label="Закрыть просмотр"
              >
                <X size={22} aria-hidden="true" />
              </button>
            </div>
            <div className="relative flex flex-1 items-center justify-center overflow-hidden p-3 sm:p-8">
              <img src={fileUrl(current.image_path)} alt={current.title} className="max-h-full max-w-full object-contain" />
              {items.length > 1 && (
                <>
                  <button
                    type="button"
                    className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center border border-white/20 bg-navy-950/70 text-white hover:bg-white hover:text-navy-900 sm:left-6"
                    onClick={() => setActive((value) => (value === null ? null : (value - 1 + items.length) % items.length))}
                    aria-label="Предыдущая фотография"
                  >
                    <ChevronLeft size={24} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center border border-white/20 bg-navy-950/70 text-white hover:bg-white hover:text-navy-900 sm:right-6"
                    onClick={() => setActive((value) => (value === null ? null : (value + 1) % items.length))}
                    aria-label="Следующая фотография"
                  >
                    <ChevronRight size={24} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
            <p className="border-t border-white/10 px-4 py-3 text-center text-[11px] text-white/40">
              Используйте стрелки ← → для навигации, Esc — для закрытия
            </p>
          </div>
        )}
      </dialog>
    </>
  );
}
