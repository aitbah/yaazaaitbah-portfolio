import { crc32, deflateSync } from 'node:zlib';

/**
 * Draws a placeholder PNG in memory, without an image library or the network:
 * generated from the seed text, so each project gets the same picture every
 * run. Abstract shapes and hues, since there is no font to draw a label.
 */

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typed));

  return Buffer.concat([length, typed, checksum]);
}

/** A stable number from a string, so the same seed always draws the same image. */
function hashOf(seed: string): number {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

type Rgb = [number, number, number];

/**
 * HSL to RGB, restricted to the saturations and lightnesses used here. Chosen
 * over picking RGB directly because two random RGB values are often two shades
 * of mud, whereas two hues are always visibly different.
 */
function fromHue(hue: number, saturation: number, lightness: number): Rgb {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const secondary = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = lightness - chroma / 2;

  const [r, g, b] = (
    [
      [chroma, secondary, 0],
      [secondary, chroma, 0],
      [0, chroma, secondary],
      [0, secondary, chroma],
      [secondary, 0, chroma],
      [chroma, 0, secondary],
    ] as Rgb[]
  )[Math.floor(hue / 60) % 6] as Rgb;

  return [
    Math.round((r + match) * 255),
    Math.round((g + match) * 255),
    Math.round((b + match) * 255),
  ];
}

export type PlaceholderOptions = {
  width: number;
  height: number;
  /** Same text, same picture - every run and every machine. */
  seed: string;
  /**
   * Position in the set, when the image belongs to one: stepping the hue by the
   * golden angle spreads a set evenly, where hashing alone clustered them.
   */
  index?: number;
};

/** Successive multiples never revisit a hue until the wheel is full. */
const GOLDEN_ANGLE = 137.508;

export function placeholderPng({
  width,
  height,
  seed,
  index,
}: PlaceholderOptions): Buffer {
  const hash = hashOf(seed);

  const hue =
    index === undefined
      ? hash % 360
      : (index * GOLDEN_ANGLE + (hash % 24)) % 360;

  // A second hue a little way round the wheel: close enough to read as one
  // image, far enough for the gradient to be visible.
  const partner = (hue + 40 + (hash % 40)) % 360;

  const from = fromHue(hue, 0.55, 0.42);
  const to = fromHue(partner, 0.5, 0.68);
  // Analogous and lighter, not complementary. Blending a colour with its
  // opposite passes through grey, and every shape drawn that way came out the
  // same olive regardless of the hue it started from.
  const accent = fromHue((hue + 25) % 360, 0.62, 0.78);

  // A disc and a diagonal band, both placed and sized from the seed, so two
  // images of the same size are recognisably two images.
  const discX = 0.25 + ((hash >>> 8) % 50) / 100;
  const discY = 0.25 + ((hash >>> 14) % 50) / 100;
  const discRadius = 0.18 + ((hash >>> 20) % 18) / 100;
  const bandOffset = ((hash >>> 4) % 60) / 100;
  const bandWidth = 0.05 + ((hash >>> 11) % 8) / 100;

  // One filter byte per row, then RGB triples: the simplest encoding a PNG
  // decoder accepts, and gradients deflate well enough that nothing more is
  // worth the complexity.
  const raw = Buffer.alloc(height * (1 + width * 3));
  let offset = 0;

  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0;
    offset += 1;

    for (let x = 0; x < width; x += 1) {
      // Diagonal, so neither a portrait nor a wide crop looks like a flat band.
      const along = (x / width + y / height) / 2;

      // Darker towards the edges, so a light image still shows its own bounds.
      const edge =
        Math.min(x, width - x) / width + Math.min(y, height - y) / height;
      const vignette = 0.85 + Math.min(edge * 1.6, 0.15);

      // Normalised so the shapes keep their proportions whatever the crop.
      const u = x / width;
      const v = y / height;

      const toDisc = Math.hypot(u - discX, v - discY);
      // Soft edge rather than a hard circle: a jagged one would read as an
      // artefact of the encoder rather than part of the picture.
      const disc = 1 - Math.min(Math.max((toDisc - discRadius) / 0.12, 0), 1);

      const alongBand = Math.abs(((u + v) / 2 - bandOffset) % 0.5);
      const band = 1 - Math.min(Math.max((alongBand - bandWidth) / 0.04, 0), 1);

      const accentWeight = Math.min(disc * 0.35 + band * 0.14, 0.45);

      for (let channel = 0; channel < 3; channel += 1) {
        const base =
          (from[channel] ?? 0) * (1 - along) + (to[channel] ?? 0) * along;

        const value =
          (base * (1 - accentWeight) + (accent[channel] ?? 0) * accentWeight) *
          vignette;

        raw[offset] = Math.max(0, Math.min(255, Math.round(value)));
        offset += 1;
      }
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolour RGB
  header[10] = 0; // deflate
  header[11] = 0; // adaptive filtering
  header[12] = 0; // no interlace

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
