import { describe, expect, it } from 'vitest';

import { stripImageMetadata } from '../../../src/core/storage/strip-metadata.js';

/**
 * The files here are built byte by byte rather than loaded, so each test states
 * exactly what it is asserting about the format. A stripper that quietly
 * corrupts an image is worse than one that does nothing, so every case checks
 * that the parts which must survive did.
 */

function jpegSegment(marker: number, payload: Buffer) {
  const header = Buffer.from([0xff, marker, 0, 0]);
  header.writeUInt16BE(payload.length + 2, 2);

  return Buffer.concat([header, payload]);
}

const SOI = Buffer.from([0xff, 0xd8]);
const SCAN = Buffer.concat([
  Buffer.from([0xff, 0xda, 0x00, 0x03, 0x01]),
  Buffer.from([0x11, 0x22, 0x33]),
  Buffer.from([0xff, 0xd9]),
]);

const EXIF = jpegSegment(
  0xe1,
  Buffer.concat([
    Buffer.from('Exif\0\0', 'latin1'),
    // Where a phone would put the coordinates.
    Buffer.from('GPSLatitude 48.8584 GPSLongitude 2.2945', 'latin1'),
  ]),
);
const JFIF = jpegSegment(0xe0, Buffer.from('JFIF\0', 'latin1'));
const QUANTIZATION = jpegSegment(0xdb, Buffer.alloc(64, 0x10));
const COMMENT = jpegSegment(0xfe, Buffer.from('taken with a phone', 'latin1'));

describe('stripping a JPEG', () => {
  const original = Buffer.concat([
    SOI,
    JFIF,
    EXIF,
    QUANTIZATION,
    COMMENT,
    SCAN,
  ]);

  it('removes the EXIF segment and everything in it', () => {
    const stripped = stripImageMetadata(original, 'jpg');

    expect(stripped.includes(Buffer.from('GPSLatitude'))).toBe(false);
    expect(stripped.includes(Buffer.from('Exif\0\0', 'latin1'))).toBe(false);
    expect(original.includes(Buffer.from('GPSLatitude'))).toBe(true);
  });

  it('removes comments too', () => {
    const stripped = stripImageMetadata(original, 'jpg');

    expect(stripped.includes(Buffer.from('taken with a phone'))).toBe(false);
  });

  // Removing the wrong bytes would produce a file no decoder accepts.
  it('keeps the structure a decoder needs', () => {
    const stripped = stripImageMetadata(original, 'jpg');

    expect(stripped.subarray(0, 2)).toEqual(SOI);
    expect(stripped.subarray(-2)).toEqual(Buffer.from([0xff, 0xd9]));
    // JFIF, the quantization table and the scan all survive verbatim.
    expect(stripped.includes(JFIF)).toBe(true);
    expect(stripped.includes(QUANTIZATION)).toBe(true);
    expect(stripped.includes(SCAN)).toBe(true);
  });

  it('leaves a file with no metadata byte-for-byte identical', () => {
    const clean = Buffer.concat([SOI, JFIF, QUANTIZATION, SCAN]);

    expect(stripImageMetadata(clean, 'jpg').equals(clean)).toBe(true);
  });

  // Padding before a marker is legal and must not be read as a marker itself.
  it('handles fill bytes between segments', () => {
    const padded = Buffer.concat([
      SOI,
      JFIF,
      Buffer.from([0xff, 0xff]),
      EXIF,
      QUANTIZATION,
      SCAN,
    ]);

    const stripped = stripImageMetadata(padded, 'jpg');

    expect(stripped.includes(Buffer.from('GPSLatitude'))).toBe(false);
    expect(stripped.includes(QUANTIZATION)).toBe(true);
    expect(stripped.includes(SCAN)).toBe(true);
  });

  // A stripper is not a validator: the bytes were already accepted as an image.
  it('returns anything it cannot parse unchanged', () => {
    const nonsense = Buffer.from([0xff, 0xd8, 0x00, 0x01, 0x02, 0x03]);

    expect(stripImageMetadata(nonsense, 'jpg').equals(nonsense)).toBe(true);
  });
});

