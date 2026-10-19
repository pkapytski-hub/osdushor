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

export function hasSetting(settings: Record<string, string> | null | undefined, key: string): boolean {
  return Boolean(settings?.[key]?.trim());
}
