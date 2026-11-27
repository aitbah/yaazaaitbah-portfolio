import { describe, expect, it } from 'vitest';

import type { Expertise } from '../../../src/features/expertise/expertise-api';
import { groupByCategory } from '../../../src/features/site/expertise-groups';

const row = (id: string, category: string, order: number) =>
  ({ id, category, order }) as Expertise;

describe('expertise grouped by category', () => {
  it('keeps the admin’s order: a category comes where its first row does', () => {
    const groups = groupByCategory([
      row('c', 'backend', 2),
      row('a', 'frontend', 0),
      row('b', 'backend', 1),
      row('d', 'frontend', 3),
    ]);

    expect(groups.map((group) => group.category)).toEqual([
      'frontend',
      'backend',
    ]);
    expect(groups.map((group) => group.rows.map((r) => r.id))).toEqual([
      ['a', 'd'],
      ['b', 'c'],
    ]);
  });

  it('is empty for no rows', () => {
    expect(groupByCategory([])).toEqual([]);
  });
});
