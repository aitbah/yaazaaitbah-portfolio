import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { connectOrSkip } from '../../support/mongo.js';
import { seedOptionLists } from '../../support/options.js';

const { SocialLinkModel } =
  await import('../../../src/features/social-link/social-link.model.js');
const {
  createSocialLink,
  listSocialLinks,
  removeSocialLink,
  updateSocialLink,
} = await import('../../../src/features/social-link/social-link.service.js');

const URI =
  process.env.SOCIAL_LINK_MONGO_URI ??
  'mongodb://127.0.0.1:27017/portfolio_social_link_test';

const connected = await connectOrSkip('social link', URI);

const VALID = {
  platform: 'github' as const,
  url: 'https://github.com/me',
  order: 0,
};

describe.skipIf(!connected)('social link persistence', () => {
  beforeAll(async () => {
    await SocialLinkModel.syncIndexes();
    // Six services refuse a code no option list offers, so the lists the
    // content under test references have to exist.
    await seedOptionLists('social-platform-group', 'social-platform');
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await SocialLinkModel.deleteMany({});
  });

  describe('the unique URL', () => {
    it('declares a unique index on the URL', async () => {
      const indexes = await SocialLinkModel.collection.indexes();
      const unique = indexes.find((index) => index.unique);

      expect(unique?.key).toEqual({ url: 1 });
    });

    it('refuses the same link twice', async () => {
      await createSocialLink(VALID);

      await expect(createSocialLink(VALID)).rejects.toMatchObject({
        code: 'CONFLICT',
        details: { url: 'URL_TAKEN' },
      });
      expect(await SocialLinkModel.countDocuments()).toBe(1);
    });

    /**
     * Two accounts on one platform is a choice someone might legitimately
     * make; two rows pointing at the same address never is. That is why the
     * index is on the URL rather than the platform.
     */
    it('allows two links on the same platform', async () => {
      await createSocialLink(VALID);
      await createSocialLink({ ...VALID, url: 'https://github.com/me-too' });

      expect(await SocialLinkModel.countDocuments()).toBe(2);
    });

    it('refuses to move a link onto another link’s URL', async () => {
      const first = await createSocialLink(VALID);
      await createSocialLink({ ...VALID, url: 'https://github.com/other' });

      await expect(
        updateSocialLink(first.id, {
          ...VALID,
          url: 'https://github.com/other',
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });
  });

  describe('what the database enforces', () => {
    it('rejects a platform it does not know', async () => {
      await expect(
        // Bypasses the request schema on purpose: the database is the last
        // guard and must hold on its own.
        createSocialLink({ ...VALID, platform: 'myspace' }),
      ).rejects.toThrow();
    });

    it('rejects a negative position', async () => {
      await expect(createSocialLink({ ...VALID, order: -1 })).rejects.toThrow();
    });
  });

  describe('updating', () => {
    it('keeps the original creation date', async () => {
      const link = await createSocialLink(VALID);
      const madeAMonthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);

      await SocialLinkModel.collection.updateOne(
        { _id: link._id },
        { $set: { createdAt: madeAMonthAgo } },
      );

      const updated = await updateSocialLink(link.id, {
        ...VALID,
        order: 4,
      });

      expect(updated.createdAt.getTime()).toBe(madeAMonthAgo.getTime());
      expect(updated.order).toBe(4);
    });
  });

  describe('display order', () => {
    it('returns the lowest position first, then by platform', async () => {
      await createSocialLink({
        ...VALID,
        platform: 'youtube',
        url: 'https://youtube.com/@me',
        order: 0,
      });
      await createSocialLink({
        ...VALID,
        platform: 'github',
        url: 'https://github.com/me',
        order: 0,
      });
      await createSocialLink({
        ...VALID,
        platform: 'linkedin',
        url: 'https://linkedin.com/in/me',
        order: 5,
      });

      const platforms = (await listSocialLinks()).map((l) => l.platform);

      expect(platforms).toEqual(['github', 'youtube', 'linkedin']);
    });
  });

  describe('removal', () => {
    it('deletes the link and leaves the others alone', async () => {
      const doomed = await createSocialLink(VALID);
      await createSocialLink({ ...VALID, url: 'https://github.com/other' });

      await removeSocialLink(doomed.id);

      expect(await SocialLinkModel.countDocuments()).toBe(1);
    });

    it('answers NOT_FOUND when the link is already gone', async () => {
      const link = await createSocialLink(VALID);
      await removeSocialLink(link.id);

      await expect(removeSocialLink(link.id)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });
});
