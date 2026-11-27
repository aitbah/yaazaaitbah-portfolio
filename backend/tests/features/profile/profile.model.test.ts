import { describe, expect, it } from 'vitest';

import { ProfileModel } from '../../../src/features/profile/profile.model.js';

const VALID = {
  firstName: { en: 'Yaaza' },
  lastName: { en: 'Ait Bah' },
  headline: { en: 'Full-stack developer' },
};

/** Mongoose validates locally, so the schema is exercised without a database. */
async function errorPathsOf(doc: Record<string, unknown>) {
  try {
    await new ProfileModel(doc).validate();
  } catch (error) {
    // Sorted: Mongoose does not promise an order for the failing paths.
    return Object.keys(
      (error as { errors: Record<string, unknown> }).errors,
    ).sort();
  }

  throw new Error('expected validation to fail');
}

describe('profile model', () => {
  it('accepts a profile carrying only the launch locale', async () => {
    await expect(new ProfileModel(VALID).validate()).resolves.toBeUndefined();
  });

  it('requires a name and a headline', async () => {
    expect(await errorPathsOf({})).toEqual([
      'firstName',
      'headline',
      'lastName',
    ]);
  });

  it('leaves the bio and the photo reference optional', async () => {
    const profile = new ProfileModel(VALID);

    await expect(profile.validate()).resolves.toBeUndefined();
    expect(profile.bio).toBeUndefined();
    expect(profile.photoUrl).toBeUndefined();
  });

  // Only the reference is persisted; the file itself lives in object storage.
  it('stores the photo as a reference, not as data', () => {
    expect(ProfileModel.schema.path('photoUrl').instance).toBe('String');
  });
});

describe('multilingual structure', () => {
  it('accepts any additional locale without a schema change', async () => {
    const profile = new ProfileModel({
      firstName: { en: 'Yaaza', ar: 'ياعزى' },
      lastName: { en: 'Ait Bah', ar: 'أيت بها' },
      headline: { en: 'Full-stack developer', ar: 'مطور ويب' },
    });

    await expect(profile.validate()).resolves.toBeUndefined();
    expect(profile.firstName?.get('ar')).toBe('ياعزى');
  });

  // What a client reads must be a plain object, not a Map.
  it('serializes a localized field as an object keyed by locale', () => {
    const profile = new ProfileModel({
      ...VALID,
      firstName: { en: 'Y', ar: 'ي' },
    });

    const serialized = JSON.parse(JSON.stringify(profile)) as {
      firstName: Record<string, string>;
    };

    expect(serialized.firstName).toEqual({ en: 'Y', ar: 'ي' });
  });

  it('rejects a localized field that omits the launch locale', async () => {
    expect(
      await errorPathsOf({ ...VALID, headline: { ar: 'مطور ويب' } }),
    ).toEqual(['headline']);
  });
});
