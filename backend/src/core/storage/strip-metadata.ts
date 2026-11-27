import type { ImageExtension } from './storage.types.js';

/**
 * Removes camera metadata - EXIF above all, which carries GPS - from publicly
 * served images. By hand, without re-encoding the pixels or a native
 * dependency; anything that does not parse is returned unchanged.
 */

/** APP1–APP15 hold EXIF, XMP and friends; COM holds comments. APP0 is JFIF. */
const JPEG_DROPPED = new Set([
  0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xeb, 0xec, 0xed,
  0xee, 0xef, 0xfe,
]);

const JPEG_START_OF_SCAN = 0xda;
const JPEG_END_OF_IMAGE = 0xd9;

function stripJpeg(bytes: Buffer): Buffer {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return bytes;
  }

  const kept: Buffer[] = [bytes.subarray(0, 2)];
  let at = 2;

  while (at + 1 < bytes.length) {
    if (bytes[at] !== 0xff) {
      // Not a marker boundary: stop interpreting and keep the remainder.
      break;
    }

    const marker = bytes[at + 1];

    if (marker === undefined) {
      break;
    }

    // Any number of 0xFF fill bytes may precede a marker; they are padding,
    // not a marker of their own.
    if (marker === 0xff) {
      kept.push(bytes.subarray(at, at + 1));
      at += 1;
      continue;
    }

    // Everything from the scan onwards is entropy-coded data, not segments.
    if (marker === JPEG_START_OF_SCAN || marker === JPEG_END_OF_IMAGE) {
      break;
    }

    // Standalone markers carry no length field.
    if ((marker >= 0xd0 && marker <= 0xd8) || marker === 0x01) {
      kept.push(bytes.subarray(at, at + 2));
      at += 2;
      continue;
    }

    if (at + 4 > bytes.length) {
      break;
    }

    const length = bytes.readUInt16BE(at + 2);
    const end = at + 2 + length;

    if (length < 2 || end > bytes.length) {
      break;
    }

    if (!JPEG_DROPPED.has(marker)) {
      kept.push(bytes.subarray(at, end));
    }

    at = end;
  }

  kept.push(bytes.subarray(at));

  return Buffer.concat(kept);
}

/** Textual and timestamp chunks; everything else is needed to decode. */
const PNG_DROPPED = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);

const PNG_HEADER_LENGTH = 8;
const PNG_CHUNK_OVERHEAD = 12;

function stripPng(bytes: Buffer): Buffer {
  if (bytes.length < PNG_HEADER_LENGTH) {
    return bytes;
  }

  const kept: Buffer[] = [bytes.subarray(0, PNG_HEADER_LENGTH)];
  let at = PNG_HEADER_LENGTH;

  while (at + PNG_CHUNK_OVERHEAD <= bytes.length) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.subarray(at + 4, at + 8).toString('ascii');
    const end = at + PNG_CHUNK_OVERHEAD + length;

    if (end > bytes.length) {
      break;
    }

    if (!PNG_DROPPED.has(type)) {
      kept.push(bytes.subarray(at, end));
    }

    at = end;
  }

  kept.push(bytes.subarray(at));

  return Buffer.concat(kept);
}

const WEBP_DROPPED = new Set(['EXIF', 'XMP ']);
const WEBP_HEADER_LENGTH = 12;

/** In the VP8X flags byte: EXIF present, XMP present. */
const VP8X_EXIF_FLAG = 0x08;
const VP8X_XMP_FLAG = 0x04;

function stripWebp(bytes: Buffer): Buffer {
  if (
    bytes.length < WEBP_HEADER_LENGTH ||
    bytes.subarray(0, 4).toString('ascii') !== 'RIFF' ||
    bytes.subarray(8, 12).toString('ascii') !== 'WEBP'
  ) {
    return bytes;
  }

  const kept: Buffer[] = [];
  let at = WEBP_HEADER_LENGTH;
  let removed = false;

  while (at + 8 <= bytes.length) {
    const type = bytes.subarray(at, at + 4).toString('ascii');
    const length = bytes.readUInt32LE(at + 4);
    // Chunks are padded to an even length.
    const end = at + 8 + length + (length % 2);

    if (end > bytes.length) {
      break;
    }

    if (WEBP_DROPPED.has(type)) {
      removed = true;
    } else {
      const chunk = Buffer.from(bytes.subarray(at, end));

      // The flags must stop advertising what is no longer there.
      if (type === 'VP8X' && length >= 1) {
        const flags = chunk[8];

        if (flags !== undefined) {
          chunk[8] = flags & ~VP8X_EXIF_FLAG & ~VP8X_XMP_FLAG;
        }
      }

      kept.push(chunk);
    }

    at = end;
  }

  if (!removed) {
    return bytes;
  }

  const body = Buffer.concat([...kept, bytes.subarray(at)]);
  const header = Buffer.from(bytes.subarray(0, WEBP_HEADER_LENGTH));
  header.writeUInt32LE(body.length + 4, 4);

  return Buffer.concat([header, body]);
}

const STRIPPERS: Record<ImageExtension, (bytes: Buffer) => Buffer> = {
  jpg: stripJpeg,
  png: stripPng,
  webp: stripWebp,
};

export function stripImageMetadata(
  bytes: Buffer,
  extension: ImageExtension,
): Buffer {
  return STRIPPERS[extension](bytes);
}
