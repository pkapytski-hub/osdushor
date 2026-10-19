import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Inbox, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("reveal", visible && "is-visible", className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  label,
  title,
  text,
  action,
  light = false,
  className,
}: {
  label: string;
  title: string;
  text?: string;
  action?: ReactNode;
  light?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="max-w-3xl">
        <p className={cn("section-label", light && "section-label-light")}>{label}</p>
        <h2
          className={cn(
            "mt-3 text-balance text-3xl leading-[1.08] sm:text-4xl lg:text-[44px]",
            light && "text-white",
          )}
        >
          {title}
        </h2>
        {text && (
          <p className={cn("mt-4 max-w-2xl text-[15.5px] leading-relaxed", light ? "text-white/75" : "text-graphite-600")}>
            {text}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  text,
  icon,
  action,
  compact = false,
}: {
  title: string;
  text: string;
  icon?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("border border-dashed border-navy-200 bg-mist/60 text-center", compact ? "px-5 py-8" : "px-6 py-12 sm:px-10")}>
      <div className="mx-auto flex h-12 w-12 items-center justify-center border border-navy-200 bg-white text-navy-700">
        {icon ?? <Inbox size={22} aria-hidden="true" />}
      </div>
      <h3 className="mt-4 font-display text-xl uppercase text-navy-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-graphite-600">{text}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function LoadingBlock({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-4", className)} aria-busy="true" aria-label="Загрузка данных">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="animate-pulse border border-navy-100 bg-white p-5">
          <div className="h-3 w-24 bg-navy-100" />
          <div className="mt-4 h-5 w-3/4 bg-navy-100" />
          <div className="mt-3 h-3 w-full bg-navy-50" />
          <div className="mt-2 h-3 w-2/3 bg-navy-50" />
        </div>
      ))}
    </div>
  );
}

export function LoadingInline({ label = "Загрузка" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-graphite-500" role="status">
      <Loader2 className="h-4 w-4 animate-spin text-accent-600" aria-hidden="true" />
      {label}…
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="border border-accent-600/30 bg-white p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" aria-hidden="true" />
        <div>
          <p className="font-medium text-navy-900">Не удалось загрузить данные</p>
          <p className="mt-1 text-sm leading-relaxed text-graphite-600">{message}</p>
          {onRetry && (
            <button type="button" className="btn btn-outline btn-sm mt-4" onClick={onRetry}>
              <RefreshCw size={14} aria-hidden="true" /> Повторить
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn("badge badge-demo", className)}
      title="Демонстрационный материал. Не является официальной публикацией."
    >
      Демо
    </span>
  );
}

export function DemoNotice({ text }: { text?: string }) {
  return (
    <div className="border border-accent-600/30 bg-accent-50 px-4 py-3 text-sm leading-relaxed text-accent-800">
      <strong className="font-semibold">Демонстрационный материал.</strong>{" "}
      {text ?? "Публикация создана для проверки оформления и не является официальным сообщением школы."}
    </div>
  );
}

export function IllustrationNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-[11px] uppercase tracking-[0.14em] text-white/60", className)}>
      Иллюстративное изображение
    </p>
  );
}

export function ArrowLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={cn("group inline-flex items-center gap-2 font-display text-sm uppercase tracking-[0.12em] text-navy-900 transition-colors hover:text-accent-600", className)}>
      {children}
      <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
    </Link>
  );
}
