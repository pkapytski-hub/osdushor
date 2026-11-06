import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export const UNKNOWN = "Уточняется";

export function setting(
  settings: Record<string, string> | null | undefined,
  key: string,
  fallback = UNKNOWN,
): string {
  const value = settings?.[key]?.trim();
  return value || fallback;
}

/** Рейтинг школы — только целые числа: 616.91 → "617". */
export function formatRating(value: number | null | undefined): string {
  return String(Math.round(Number(value ?? 0)));
}

export function hasSetting(settings: Record<string, string> | null | undefined, key: string): boolean {
  return Boolean(settings?.[key]?.trim());
}
