import { describe, expect, it } from 'vitest';

import {
  currentMonth,
  hasExpired,
} from '../../../src/features/credential/credential-validity';

/** A fixed "now", so these assert the rule rather than the day they run on. */
const NOW = new Date('2026-04-15T12:00:00.000Z');

describe('hasExpired', () => {
  it('says no when there is no expiry at all', () => {
    // An absent expiry means "does not expire" here - unlike an absent end
    // date on a period, which means "still under way".
    expect(hasExpired(undefined, NOW)).toBe(false);
  });

  it('says no for an expiry still ahead', () => {
    expect(hasExpired('2027-01', NOW)).toBe(false);
  });

  /** A certificate valid until April 2026 is valid *during* April 2026. */
  it('says no during the month it expires in', () => {
    expect(hasExpired('2026-04', NOW)).toBe(false);
  });

  it('says yes the month after', () => {
    expect(hasExpired('2026-03', NOW)).toBe(true);
  });

  it('compares across a year boundary, since the strings are chronological', () => {
    expect(hasExpired('2025-12', NOW)).toBe(true);
    expect(hasExpired('2026-12', NOW)).toBe(false);
  });
});

describe('currentMonth', () => {
  it('is padded to two digits, so it sorts as it reads', () => {
    expect(currentMonth(new Date('2026-01-05T00:00:00.000Z'))).toBe('2026-01');
  });

  /**
   * UTC, for the reason a stored month is rendered in UTC: on the first of the
   * month a reader at a negative offset is still in the previous one locally,
   * and a credential would read as expired a day early for them.
   */
  it('is read in UTC rather than the local zone', () => {
    // 23:30 UTC on the last day of March is still March, though it is already
    // April in Tokyo and still March in Los Angeles.
    expect(currentMonth(new Date('2026-03-31T23:30:00.000Z'))).toBe('2026-03');
    expect(currentMonth(new Date('2026-04-01T00:30:00.000Z'))).toBe('2026-04');
  });
});
