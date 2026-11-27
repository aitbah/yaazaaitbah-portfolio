import { randomUUID } from 'node:crypto';
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { env } from '../../config/env.js';
import { logger } from '../logging/logger.js';
import { stripImageMetadata } from './strip-metadata.js';
import {
  DOCUMENT_EXTENSIONS,
  IMAGE_EXTENSIONS,
  STORAGE_CATEGORIES,
  UPLOADS_URL_PREFIX,
  type ImageExtension,
  type StorageCategory,
  type StoredExtension,
} from './storage.types.js';

const ROOT = path.resolve(env.UPLOADS_DIR);

/**
 * Exactly the shape this service produces. Nothing else resolves to a path, so
 * a reference cannot name a file we did not write - traversal included, since
 * neither segment allows a dot or a slash.
 */
const MANAGED_REFERENCE = new RegExp(
  `^${UPLOADS_URL_PREFIX}/[a-z0-9-]+/[A-Za-z0-9-]+\\.(${[
    ...IMAGE_EXTENSIONS,
    ...DOCUMENT_EXTENSIONS,
  ].join('|')})$`,
);

/** True for a path this service owns; false for an external URL or anything else. */
export function isManagedReference(reference: string): boolean {
  return MANAGED_REFERENCE.test(reference);
}

function resolveManaged(reference: string): string | null {
  if (!isManagedReference(reference)) {
    return null;
  }

  const relative = reference.slice(UPLOADS_URL_PREFIX.length + 1);
  const target = path.resolve(ROOT, relative);

  // Belt and braces: the shape above already forbids escaping the root.
  return target.startsWith(ROOT + path.sep) ? target : null;
}

/**
 * Writes a file and returns the reference to persist - relative, so the same
 * document stays valid in every environment. The extension comes from the
 * caller's inspection of the bytes, never from a client filename, and the
 * image's own metadata is removed on the way in.
 */
export async function saveImage(
  category: StorageCategory,
  name: string,
  bytes: Buffer,
  extension: ImageExtension,
): Promise<string> {
  // Uploads are served publicly, so the camera metadata goes no further.
  return write(category, name, stripImageMetadata(bytes, extension), extension);
}

/**
 * The same, for a document.
 *
 * Nothing is stripped, because nothing here parses a PDF: doing so would mean
 * adding a parser - an attack surface - to inspect a file the application never
 * renders. It is served as an attachment instead, which is what makes that
 * safe; see `ATTACHMENT_CATEGORIES`.
 */
export async function saveDocument(
  category: StorageCategory,
  name: string,
  bytes: Buffer,
  extension: StoredExtension,
): Promise<string> {
  return write(category, name, bytes, extension);
}

async function write(
  category: StorageCategory,
  name: string,
  bytes: Buffer,
  extension: StoredExtension,
): Promise<string> {
  const filename = `${name}-${randomUUID()}.${extension}`;
  const directory = path.join(ROOT, category);

  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), bytes);

  return `${UPLOADS_URL_PREFIX}/${category}/${filename}`;
}

/**
 * Deletes a file this service owns. Anything else - an external URL above all -
 * is left alone, and a file already gone is not an error worth raising: the
 * caller's real work is the database write it accompanies.
 */
export async function deleteManagedFile(reference: string): Promise<void> {
  const target = resolveManaged(reference);

  if (!target) {
    return;
  }

  try {
    await unlink(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn({ reference }, 'Could not delete a managed upload');
    }
  }
}

/**
 * Every file currently stored in one category, as references. A feature can
 * compare this with what it still points at to find what nothing references -
 * an upload that was never saved leaves exactly that.
 */
export async function listStoredReferences(
  category: StorageCategory,
): Promise<string[]> {
  try {
    const names = await readdir(path.join(ROOT, category));

    return names
      .map((name) => `${UPLOADS_URL_PREFIX}/${category}/${name}`)
      .filter(isManagedReference);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

/**
 * Directories under the uploads root that belong to no category - left behind
 * when a feature stops storing files. Reported only: what the application does
 * not understand, it does not delete.
 */
export async function unownedDirectories(): Promise<string[]> {
  const owned = new Set<string>(STORAGE_CATEGORIES);

  try {
    const entries = await readdir(ROOT, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isDirectory() && !owned.has(entry.name))
      .map((entry) => entry.name);
  } catch (error) {
    // Nothing has been uploaded yet: an empty root owns nothing either.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

/** Where the files live, for the static route that serves them. */
export const UPLOADS_ROOT = ROOT;