function pngChunk(type: string, payload: Buffer) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);

  return Buffer.concat([
    length,
    Buffer.from(type, 'ascii'),
    payload,
    // The CRC is not recomputed because no kept chunk is ever modified.
    Buffer.alloc(4, 0x7f),
  ]);
}

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

describe('stripping a PNG', () => {
  const header = pngChunk('IHDR', Buffer.alloc(13, 1));
  const data = pngChunk('IDAT', Buffer.from('compressed pixels'));
  const end = pngChunk('IEND', Buffer.alloc(0));
  const text = pngChunk('tEXt', Buffer.from('Comment\0taken in Paris'));
  const exif = pngChunk('eXIf', Buffer.from('GPSLatitude'));

  const original = Buffer.concat([
    PNG_SIGNATURE,
    header,
    text,
    exif,
    data,
    end,
  ]);

  it('removes the textual and EXIF chunks', () => {
    const stripped = stripImageMetadata(original, 'png');

    expect(stripped.includes(Buffer.from('taken in Paris'))).toBe(false);
    expect(stripped.includes(Buffer.from('GPSLatitude'))).toBe(false);
  });

  it('keeps the signature and the chunks that carry the image', () => {
    const stripped = stripImageMetadata(original, 'png');

    expect(stripped.subarray(0, 8)).toEqual(PNG_SIGNATURE);
    expect(stripped.includes(header)).toBe(true);
    expect(stripped.includes(data)).toBe(true);
    expect(stripped.includes(end)).toBe(true);
  });

  it('leaves a file with no metadata untouched', () => {
    const clean = Buffer.concat([PNG_SIGNATURE, header, data, end]);

    expect(stripImageMetadata(clean, 'png').equals(clean)).toBe(true);
  });
});

function webpChunk(type: string, payload: Buffer) {
  const size = Buffer.alloc(4);
  size.writeUInt32LE(payload.length);
  const padding = payload.length % 2 === 1 ? Buffer.alloc(1) : Buffer.alloc(0);

  return Buffer.concat([Buffer.from(type, 'ascii'), size, payload, padding]);
}

function webpFile(chunks: Buffer[]) {
  const body = Buffer.concat(chunks);
  const header = Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    Buffer.alloc(4),
    Buffer.from('WEBP', 'ascii'),
  ]);
  header.writeUInt32LE(body.length + 4, 4);

  return Buffer.concat([header, body]);
}

describe('stripping a WebP', () => {
  // Flags advertising both EXIF and XMP, as a camera would write them.
  const vp8x = webpChunk(
    'VP8X',
    Buffer.from([0x0c, 0, 0, 0, 0x10, 0, 0, 0x10, 0, 0]),
  );
  const pixels = webpChunk('VP8 ', Buffer.from('compressed pixels'));
  const exif = webpChunk('EXIF', Buffer.from('GPSLatitude 48.8584'));
  const original = webpFile([vp8x, pixels, exif]);

  it('removes the EXIF chunk', () => {
    const stripped = stripImageMetadata(original, 'webp');

    expect(stripped.includes(Buffer.from('GPSLatitude'))).toBe(false);
    expect(stripped.includes(Buffer.from('compressed pixels'))).toBe(true);
  });

  // A flag claiming EXIF that is no longer there makes the file inconsistent.
  it('stops advertising the metadata it removed', () => {
    const stripped = stripImageMetadata(original, 'webp');
    const flags = stripped[WEBP_FLAGS_OFFSET];

    expect(flags).toBeDefined();
    expect(flags! & 0x08).toBe(0);
    expect(flags! & 0x04).toBe(0);
  });

  it('rewrites the RIFF length to match what is left', () => {
    const stripped = stripImageMetadata(original, 'webp');

    expect(stripped.readUInt32LE(4)).toBe(stripped.length - 8);
  });

  it('leaves a file with no metadata untouched', () => {
    const clean = webpFile([pixels]);

    expect(stripImageMetadata(clean, 'webp').equals(clean)).toBe(true);
  });
});

/** RIFF header (12) + chunk header (8) + first payload byte. */
const WEBP_FLAGS_OFFSET = 20;
