import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { connectOrSkip } from '../../support/mongo.js';

const ROOT = await mkdtemp(path.join(tmpdir(), 'portfolio-prune-'));
process.env.UPLOADS_DIR = ROOT;

const { ProfileModel, SINGLETON_KEY } =
  await import('../../../src/features/profile/profile.model.js');
const { removeOrphanPhotos } =
  await import('../../../src/features/profile/profile.maintenance.js');

/**
 * Reconciliation compares what is on disk with what the database points at, so
 * both have to be real. A mocked model would let this pass while deleting the
 * wrong files.
 */
const URI =
  process.env.MAINTENANCE_MONGO_URI ??
  'mongodb://127.0.0.1:27017/portfolio_maintenance_test';

const connected = await connectOrSkip('maintenance', URI);

const PROFILE_DIR = path.join(ROOT, 'profile');

async function storePhoto(name: string) {
  await mkdir(PROFILE_DIR, { recursive: true });
  await writeFile(path.join(PROFILE_DIR, name), 'pretend image bytes');

  return `/uploads/profile/${name}`;
}

async function storedNames() {
  try {
    return (await readdir(PROFILE_DIR)).sort();
  } catch {
    return [];
  }
}

async function saveProfileWith(photoUrl: string | undefined) {
  await ProfileModel.collection.deleteMany({});
  await ProfileModel.collection.insertOne({
    key: SINGLETON_KEY,
    firstName: { en: 'Yaaza' },
    lastName: { en: 'Ait Bah' },
    headline: { en: 'Full-stack developer' },
    ...(photoUrl ? { photoUrl } : {}),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe.skipIf(!connected)('removing orphaned profile photos', () => {
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await ProfileModel.collection.deleteMany({});
    await rm(PROFILE_DIR, { recursive: true, force: true });
  });

  // The cost of uploading before saving: a file the admin never committed to.
  it('deletes a photo the profile does not point at', async () => {
    const abandoned = await storePhoto('avatar-abandoned.png');
    await saveProfileWith(undefined);

    const result = await removeOrphanPhotos();

    expect(result).toEqual({ removed: 1, kept: 0 });
    expect(await storedNames()).toEqual([]);
    expect(abandoned).toBe('/uploads/profile/avatar-abandoned.png');
  });

  it('keeps the photo the profile is using', async () => {
    const inUse = await storePhoto('avatar-in-use.png');
    await storePhoto('avatar-abandoned.png');
    await saveProfileWith(inUse);

    const result = await removeOrphanPhotos();

    expect(result).toEqual({ removed: 1, kept: 1 });
    expect(await storedNames()).toEqual(['avatar-in-use.png']);
  });

  it('removes everything when no profile exists at all', async () => {
    await storePhoto('avatar-one.png');
    await storePhoto('avatar-two.png');

    const result = await removeOrphanPhotos();

    expect(result.removed).toBe(2);
    expect(await storedNames()).toEqual([]);
  });

  // An external URL references no local file, so every stored file is orphaned
  // - and nothing should be attempted against the remote host.
  it('treats a profile pointing at an external URL as using no local file', async () => {
    await storePhoto('avatar-local.png');
    await saveProfileWith('https://cdn.example.com/me.jpg');

    const result = await removeOrphanPhotos();

    expect(result).toEqual({ removed: 1, kept: 0 });
    expect(await storedNames()).toEqual([]);
  });

  it('does nothing when there is nothing stored', async () => {
    await saveProfileWith(undefined);

    expect(await removeOrphanPhotos()).toEqual({ removed: 0, kept: 0 });
  });

  it('is safe to run twice', async () => {
    const inUse = await storePhoto('avatar-in-use.png');
    await storePhoto('avatar-abandoned.png');
    await saveProfileWith(inUse);

    await removeOrphanPhotos();
    const second = await removeOrphanPhotos();

    expect(second).toEqual({ removed: 0, kept: 1 });
    expect(await storedNames()).toEqual(['avatar-in-use.png']);
  });
});
