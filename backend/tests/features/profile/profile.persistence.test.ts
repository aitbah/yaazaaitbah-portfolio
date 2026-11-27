import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectOrSkip } from '../../support/mongo.js';

// Storage resolves its root at import; keep the real service but write nowhere
// that matters.
process.env.UPLOADS_DIR = await mkdtemp(
  path.join(tmpdir(), 'portfolio-persistence-'),
);

const { ProfileModel, SINGLETON_KEY } =
  await import('../../../src/features/profile/profile.model.js');
const { readProfile, saveProfile, toProfileResponse } =
  await import('../../../src/features/profile/profile.service.js');

/**
 * These run against a real MongoDB - the one `docker compose up` already
 * provides, in a database of their own that is dropped afterwards.
 *
 * Every other suite mocks the model, which can only prove the code calls
 * Mongoose as intended, never that Mongoose does what the design assumes.
 * Upsert-and-replace semantics, validators on a replacement, Map serialization
 * and the singleton index are only real here.
 *
 * Without a reachable database they skip rather than fail: `npm test` must stay
 * runnable on a machine with nothing started.
 */
const URI =
  process.env.PERSISTENCE_MONGO_URI ??
  'mongodb://127.0.0.1:27017/portfolio_persistence_test';

const connected = await connectOrSkip('persistence', URI);

const VALID = {
  firstName: { en: 'Yaaza' },
  lastName: { en: 'Ait Bah' },
  headline: { en: 'Full-stack developer' },
};

describe.skipIf(!connected)('profile persistence', () => {
  beforeAll(async () => {
    // The singleton guarantee depends on an index that is built lazily.
    await ProfileModel.init();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await ProfileModel.deleteMany({});
  });

  describe('the singleton guarantee', () => {
    it('declares a unique index on the key', async () => {
      const indexes = await ProfileModel.collection.indexes();
      const unique = indexes.find((index) => index.unique);

      expect(unique?.key).toEqual({ key: 1 });
    });

    // The defect this suite exists for: with an empty filter and no unique
    // index, concurrent upserts could both insert and nothing would notice.
    it('cannot end up with two profiles under concurrent writes', async () => {
      const writes = Array.from({ length: 8 }, (_, index) =>
        saveProfile({ ...VALID, headline: { en: `Writer ${index}` } }).catch(
          () => null,
        ),
      );

      await Promise.all(writes);

      expect(await ProfileModel.countDocuments()).toBe(1);
    });

    it('refuses a second document even when inserted directly', async () => {
      await saveProfile(VALID);

      await expect(
        ProfileModel.create({ ...VALID, key: SINGLETON_KEY }),
      ).rejects.toThrow();
      expect(await ProfileModel.countDocuments()).toBe(1);
    });

    it('addresses the profile by key rather than by position', async () => {
      await saveProfile(VALID);

      expect((await ProfileModel.findOne({}))?.key).toBe(SINGLETON_KEY);
    });
  });

  describe('saving', () => {
    it('creates the profile when none exists', async () => {
      await saveProfile(VALID);

      expect(await ProfileModel.countDocuments()).toBe(1);
    });

    it('updates in place instead of adding another', async () => {
      const first = await saveProfile(VALID);
      const second = await saveProfile({
        ...VALID,
        headline: { en: 'Backend engineer' },
      });

      expect(await ProfileModel.countDocuments()).toBe(1);
      expect(first._id.toString()).toBe(second._id.toString());
      expect(second.headline.get('en')).toBe('Backend engineer');
    });

    // PUT replaces: an omitted optional field must actually be cleared. The
    // write sets what was sent and unsets what was not, so this is the test
    // that keeps those two halves in step.
    it('clears an optional field that is omitted', async () => {
      await saveProfile({
        ...VALID,
        bio: { en: 'Building things.' },
        photoUrl: 'https://cdn.example.com/me.jpg',
      });

      const saved = await saveProfile(VALID);

      expect(saved.bio ?? null).toBeNull();
      expect(saved.photoUrl ?? null).toBeNull();
    });

    /**
     * A replacement document carries no `createdAt`, and Mongoose fills the
     * missing one in with the current time - so every save silently reset the
     * profile's creation date to today, unrecoverably. Nothing reads it yet,
     * which is exactly why it went unnoticed.
     */
    it('keeps the original creation date across a save', async () => {
      await saveProfile(VALID);
      const madeAMonthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);

      await ProfileModel.collection.updateOne(
        {},
        { $set: { createdAt: madeAMonthAgo } },
      );

      const saved = await saveProfile({
        ...VALID,
        headline: { en: 'Changed' },
      });

      expect(saved.createdAt.getTime()).toBe(madeAMonthAgo.getTime());
    });

    it('still moves the modification date forward', async () => {
      const first = await saveProfile(VALID);
      const before = first.updatedAt.getTime();

      await ProfileModel.collection.updateOne(
        {},
        { $set: { updatedAt: new Date(before - 60_000) } },
      );

      const saved = await saveProfile({
        ...VALID,
        headline: { en: 'Changed' },
      });

      expect(saved.updatedAt.getTime()).toBeGreaterThan(before - 60_000);
    });

    // The insert half of the upsert has no previous document to take a date
    // from, so it must still get one.
    it('gives a newly created profile both timestamps', async () => {
      const created = await saveProfile(VALID);

      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
    });

    it('keeps the key across a replacement', async () => {
      await saveProfile(VALID);
      const replaced = await saveProfile({
        ...VALID,
        headline: { en: 'Changed' },
      });

      expect(replaced.key).toBe(SINGLETON_KEY);
    });

    // runValidators is passed; this proves it is honoured on a replacement.
    it('runs the model validators on the way in', async () => {
      await expect(
        saveProfile({ ...VALID, firstName: { fr: 'Yaaza' } as never }),
      ).rejects.toThrow();
    });
  });

  describe('reading', () => {
    it('answers NOT_FOUND while nothing has been saved', async () => {
      await expect(readProfile()).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('returns what was actually stored', async () => {
      await saveProfile({ ...VALID, bio: { en: 'Building things.' } });

      const response = toProfileResponse(await readProfile(), 'owner');

      expect(response.firstName).toEqual({ en: 'Yaaza' });
      expect(response.bio).toEqual({ en: 'Building things.' });
    });

    // A Map is stored; a client must never see one.
    it('serializes localized fields as plain objects', async () => {
      await saveProfile({ ...VALID, firstName: { en: 'Yaaza', ar: 'ياعزى' } });

      const response = toProfileResponse(await readProfile(), 'owner');
      const serialized = JSON.parse(JSON.stringify(response)) as {
        firstName: Record<string, string>;
      };

      expect(serialized.firstName).toEqual({ en: 'Yaaza', ar: 'ياعزى' });
    });

    it('never exposes the singleton key or the document id', async () => {
      await saveProfile(VALID);

      const keys = Object.keys(toProfileResponse(await readProfile(), 'owner'));

      expect(keys).not.toContain('key');
      expect(keys).not.toContain('_id');
    });

    it('stores any locale without a schema change', async () => {
      await saveProfile({
        ...VALID,
        headline: { en: 'Developer', ar: 'مطور', fr: 'Développeur' },
      });

      expect((await readProfile()).headline.get('fr')).toBe('Développeur');
    });
  });
});
