import type { Expertise } from '@/features/expertise/expertise-api';

export type ExpertiseGroup = { category: string; rows: Expertise[] };

/**
 * One kind's rows grouped by category, in the admin's order: a category comes
 * where its first row does, and its rows keep their own order within it.
 */
export function groupByCategory(rows: Expertise[]): ExpertiseGroup[] {
  const groups = new Map<string, Expertise[]>();

  for (const row of [...rows].sort((a, b) => a.order - b.order)) {
    const group = groups.get(row.category);

    if (group) {
      group.push(row);
    } else {
      groups.set(row.category, [row]);
    }
  }

  return [...groups].map(([category, grouped]) => ({
    category,
    rows: grouped,
  }));
}
