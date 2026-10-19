import { useState, type ReactNode } from "react";
import { fileUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

export function GraphicPlaceholder({
  label = "Настольный теннис",
  className,
  dark = false,
}: {
  label?: string;
  className?: string;
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative isolate flex h-full w-full items-center justify-center overflow-hidden",
        dark ? "bg-navy-950 text-white" : "bg-navy-900 text-white",
        className,
      )}
      role="img"
      aria-label={label}
    >
      <div className="absolute inset-0 bg-grid-dark opacity-60" aria-hidden="true" />
      <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full border border-white/10" aria-hidden="true" />
      <div className="absolute -bottom-16 -left-10 h-56 w-56 rounded-full border border-accent-500/30" aria-hidden="true" />
      <div className="absolute right-8 top-8 h-3 w-3 rounded-full bg-accent-500" aria-hidden="true" />
      <div className="absolute inset-x-0 top-1/2 h-px -rotate-[24deg] bg-white/10" aria-hidden="true" />
      <div className="relative z-10 px-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center border border-white/25">
          <span className="h-5 w-5 rounded-full bg-accent-600" aria-hidden="true" />
        </div>
        <p className="font-display text-xs uppercase tracking-[0.24em] text-white/55">{label}</p>
      </div>
    </div>
  );
}

export function SmartImage({
  path,
  alt,
  className,
  imgClassName,
  fallbackLabel,
  priority = false,
  children,
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
  imgClassName?: string;
  fallbackLabel?: string;
  priority?: boolean;
  children?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const src = fileUrl(path);
  const webp =
    path && /^\/images\/[^/]+\.(jpe?g|png)$/i.test(path)
      ? path.replace(/\.(jpe?g|png)$/i, ".webp")
      : null;
  return (
    <div className={cn("relative overflow-hidden bg-navy-900", className)}>
      {src && !failed ? (
        <picture>
          {webp && <source srcSet={webp} type="image/webp" />}
          <img
            src={src}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            className={cn("h-full w-full object-cover", imgClassName)}
            onError={() => setFailed(true)}
          />
        </picture>
      ) : (
        <GraphicPlaceholder label={fallbackLabel ?? alt} />
      )}
      {children}
    </div>
  );
}
