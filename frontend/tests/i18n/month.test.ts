import { describe, expect, it } from 'vitest';

import { monthAsDate, monthLabel, monthRange } from '../../src/i18n/month';

describe('a stored month', () => {
  /**
   * The bug this exists to refuse: `new Date('2021-03')` is midnight UTC on the
   * first, and formatting that anywhere west of Greenwich renders February.
   * Invisible to whoever wrote the code, permanent for the reader.
   */
  it('is read in UTC, not in the reader’s zone', () => {
    expect(monthAsDate('2021-03').toISOString()).toBe(
      '2021-03-01T00:00:00.000Z',
    );
    expect(monthLabel('2021-03', 'en')).toContain('2021');
    expect(monthLabel('2021-03', 'en')).toMatch(/Mar/);
  });

  it('is written in the reader’s language', () => {
    expect(monthLabel('2021-03', 'fr')).toMatch(/mars/i);
  });
});

describe('a period', () => {
  it('runs from one month to another', () => {
    expect(monthRange('2021-03', '2022-06', false, 'en', 'Present')).toBe(
      'Mar 2021 – Jun 2022',
    );
  });

  it('says the given word for one that has not ended', () => {
    expect(monthRange('2021-03', undefined, true, 'en', 'Present')).toBe(
      'Mar 2021 – Present',
    );
  });

  it('ignores a stored end date once the row says it is current', () => {
    expect(monthRange('2021-03', '2022-06', true, 'en', 'Present')).toBe(
      'Mar 2021 – Present',
    );
  });

  it('writes a single month once rather than twice', () => {
    expect(monthRange('2021-03', '2021-03', false, 'en', 'Present')).toBe(
      'Mar 2021',
    );
  });

  it('writes only the start when there is no end and it is not current', () => {
    expect(monthRange('2021-03', undefined, false, 'en', 'Present')).toBe(
      'Mar 2021',
    );
  });
});
