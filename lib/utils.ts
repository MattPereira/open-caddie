import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

type DateFormatStyle = "short" | "standard" | "long";

const dateFormatOptionsByStyle = {
  short: {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  },
  standard: {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  },
  long: {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  },
} satisfies Record<DateFormatStyle, Intl.DateTimeFormatOptions>;

const defaultDateFormatStyle: DateFormatStyle = "long";

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

export type { DateFormatStyle };

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(
  date: Date | string,
  style: DateFormatStyle = defaultDateFormatStyle,
  locale = "en-US",
) {
  const options = dateFormatOptionsByStyle[style];
  const value =
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Date(`${date}T00:00:00.000Z`)
      : new Date(date);
  const formatterKey = JSON.stringify([locale, options]);
  const formatter =
    dateFormatters.get(formatterKey) ??
    new Intl.DateTimeFormat(locale, options);

  dateFormatters.set(formatterKey, formatter);

  return formatter.format(value);
}

export function toIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromIsoDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return new Date(`${value}T00:00:00.000Z`);
}
