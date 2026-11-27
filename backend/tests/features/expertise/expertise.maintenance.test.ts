import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { connectOrSkip } from '../../support/mongo.js';

const ROOT = await mkdtemp(path.join(tmpdir(), 'portfolio-prune-expertise-'));
process.env.UPLOADS_DIR = ROOT;

const { ExpertiseModel } =
  await import('../../../src/features/expertise/expertise.model.js');
const { removeOrphanIcons } =
  await import('../../../src/features/expertise/expertise.maintenance.js');

/**
 * Reconciliation compares what is on disk with what the database points at, so
 * both have to be real. A mocked model would let this pass while deleting the
 * wrong files.
 */
const URI =
  process.env.EXPERTISE_MAINTENANCE_MONGO_URI ??
  'mongodb://127.0.0.1:27017/portfolio_expertise_maintenance_test';

const connected = await connectOrSkip('skill maintenance', URI);

const ICON_DIR = path.join(ROOT, 'expertise');

async function storeIcon(name: string) {
  await mkdir(ICON_DIR, { recursive: true });
  await writeFile(path.join(ICON_DIR, name), 'pretend image bytes');

  return `/uploads/expertise/${name}`;
}

async function storedNames() {
  try {
    return (await readdir(ICON_DIR)).sort();
  } catch {
    return [];
  }
}

async function saveRow(
  name: string,
  icon?: { kind: 'preset' | 'upload'; value: string },
  kind: 'skill' | 'technology' | 'tool' = 'technology',
) {
  await ExpertiseModel.collection.insertOne({
    kind,
    name: { en: name },
    category: 'other',
    level: 50,
    order: 0,
    ...(icon ? { icon } : {}),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe.skipIf(!connected)('removing orphaned logos', () => {
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await ExpertiseModel.collection.deleteMany({});
    await rm(ICON_DIR, { recursive: true, force: true });
  });

  // The cost of uploading before saving: a file the admin never committed to.
  it('deletes a logo no row points at', async () => {
    await storeIcon('icon-orphan.png');
    await saveRow('Kept', {
      kind: 'upload',
      value: await storeIcon('icon-used.png'),
    });

    expect(await removeOrphanIcons()).toEqual({ removed: 1, kept: 1 });
    expect(await storedNames()).toEqual(['icon-used.png']);
  });

  it('keeps a logo each of several rows is using', async () => {
    await saveRow('One', {
      kind: 'upload',
      value: await storeIcon('icon-one.png'),
    });
    await saveRow('Two', {
      kind: 'upload',
      value: await storeIcon('icon-two.png'),
    });
    await storeIcon('icon-orphan.png');

    expect(await removeOrphanIcons()).toEqual({ removed: 1, kept: 2 });
    expect(await storedNames()).toEqual(['icon-one.png', 'icon-two.png']);
  });

  /**
   * The rule that makes this category different from the other two: most rows
   * reference no file at all. A preset is a slug naming a vendored drawing -
   * it has no bytes on disk - and a skill has no logo by definition.
   */
  it('counts a preset as referencing no file', async () => {
    await storeIcon('icon-orphan.png');
    await saveRow('React', { kind: 'preset', value: 'react' });

    expect(await removeOrphanIcons()).toEqual({ removed: 1, kept: 0 });
    expect(await storedNames()).toEqual([]);
  });

  it('handles a row with no logo at all', async () => {
    await storeIcon('icon-orphan.png');
    await saveRow('Plain');

    expect(await removeOrphanIcons()).toEqual({ removed: 1, kept: 0 });
    expect(await storedNames()).toEqual([]);
  });

  /**
   * Presets and uploads live side by side in the same collection, and the
   * upload must survive the sweep the presets take part in.
   */
  it('keeps an uploaded logo among rows that use presets', async () => {
    const uploaded = await storeIcon('icon-custom.png');
    await saveRow('React', { kind: 'preset', value: 'react' });
    await saveRow('Laravel', { kind: 'preset', value: 'laravel' });
    await saveRow('Custom', { kind: 'upload', value: uploaded });
    await storeIcon('icon-abandoned.png');

    expect(await removeOrphanIcons()).toEqual({ removed: 1, kept: 1 });
    expect(await storedNames()).toEqual(['icon-custom.png']);
  });

  it('removes everything when nothing exists at all', async () => {
    await storeIcon('icon-a.png');
    await storeIcon('icon-b.png');

    expect(await removeOrphanIcons()).toEqual({ removed: 2, kept: 0 });
    expect(await storedNames()).toEqual([]);
  });

  it('does nothing when there is nothing stored', async () => {
    expect(await removeOrphanIcons()).toEqual({ removed: 0, kept: 0 });
  });

  it('is safe to run twice', async () => {
    await saveRow('Kept', {
      kind: 'upload',
      value: await storeIcon('icon-used.png'),
    });
    await storeIcon('icon-orphan.png');

    await removeOrphanIcons();

    expect(await removeOrphanIcons()).toEqual({ removed: 0, kept: 1 });
    expect(await storedNames()).toEqual(['icon-used.png']);
  });
});
