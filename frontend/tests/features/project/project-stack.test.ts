import { describe, expect, it } from 'vitest';

import type { Expertise } from '../../../src/features/expertise/expertise-api';
import {
  expertiseIndex,
  projectStack,
} from '../../../src/features/project/project-stack';

function row(id: string, kind: Expertise['kind']): Expertise {
  return {
    id,
    kind,
    name: { en: id },
    category: 'general',
    level: 50,
    order: 0,
    updatedAt: '',
  };
}

describe('a project’s stack', () => {
  const index = expertiseIndex([
    [row('s1', 'skill')],
    [row('t1', 'technology'), row('t2', 'technology')],
    [row('o1', 'tool')],
  ]);

  it('resolves references across all three kinds', () => {
    expect(projectStack(['t1', 's1', 'o1'], index).map((r) => r.id)).toEqual([
      't1',
      's1',
      'o1',
    ]);
  });

  it('keeps the order the project saved, not the order of the lists', () => {
    expect(projectStack(['t2', 't1'], index).map((r) => r.id)).toEqual([
      't2',
      't1',
    ]);
  });

  it('drops a reference whose row has been deleted', () => {
    expect(projectStack(['t1', 'gone'], index).map((r) => r.id)).toEqual([
      't1',
    ]);
  });
});
