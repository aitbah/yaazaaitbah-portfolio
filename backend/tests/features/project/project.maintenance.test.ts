import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { connectOrSkip } from '../../support/mongo.js';

const ROOT = await mkdtemp(path.join(tmpdir(), 'portfolio-prune-project-'));
process.env.UPLOADS_DIR = ROOT;

const { ProjectModel } =
  await import('../../../src/features/project/project.model.js');
const { removeOrphanCovers } =
  await import('../../../src/features/project/project.maintenance.js');

/**
 * Reconciliation compares what is on disk with what the database points at, so
 * both have to be real. A mocked model would let this pass while deleting the
 * wrong files.
 */
const URI =
  process.env.PROJECT_MAINTENANCE_MONGO_URI ??
  'mongodb://127.0.0.1:27017/portfolio_project_maintenance_test';

const connected = await connectOrSkip('project maintenance', URI);

const PROJECT_DIR = path.join(ROOT, 'project');

async function storeCover(name: string) {
  await mkdir(PROJECT_DIR, { recursive: true });
  await writeFile(path.join(PROJECT_DIR, name), 'pretend image bytes');

  return `/uploads/project/${name}`;
}

async function storedNames() {
  try {
    return (await readdir(PROJECT_DIR)).sort();
  } catch {
    return [];
  }
}

async function saveProjectWith(
  title: string,
  imageUrl: string | undefined,
  gallery: string[] = [],
) {
  await ProjectModel.collection.insertOne({
    // Inserted straight through the driver, so nothing fills this in. Two
    // documents without one are two nulls, which the unique index refuses.
    slug: title.toLowerCase(),
    title: { en: title },
    description: { en: 'A project.' },
    skills: [],
    gallery: gallery.map((url) => ({ url })),
    featured: false,
    order: 0,
    ...(imageUrl ? { imageUrl } : {}),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

/**
 * Written straight into the collection with no `gallery` at all, the way every
 * project stored before the field existed looks. Reconciliation must read it
 * as "no gallery images" rather than throwing - a crash here halts the whole
 * sweep, and a wrong answer deletes files.
 */
async function saveLegacyProject(title: string, imageUrl: string) {
  await ProjectModel.collection.insertOne({
    title: { en: title },
    description: { en: 'A project.' },
    skills: [],
    featured: false,
    order: 0,
    imageUrl,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe.skipIf(!connected)('removing orphaned project covers', () => {
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await ProjectModel.collection.deleteMany({});
    await rm(PROJECT_DIR, { recursive: true, force: true });
  });

  // The cost of uploading before saving: a file the admin never committed to.
  it('deletes a cover no project points at', async () => {
    await storeCover('cover-orphan.png');
    await saveProjectWith('Kept', await storeCover('cover-used.png'));

    expect(await removeOrphanCovers()).toEqual({ removed: 1, kept: 1 });
    expect(await storedNames()).toEqual(['cover-used.png']);
  });

  // Several projects, several covers: every one still referenced must survive.
  it('keeps a cover each of several projects is using', async () => {
    await saveProjectWith('One', await storeCover('cover-one.png'));
    await saveProjectWith('Two', await storeCover('cover-two.png'));
    await storeCover('cover-orphan.png');

    expect(await removeOrphanCovers()).toEqual({ removed: 1, kept: 2 });
    expect(await storedNames()).toEqual(['cover-one.png', 'cover-two.png']);
  });

  it('removes everything when no project exists at all', async () => {
    await storeCover('cover-a.png');
    await storeCover('cover-b.png');

    expect(await removeOrphanCovers()).toEqual({ removed: 2, kept: 0 });
    expect(await storedNames()).toEqual([]);
  });

  it('treats a project pointing at an external URL as using no local file', async () => {
    await storeCover('cover-local.png');
    await saveProjectWith('External', 'https://cdn.example.com/a.png');

    expect(await removeOrphanCovers()).toEqual({ removed: 1, kept: 0 });
    expect(await storedNames()).toEqual([]);
  });

  it('does nothing when there is nothing stored', async () => {
    expect(await removeOrphanCovers()).toEqual({ removed: 0, kept: 0 });
  });

  /**
   * A project references its cover *and* every gallery image. Counting the
   * cover alone - which is all this did before galleries existed - deletes
   * every screenshot while the project is still showing it. Silent data loss,
   * so it is pinned rather than trusted.
   */
  it('keeps gallery images as well as the cover', async () => {
    const cover = await storeCover('cover-in-use.png');
    const first = await storeCover('gallery-one.png');
    const second = await storeCover('gallery-two.png');
    await storeCover('gallery-abandoned.png');
    await saveProjectWith('Portfolio', cover, [first, second]);

    const result = await removeOrphanCovers();

    expect(result).toEqual({ removed: 1, kept: 3 });
    expect(await storedNames()).toEqual([
      'cover-in-use.png',
      'gallery-one.png',
      'gallery-two.png',
    ]);
  });

  it('keeps gallery images for a project with no cover at all', async () => {
    const only = await storeCover('gallery-only.png');
    await saveProjectWith('Portfolio', undefined, [only]);

    expect(await removeOrphanCovers()).toEqual({ removed: 0, kept: 1 });
    expect(await storedNames()).toEqual(['gallery-only.png']);
  });

  it('reads a project stored before galleries existed', async () => {
    const cover = await storeCover('legacy-cover.png');
    await storeCover('legacy-orphan.png');
    await saveLegacyProject('Older', cover);

    expect(await removeOrphanCovers()).toEqual({ removed: 1, kept: 1 });
    expect(await storedNames()).toEqual(['legacy-cover.png']);
  });

  it('is safe to run twice', async () => {
    await saveProjectWith('Kept', await storeCover('cover-used.png'));
    await storeCover('cover-orphan.png');

    await removeOrphanCovers();

    expect(await removeOrphanCovers()).toEqual({ removed: 0, kept: 1 });
    expect(await storedNames()).toEqual(['cover-used.png']);
  });
});
