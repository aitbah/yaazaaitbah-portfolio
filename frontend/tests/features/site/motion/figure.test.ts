import { describe, expect, it } from 'vitest';

import {
  DEFAULT_HEAD,
  readFigure,
} from '../../../../src/features/site/motion/figure';

/** A 40 × 60 cutout: a pale head on a transparent ground, a black shirt to the bottom edge. */
function portrait(transparent = true) {
  const w = 40;
  const h = 60;
  const pixels = new Uint8ClampedArray(w * h * 4);

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const head = y >= 4 && y < 22 && x >= 14 && x < 26;
      const neck = y >= 22 && y < 26 && x >= 17 && x < 23;
      const shirt = y >= 26 && x >= 4 && x < 36;
      const skin = head || neck;

      pixels[i] = skin ? 220 : shirt ? 10 : 240;
      pixels[i + 1] = skin ? 180 : shirt ? 10 : 240;
      pixels[i + 2] = skin ? 150 : shirt ? 10 : 240;
      pixels[i + 3] = transparent && !skin && !shirt ? 0 : 255;
    }
  }

  return { pixels, w, h };
}

describe('reading the portrait', () => {
  it('finds a cutout’s head', () => {
    const { pixels, w, h } = portrait();
    const read = readFigure(pixels, w, h);

    expect(read.cut).toBe(true);
    expect(read.head.top).toBeCloseTo(4 / 60, 2);
    expect(read.head.cx).toBeCloseTo(0.5, 1);
    expect(read.head.neck).toBeGreaterThan(0.33);
    expect(read.head.neck).toBeLessThan(0.45);
  });

  it('takes a photograph with its backdrop as uncut, the head where portraits put it', () => {
    const { pixels, w, h } = portrait(false);
    const read = readFigure(pixels, w, h);

    expect(read.cut).toBe(false);
    expect(read.head).toEqual(DEFAULT_HEAD);
  });
});
