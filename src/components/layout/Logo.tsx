import { Link } from "react-router-dom";
import { useSiteSettings } from "@/lib/site-context";
import { fileUrl } from "@/lib/api";

export function Logo({ onClick }: { onClick?: () => void }) {
  const { settings } = useSiteSettings();
  const logo = settings.logo_path;
  return (
    <Link to="/" onClick={onClick} className="flex shrink-0 items-center gap-3" aria-label="На главную страницу">
      {logo ? (
        <img src={fileUrl(logo)} alt="" className="h-12 w-auto max-w-[64px] object-contain" width="64" height="48" />
      ) : (
        <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden bg-navy-900 text-white" aria-hidden="true">
          <span className="font-display text-[26px] font-semibold leading-none">О</span>
          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-accent-600" />
          <span className="absolute bottom-0 left-0 h-1 w-full bg-accent-600" />
        </span>
      )}
      <span className="flex flex-col">
        <span className="font-display text-[17px] font-semibold uppercase leading-none tracking-[0.03em] text-navy-900">
          ОСДЮШОР
        </span>
        <span className="mt-1 text-[9.5px] font-medium uppercase leading-tight tracking-[0.18em] text-graphite-500">
          Гродно · Настольный теннис
        </span>
      </span>
    </Link>
  );
}
