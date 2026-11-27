import { crc32, inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { detectImageExtension } from '../../src/core/storage/image-signature.js';
import { placeholderPng } from '../../src/seed/placeholder-image.js';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Walks the chunk structure, checking each CRC on the way.
 *
 * The encoder is written by hand, so "it produced some bytes" is not evidence
 * of anything - a decoder rejects a wrong length or a wrong checksum, and that
 * is precisely the kind of mistake hand-written binary output makes.
 */
function chunksOf(png: Buffer) {
  expect(png.subarray(0, 8)).toEqual(SIGNATURE);

  const chunks: { type: string; data: Buffer }[] = [];
  let offset = 8;

  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString('ascii');
    const data = png.subarray(offset + 8, offset + 8 + length);
    const declared = png.readUInt32BE(offset + 8 + length);

    expect(crc32(png.subarray(offset + 4, offset + 8 + length))).toBe(declared);

    chunks.push({ type, data });
    offset += 12 + length;
  }

  expect(offset).toBe(png.length);

  return chunks;
}

describe('the encoded file', () => {
  it('is a PNG a decoder would accept', () => {
    const png = placeholderPng({ width: 24, height: 16, seed: 'a project' });
    const chunks = chunksOf(png);

    expect(chunks.map((c) => c.type)).toEqual(['IHDR', 'IDAT', 'IEND']);
  });

  it('declares the size it was asked for, as 8-bit truecolour', () => {
    const png = placeholderPng({ width: 24, height: 16, seed: 'a project' });
    const [header] = chunksOf(png);

    expect(header?.data.readUInt32BE(0)).toBe(24);
    expect(header?.data.readUInt32BE(4)).toBe(16);
    // Depth 8, colour type 2, and no interlacing: what the scanlines below are.
    expect([...(header?.data.subarray(8) ?? [])]).toEqual([8, 2, 0, 0, 0]);
  });

  /**
   * The one check that proves the pixel data is the right shape: a truecolour
   * scanline is a filter byte plus three bytes per pixel, and a decoder reading
   * anything else walks off the end of the image.
   */
  it('carries exactly one filtered scanline per row', () => {
    const width = 9;
    const height = 7;
    const png = placeholderPng({ width, height, seed: 'a project' });
    const idat = chunksOf(png).find((c) => c.type === 'IDAT');

    const raw = inflateSync(idat!.data);

    expect(raw).toHaveLength(height * (1 + width * 3));

    for (let row = 0; row < height; row += 1) {
      // Filter 0 (none) - the only one this encoder writes.
      expect(raw[row * (1 + width * 3)]).toBe(0);
    }
  });

  // The seeder writes these through the same pipeline every upload uses.
  it('is recognised by the app’s own signature check', () => {
    expect(
      detectImageExtension(placeholderPng({ width: 4, height: 4, seed: 'x' })),
    ).toBe('png');
  });
});

describe('choosing the picture', () => {
  /**
   * The whole point of generating rather than downloading: a re-run overwrites
   * each file with identical bytes instead of leaving a new one behind.
   */
  it('draws the same image for the same seed, every time', () => {
    const options = { width: 16, height: 16, seed: 'Inventory API', index: 2 };

    expect(placeholderPng(options)).toEqual(placeholderPng(options));
  });

  it('draws a different image for a different seed', () => {
    const first = placeholderPng({ width: 16, height: 16, seed: 'one' });
    const second = placeholderPng({ width: 16, height: 16, seed: 'two' });

    expect(first).not.toEqual(second);
  });

  /**
   * Hashing the text alone clustered: several project names landed on
   * neighbouring purples, which is the one thing a set of placeholders must not
   * do. Stepping by the golden angle is what separates them, so neighbouring
   * positions must not come out alike.
   */
  it('separates neighbours in a set even when the seed is identical', () => {
    const first = placeholderPng({
      width: 16,
      height: 16,
      seed: 's',
      index: 0,
    });
    const second = placeholderPng({
      width: 16,
      height: 16,
      seed: 's',
      index: 1,
    });

    expect(first).not.toEqual(second);
  });
});
