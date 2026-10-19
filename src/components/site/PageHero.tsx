import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { SmartImage } from "./Media";

export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items, light = true }: { items: Crumb[]; light?: boolean }) {
  return (
    <nav aria-label="Хлебные крошки" className={cn("text-[12px]", light ? "text-white/60" : "text-graphite-500")}>
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link to="/" className={cn("inline-flex items-center gap-1 transition-colors", light ? "hover:text-white" : "hover:text-accent-600")}>
            <Home size={13} aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Главная</span>
          </Link>
        </li>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            <ChevronRight size={12} className="opacity-50" aria-hidden="true" />
            {item.to ? (
              <Link to={item.to} className={cn("transition-colors", light ? "hover:text-white" : "hover:text-accent-600")}>
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className={light ? "text-white/85" : "text-graphite-800"}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHero({
  label,
  title,
  description,
  crumbs,
  image,
  imageAlt,
  children,
  compact = false,
}: {
  label: string;
  title: string;
  description?: string;
  crumbs: Crumb[];
  image?: string | null;
  imageAlt?: string;
  children?: ReactNode;
  compact?: boolean;
}) {
  return (
    <section className="relative overflow-hidden bg-navy-900 text-white">
      <div className="absolute inset-0 bg-grid-dark opacity-50" aria-hidden="true" />
      <div className="absolute -left-24 bottom-0 h-64 w-64 rounded-full border border-white/5" aria-hidden="true" />
      <div className="container-site relative z-10">
        <div className={cn("grid items-end gap-8", image ? "lg:grid-cols-[1.25fr_0.75fr]" : "")}>
          <div className={cn("max-w-3xl", compact ? "py-10 sm:py-14" : "py-14 sm:py-20")}>
            <Breadcrumbs items={crumbs} />
            <p className="section-label section-label-light mt-7">{label}</p>
            <h1 className="display-1 mt-3 text-balance text-[clamp(2rem,5vw,3.75rem)]">{title}</h1>
            {description && <p className="mt-5 max-w-2xl text-[15.5px] leading-relaxed text-white/75">{description}</p>}
            {children && <div className="mt-8">{children}</div>}
          </div>
          {image && (
            <div className="relative hidden h-full min-h-[280px] lg:block">
              <SmartImage
                path={image}
                alt={imageAlt ?? title}
                className="absolute inset-0 h-full w-full"
                imgClassName="opacity-80"
                priority
              >
                <div className="absolute inset-0 bg-gradient-to-r from-navy-900 via-navy-900/20 to-transparent" aria-hidden="true" />
                <div className="absolute bottom-4 right-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/50">Иллюстративное изображение</p>
                </div>
              </SmartImage>
            </div>
          )}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 h-1 w-full bg-accent-600" aria-hidden="true" />
    </section>
  );
}
