type DateFormatStyle = "shorter" | "short" | "standard" | "long";

const dateFormatOptionsByStyle = {
  shorter: { month: "2-digit", day: "2-digit", year: "2-digit", timeZone: "UTC" },
  short: { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" },
  standard: { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" },
  long: { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" },
} satisfies Record<DateFormatStyle, Intl.DateTimeFormatOptions>;

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

export type { DateFormatStyle };

export function formatDate(date: Date | string, style: DateFormatStyle = "long", locale = "en-US") {
  const options = dateFormatOptionsByStyle[style];
  const value = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00.000Z`) : new Date(date);
  const formatterKey = JSON.stringify([locale, options]);
  const formatter = dateFormatters.get(formatterKey) ?? new Intl.DateTimeFormat(locale, options);
  dateFormatters.set(formatterKey, formatter);
  return formatter.format(value);
}

export function toIsoDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function fromIsoDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return new Date(`${value}T00:00:00.000Z`);
}
