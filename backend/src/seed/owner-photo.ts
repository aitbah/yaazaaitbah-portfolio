import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { detectImageExtension } from '../core/storage/image-signature.js';
import { stripImageMetadata } from '../core/storage/strip-metadata.js';
import {
  MAX_IMAGE_BYTES,
  type ImageExtension,
} from '../core/storage/storage.types.js';

/**
 * Where the owner's photograph is looked for: `private/`, which Git ignores so
 * the photo is never in the history. Resolved from this file, so it is the same
 * place on the host and in the container.
 */
export const OWNER_PHOTO_PATH = fileURLToPath(
  new URL('../../../private/profile-photo.png', import.meta.url),
);

export type OwnerPhoto = { bytes: Buffer; extension: ImageExtension };

/**
 * The same checks an upload gets: the bytes decide the type, the size limit
 * applies, and camera metadata is stripped. An unusable file stops the seed
 * rather than silently falling back to the placeholder.
 */
export function preparePhoto(bytes: Buffer): OwnerPhoto {
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new Error(
      `The photograph in private/ is ${bytes.length} bytes; an uploaded image may be at most ${MAX_IMAGE_BYTES}.`,
    );
  }

  const extension = detectImageExtension(bytes);

  if (!extension) {
    throw new Error(
      'The photograph in private/ is not a PNG, JPEG or WebP image.',
    );
  }

  return { bytes: stripImageMetadata(bytes, extension), extension };
}

/** The prepared photograph, or `null` when there is none - as on a clean checkout, and in CI. */
export async function readOwnerPhoto(
  file = OWNER_PHOTO_PATH,
): Promise<OwnerPhoto | null> {
  let bytes: Buffer;

  try {
    bytes = await readFile(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    throw error;
  }

  return preparePhoto(bytes);
}
