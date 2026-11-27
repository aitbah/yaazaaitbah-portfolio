/**
 * Formatting a `YYYY-MM` month for display, in UTC: the value has no zone, and
 * formatting it at a negative offset would show the previous month.
 */
export function monthAsDate(month: string): Date {
  return new Date(`${month}-01T00:00:00Z`);
}

/** The options every month in this feature is formatted with. */
export const MONTH_FORMAT = {
  year: 'numeric',
  month: 'short',
  timeZone: 'UTC',
} as const;

/** One stored month, written out in the reader's language. */
export function monthLabel(month: string, locale: string): string {
  return monthAsDate(month).toLocaleDateString(locale, MONTH_FORMAT);
}

/**
 * A period, as a CV writes one. `present` is passed in so this stays pure; a
 * single month is written once.
 */
export function monthRange(
  start: string,
  end: string | undefined,
  current: boolean,
  locale: string,
  present: string,
): string {
  const from = monthLabel(start, locale);
  const to = current ? present : end ? monthLabel(end, locale) : '';

  if (!to || to === from) {
    return from;
  }

  return `${from} – ${to}`;
}
