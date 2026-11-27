import { describe, expect, it } from 'vitest';

import { coverRadius, ease } from '../../../../src/features/site/motion/spill';

describe('the theme’s circle', () => {
  it('reaches the farthest corner from the switch, wherever it is', () => {
    // From the top end corner, the far corner is the bottom start.
    expect(coverRadius(1400, 30, 1440, 900)).toBeCloseTo(
      Math.hypot(1400, 870) + 4,
    );
    // From the middle, every corner is as far.
    expect(coverRadius(720, 450, 1440, 900)).toBeCloseTo(
      Math.hypot(720, 450) + 4,
    );
  });

  it('grows from nothing to all of it, gently at both ends', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5);
    expect(ease(0.1)).toBeLessThan(0.1);
    expect(ease(0.9)).toBeGreaterThan(0.9);
  });
});
