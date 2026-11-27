/**
 * Experience and education as a reader wants them: most recent first, each
 * with its length. Months are `YYYY-MM`. Pure: "now" is passed in.
 */

export type Stint = {
  startDate: string;
  endDate?: string;
  current: boolean;
};

export type DatedStint<T> = T & {
  /** Its length in months, counting the first and the last (or this one). */
  months: number;
};

export function monthIndex(month: string): number {
  const [year = 0, m = 1] = month.split('-').map(Number);

  return year * 12 + (m - 1);
}

/** The dated stints, the current ones first, then the most recent start first. */
export function byRecent<T extends Stint>(
  stints: T[],
  today: Date,
): DatedStint<T>[] {
  const now = today.getUTCFullYear() * 12 + today.getUTCMonth();

  return stints
    .filter((row) => /^\d{4}-\d{2}$/.test(row.startDate))
    .map((row) => {
      const last = row.current || !row.endDate ? now : monthIndex(row.endDate);

      return {
        ...row,
        months: Math.max(1, last - monthIndex(row.startDate) + 1),
      };
    })
    .sort(
      (a, b) =>
        Number(b.current) - Number(a.current) ||
        monthIndex(b.startDate) - monthIndex(a.startDate),
    );
}

/** A length in months as years and months, in the reader's language. */
export function spanLabel(months: number, locale: string): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = {
    ...(years ? { years } : {}),
    ...(rest || !years ? { months: rest || 1 } : {}),
  };

  // `Intl.DurationFormat` is newer than the TypeScript library this project targets.
  const Duration = (
    Intl as unknown as {
      DurationFormat?: new (
        locale: string,
        options: { style: string },
      ) => { format: (parts: object) => string };
    }
  ).DurationFormat;

  try {
    if (Duration) return new Duration(locale, { style: 'short' }).format(parts);
  } catch {
    // An unsupported locale: the plain form below.
  }

  return [years ? `${years} y` : '', rest ? `${rest} m` : '']
    .filter(Boolean)
    .join(' ');
}
