import { describe, expect, it } from 'vitest';

import {
  byRecent,
  monthIndex,
  spanLabel,
} from '../../../src/features/site/path-timeline';

const TODAY = new Date('2026-10-13T12:00:00Z');

describe('the path, most recent first', () => {
  it('is nothing without a dated stint', () => {
    expect(byRecent([{ startDate: '', current: false }], TODAY)).toEqual([]);
  });

  it('leads with what is current, then the latest start', () => {
    const rows = byRecent(
      [
        { id: 'a', startDate: '2022-09', endDate: '2023-07', current: false },
        { id: 'b', startDate: '2026-07', current: true },
        { id: 'c', startDate: '2025-09', endDate: '2026-07', current: false },
      ],
      TODAY,
    );

    expect(rows.map((row) => row.id)).toEqual(['b', 'c', 'a']);
  });

  it('counts a stint’s months, both ends included, through today while it runs', () => {
    const [current, past] = byRecent(
      [
        { startDate: '2026-07', current: true },
        { startDate: '2022-09', endDate: '2023-07', current: false },
      ],
      TODAY,
    );

    // July to October 2026.
    expect(current?.months).toBe(4);
    // September 2022 to July 2023.
    expect(past?.months).toBe(11);
  });

  it('reads YYYY-MM as an absolute month', () => {
    expect(monthIndex('2026-01') - monthIndex('2025-12')).toBe(1);
  });

  it('says a span in the reader’s language', () => {
    expect(spanLabel(14, 'en')).toMatch(/1.*2/);
    expect(spanLabel(3, 'fr')).toMatch(/3/);
  });
});
