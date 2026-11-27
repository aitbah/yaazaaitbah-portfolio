/**
 * The current month as `YYYY-MM`, in UTC.
 *
 * UTC for the same reason a stored month is formatted in UTC: on the first of
 * the month, a reader at a negative offset is still in the previous one
 * locally, and a credential would read as expired a day early for them and
 * never for whoever wrote the code.
 */
export function currentMonth(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = `${now.getUTCMonth() + 1}`.padStart(2, '0');

  return `${year}-${month}`;
}

/**
 * Whether a credential has expired. No expiry means it never does; the month it
 * expires in still counts as valid.
 */
export function hasExpired(
  expiresAt: string | undefined,
  now: Date = new Date(),
): boolean {
  return expiresAt !== undefined && expiresAt < currentMonth(now);
}
