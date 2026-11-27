import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { STORAGE_CATEGORIES } from '../../../src/core/storage/storage.types.js';

// The service resolves its root once, at import; point it somewhere disposable
// before that happens.
const ROOT = await mkdtemp(path.join(tmpdir(), 'portfolio-unowned-'));
process.env.UPLOADS_DIR = ROOT;

const { unownedDirectories } =
  await import('../../../src/core/storage/storage.service.js');

async function directory(name: string) {
  await mkdir(path.join(ROOT, name), { recursive: true });
}

/**
 * Every sweep reconciles one category, so a directory belonging to no category
 * is read by nothing: its files cannot be reported, cannot be pruned, and stay
 * until somebody looks at the volume by hand. `skill` became one when skills,
 * technologies and tools were separated, and two logos sat in it for a month.
 */
describe('unownedDirectories', () => {
  afterEach(async () => {
    await rm(ROOT, { recursive: true, force: true });
  });

  /** The ordinary state of a machine where nothing has been uploaded yet. */
  it('owns nothing when the root does not exist', async () => {
    await rm(ROOT, { recursive: true, force: true });

    await expect(unownedDirectories()).resolves.toEqual([]);
  });

  it('says nothing about the categories that are declared', async () => {
    for (const category of STORAGE_CATEGORIES) {
      await directory(category);
    }

    await expect(unownedDirectories()).resolves.toEqual([]);
  });

  it('names a directory no category owns', async () => {
    await directory('profile');
    await directory('skill');

    await expect(unownedDirectories()).resolves.toEqual(['skill']);
  });

  /** A file beside the categories is not a category. */
  it('ignores anything that is not a directory', async () => {
    await mkdir(ROOT, { recursive: true });
    await writeFile(path.join(ROOT, 'notes.txt'), 'not a category');

    await expect(unownedDirectories()).resolves.toEqual([]);
  });
});
