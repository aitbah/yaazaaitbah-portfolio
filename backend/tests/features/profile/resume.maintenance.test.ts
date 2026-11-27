import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { connectOrSkip } from '../../support/mongo.js';

const ROOT = await mkdtemp(path.join(tmpdir(), 'portfolio-prune-resume-'));
process.env.UPLOADS_DIR = ROOT;

const { ProfileModel, SINGLETON_KEY } =
  await import('../../../src/features/profile/profile.model.js');
const { removeOrphanResumes } =
  await import('../../../src/features/profile/resume.maintenance.js');

/**
 * Reconciliation compares what is on disk with what the profile points at, so
 * both have to be real. A mocked model would let this pass while deleting the
 * wrong files.
 */
const URI =
  process.env.RESUME_MAINTENANCE_MONGO_URI ??
  'mongodb://127.0.0.1:27017/portfolio_resume_maintenance_test';

const connected = await connectOrSkip('resume maintenance', URI);

const RESUME_DIR = path.join(ROOT, 'resume');

async function storeResume(name: string) {
  await mkdir(RESUME_DIR, { recursive: true });
  await writeFile(path.join(RESUME_DIR, name), '%PDF-1.7');

  return `/uploads/resume/${name}`;
}

async function storedNames() {
  try {
    return (await readdir(RESUME_DIR)).sort();
  } catch {
    return [];
  }
}

async function saveProfile(resume?: Record<string, string>) {
  await ProfileModel.collection.insertOne({
    key: SINGLETON_KEY,
    firstName: { en: 'Yaaza' },
    lastName: { en: 'Ait Bah' },
    headline: { en: 'Developer' },
    ...(resume ? { resume } : {}),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe.skipIf(!connected)('removing orphaned resumes', () => {
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await ProfileModel.collection.deleteMany({});
    await rm(RESUME_DIR, { recursive: true, force: true });
  });

  // The cost of uploading before saving: a file the admin never committed to.
  it('deletes a CV the profile does not point at', async () => {
    await storeResume('cv-orphan.pdf');
    await saveProfile({ en: await storeResume('cv-used.pdf') });

    expect(await removeOrphanResumes()).toEqual({ removed: 1, kept: 1 });
    expect(await storedNames()).toEqual(['cv-used.pdf']);
  });

  /**
   * The field is a map, so every locale's value counts. Reading only the launch
   * locale would delete a French CV that is still on the site - the same shape
   * of defect as reading only the cover and deleting the gallery.
   */
  it('keeps a CV in a locale other than the launch one', async () => {
    const english = await storeResume('cv-en.pdf');
    const french = await storeResume('cv-fr.pdf');
    await storeResume('cv-orphan.pdf');
    await saveProfile({ en: english, fr: french });

    expect(await removeOrphanResumes()).toEqual({ removed: 1, kept: 2 });
    expect(await storedNames()).toEqual(['cv-en.pdf', 'cv-fr.pdf']);
  });

  it('removes everything when the profile has no CV at all', async () => {
    await storeResume('cv-a.pdf');
    await storeResume('cv-b.pdf');
    await saveProfile();

    expect(await removeOrphanResumes()).toEqual({ removed: 2, kept: 0 });
    expect(await storedNames()).toEqual([]);
  });

  it('removes everything when there is no profile yet', async () => {
    await storeResume('cv-a.pdf');

    expect(await removeOrphanResumes()).toEqual({ removed: 1, kept: 0 });
    expect(await storedNames()).toEqual([]);
  });

  it('does nothing when there is nothing stored', async () => {
    await saveProfile();

    expect(await removeOrphanResumes()).toEqual({ removed: 0, kept: 0 });
  });

  it('is safe to run twice', async () => {
    await saveProfile({ en: await storeResume('cv-used.pdf') });
    await storeResume('cv-orphan.pdf');

    await removeOrphanResumes();

    expect(await removeOrphanResumes()).toEqual({ removed: 0, kept: 1 });
    expect(await storedNames()).toEqual(['cv-used.pdf']);
  });
});
