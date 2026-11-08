import { Link } from "react-router-dom";
import { useSiteSettings } from "@/lib/site-context";
import { fileUrl } from "@/lib/api";

export function Logo({ onClick }: { onClick?: () => void }) {
  const { settings } = useSiteSettings();
  const logo = settings.logo_path;
  return (
    <Link to="/" onClick={onClick} className="flex shrink-0 items-center gap-3" aria-label="На главную страницу">
      <img
        src={logo ? fileUrl(logo) : "/images/logo.png"}
        alt=""
        className="h-11 w-11 shrink-0 rounded-md bg-white object-contain sm:h-14 sm:w-14"
        width="56"
        height="56"
      />
      <span className="flex flex-col">
        <span className="font-display text-[17px] font-semibold uppercase leading-none tracking-[0.03em] text-navy-900">
          ОСДЮШОР
        </span>
        <span className="mt-1 hidden text-[9.5px] font-medium uppercase leading-tight tracking-[0.18em] text-graphite-500 min-[360px]:block">
          Гродно · Настольный теннис
        </span>
      </span>
    </Link>
  );
}
