import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { crc32 } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';

import { MAX_IMAGE_BYTES } from '../../src/core/storage/storage.types.js';
import { placeholderPng } from '../../src/seed/placeholder-image.js';
import { preparePhoto, readOwnerPhoto } from '../../src/seed/owner-photo.js';

/** A PNG chunk, with its length and checksum. */
function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typed));

  return Buffer.concat([length, typed, checksum]);
}

/** A real PNG with an `eXIf` chunk after its header, as the owner's photograph has. */
function photographWithExif(): { png: Buffer; exif: Buffer } {
  const plain = placeholderPng({
    width: 8,
    height: 8,
    seed: 'owner',
    index: 0,
  });
  // Signature (8) + IHDR (4 length + 4 type + 13 data + 4 CRC).
  const afterHeader = 8 + 25;
  const exif = chunk('eXIf', Buffer.from('MM\0*GPS 33.57N 7.59W'));

  return {
    png: Buffer.concat([
      plain.subarray(0, afterHeader),
      exif,
      plain.subarray(afterHeader),
    ]),
    exif,
  };
}

let directory: string | undefined;

afterEach(async () => {
  if (directory) {
    await rm(directory, { recursive: true, force: true });
    directory = undefined;
  }
});

describe('the owner photograph', () => {
  it('keeps the image and removes the camera metadata', () => {
    const { png, exif } = photographWithExif();

    const photo = preparePhoto(png);

    expect(photo.extension).toBe('png');
    expect(photo.bytes.includes(Buffer.from('eXIf'))).toBe(false);
    expect(photo.bytes.includes(Buffer.from('GPS'))).toBe(false);
    // Only the metadata went: every other byte is the image as it was.
    expect(photo.bytes.length).toBe(png.length - exif.length);
  });

  it('refuses a file that is not an image, whatever it is called', () => {
    expect(() =>
      preparePhoto(Buffer.from('%PDF-1.4 not a photograph')),
    ).toThrow(/not a PNG, JPEG or WebP/);
  });

  it('refuses a file larger than an upload may be', () => {
    const { png } = photographWithExif();
    const oversized = Buffer.concat([png, Buffer.alloc(MAX_IMAGE_BYTES)]);

    expect(() => preparePhoto(oversized)).toThrow(/at most/);
  });

  it('answers with nothing when there is no photograph, as on a clean checkout', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'owner-photo-'));

    await expect(
      readOwnerPhoto(path.join(directory, 'profile-photo.png')),
    ).resolves.toBeNull();
  });

  it('reads and prepares a photograph that is there', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'owner-photo-'));
    const file = path.join(directory, 'profile-photo.png');
    await writeFile(file, photographWithExif().png);

    const photo = await readOwnerPhoto(file);

    expect(photo?.extension).toBe('png');
    expect(photo?.bytes.includes(Buffer.from('eXIf'))).toBe(false);
  });
});
