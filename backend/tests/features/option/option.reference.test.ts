import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { OPTION_LISTS } from '@portfolio/shared';

import { connectOrSkip } from '../../support/mongo.js';
import { seedOptionLists } from '../../support/options.js';

const { OptionModel } =
  await import('../../../src/features/option/option.model.js');
const { OPTION_USAGE } =
  await import('../../../src/features/option/option.usage.js');
const { createExpertise } =
  await import('../../../src/features/expertise/expertise.service.js');
const { createExperience } =
  await import('../../../src/features/experience/experience.service.js');
const { createEducation } =
  await import('../../../src/features/education/education.service.js');
const { createLanguage } =
  await import('../../../src/features/language/language.service.js');
const { createSocialLink } =
  await import('../../../src/features/social-link/social-link.service.js');
const { saveProfile } =
  await import('../../../src/features/profile/profile.service.js');

/**
 * The guard that replaced eight `z.enum`s.
 *
 * Each of these was, until this pass, a schema refusing a value it did not
 * recognise - provable without a database because the answer was compiled in.
 * It is a lookup now, so this is where it has to be proved: real rows, real
 * lists, and every field that carries a code.
 */
const URI =
  process.env.OPTION_REFERENCE_MONGO_URI ??
  'mongodb://127.0.0.1:27017/portfolio_option_reference_test';

const connected = await connectOrSkip('option reference', URI);

// At file scope rather than in the first suite: both suites in this file need
// the connection, and tearing it down inside one of them closes it under the
// other.
afterAll(async () => {
  if (connected) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

describe.skipIf(!connected)('a code must be one its list offers', () => {
  beforeAll(async () => {
    await seedOptionLists();
  });

  const SKILL = { name: { en: 'Problem Solving' }, level: 90, order: 0 };
  const POSITION = {
    role: { en: 'Developer' },
    organisation: { en: 'Somewhere' },
    startDate: '2020-01',
    current: true,
  };
  const DEGREE = {
    institution: { en: 'University' },
    qualification: { en: 'BSc' },
    startDate: '2015-09',
    endDate: '2018-06',
    current: false,
  };

  it('refuses an expertise category no list offers', async () => {
    await expect(
      createExpertise('skill', { ...SKILL, category: 'nonsense' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { category: 'INVALID_VALUE' },
    });
  });

  /**
   * The check the per-kind `z.enum` used to make, and the reason each kind
   * reads its own list: `frontend` is a real category, and not one of a
   * skill's.
   */
  it('refuses another kind’s category, however real it is', async () => {
    await expect(
      createExpertise('skill', { ...SKILL, category: 'frontend' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { category: 'INVALID_VALUE' },
    });
  });

  it('accepts a category the kind’s own list offers', async () => {
    await expect(
      createExpertise('skill', { ...SKILL, category: 'engineering' }),
    ).resolves.toMatchObject({ category: 'engineering' });
  });

  it('refuses an employment type no list offers', async () => {
    await expect(
      createExperience({ ...POSITION, employmentType: 'consultant' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { employmentType: 'INVALID_VALUE' },
    });
  });

  it('refuses an education level no list offers', async () => {
    await expect(
      createEducation({ ...DEGREE, level: 'phd' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { level: 'INVALID_VALUE' },
    });
  });

  it('refuses a language level no list offers', async () => {
    await expect(
      createLanguage({ code: 'fr', level: 'fluent' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { level: 'INVALID_VALUE' },
    });
  });

  it('refuses a platform no list offers', async () => {
    await expect(
      createSocialLink({
        platform: 'myspace',
        url: 'https://myspace.com/me',
        order: 0,
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { platform: 'INVALID_VALUE' },
    });
  });

  it('refuses an availability status no list offers', async () => {
    await expect(
      saveProfile({
        firstName: { en: 'A' },
        lastName: { en: 'B' },
        headline: { en: 'C' },
        contact: {
          availability: 'maybe',
          emailPublic: false,
          locationPublic: false,
          availabilityPublic: true,
        },
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { 'contact.availability': 'INVALID_VALUE' },
    });
  });

  /**
   * The profile's status is the one optional code anywhere: a status exists to
   * be displayed, and choosing not to display one is a real answer rather than
   * an unfilled field.
   */
  it('accepts a profile with no availability status at all', async () => {
    await expect(
      saveProfile({
        firstName: { en: 'A' },
        lastName: { en: 'B' },
        headline: { en: 'C' },
        contact: {
          emailPublic: false,
          locationPublic: false,
          availabilityPublic: true,
        },
      }),
    ).resolves.toBeTruthy();
  });
});

/**
 * A list with no counter behind it is a delete that quietly succeeds, leaving
 * rows pointing at a code nothing will validate again. TypeScript refuses a
 * missing entry; this refuses one that was added and left pointing nowhere.
 */
describe.skipIf(!connected)('every list can say whether it is in use', () => {
  beforeEach(async () => {
    await OptionModel.deleteMany({ list: 'social-platform' });
  });

  it('has a counter for every declared list', () => {
    expect(Object.keys(OPTION_USAGE).sort()).toEqual([...OPTION_LISTS].sort());
  });

  it('counts nothing for a code nothing holds', async () => {
    for (const list of OPTION_LISTS) {
      expect(await OPTION_USAGE[list]('nothing-uses-this')).toBe(0);
    }
  });
});
