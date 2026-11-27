import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MESSAGES_PAGE_SIZE } from '@portfolio/shared';

import { connectOrSkip } from '../../support/mongo.js';

const { MessageModel } =
  await import('../../../src/features/message/message.model.js');
const {
  countUnreadMessages,
  listMessages,
  markMessageRead,
  removeMessage,
  saveMessage,
} = await import('../../../src/features/message/message.service.js');

const URI =
  process.env.MESSAGE_MONGO_URI ??
  'mongodb://127.0.0.1:27017/portfolio_message_test';

const connected = await connectOrSkip('message', URI);

const VALID = {
  name: 'Someone',
  email: 'someone@example.com',
  subject: 'Hello',
  body: 'I would like to talk.',
};

describe.skipIf(!connected)('message persistence', () => {
  beforeAll(async () => {
    await MessageModel.syncIndexes();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await MessageModel.deleteMany({});
  });

  describe('receiving', () => {
    it('stores what was sent', async () => {
      await saveMessage(VALID);

      const stored = await MessageModel.findOne();

      expect(stored?.name).toBe('Someone');
      expect(stored?.subject).toBe('Hello');
      expect(stored?.body).toBe('I would like to talk.');
    });

    it('arrives unread', async () => {
      await saveMessage(VALID);

      expect((await MessageModel.findOne())?.read).toBe(false);
    });

    // Two people writing about the same thing is not a conflict.
    it('accepts several messages from the same address', async () => {
      await saveMessage(VALID);
      await saveMessage({ ...VALID, subject: 'Again' });

      expect(await MessageModel.countDocuments()).toBe(2);
    });

    it('normalises the address so an inbox groups them predictably', async () => {
      await saveMessage({ ...VALID, email: 'Someone@Example.COM' });

      expect((await MessageModel.findOne())?.email).toBe('someone@example.com');
    });

    /**
     * Accepted and discarded: the caller cannot tell it from a real send, which
     * is the whole reason a honeypot works.
     */
    it('stores nothing when the honeypot was filled', async () => {
      await expect(
        saveMessage({ ...VALID, website: 'http://spam.example' }),
      ).resolves.toBeUndefined();

      expect(await MessageModel.countDocuments()).toBe(0);
    });

    it('stores the sanitized text', async () => {
      await saveMessage({ ...VALID, body: 'a\u200Bbc' });

      expect((await MessageModel.findOne())?.body).toBe('abc');
    });
  });

  describe('the inbox', () => {
    it('returns them newest first', async () => {
      await saveMessage({ ...VALID, subject: 'First' });
      await saveMessage({ ...VALID, subject: 'Second' });
      await MessageModel.collection.updateOne(
        { subject: 'First' },
        { $set: { createdAt: new Date(Date.now() - 60_000) } },
      );

      const { messages } = await listMessages();
      const subjects = messages.map((message) => message.subject);

      expect(subjects).toEqual(['Second', 'First']);
    });

    it('counts the unread ones', async () => {
      await saveMessage({ ...VALID, subject: 'One' });
      await saveMessage({ ...VALID, subject: 'Two' });

      expect(await countUnreadMessages()).toBe(2);

      const first = await MessageModel.findOne({ subject: 'One' });
      await markMessageRead(first!.id, true);

      expect(await countUnreadMessages()).toBe(1);
    });
  });

  /**
   * The inbox is the only list a stranger can add rows to, so it is the only
   * one that pages. These run against a real database because skip and limit
   * interacting with the sort is exactly what a mock cannot prove.
   */
  describe('pagination', () => {
    async function fill(count: number) {
      for (let index = 0; index < count; index += 1) {
        await MessageModel.collection.insertOne({
          ...VALID,
          subject: `Message ${String(index).padStart(3, '0')}`,
          read: false,
          // Distinct and ordered, so "newest first" is unambiguous.
          createdAt: new Date(Date.UTC(2026, 0, 1) + index * 60_000),
          updatedAt: new Date(),
        });
      }
    }

    it('returns at most one page, and the total across all pages', async () => {
      await fill(25);

      const { messages, total } = await listMessages(0);

      expect(messages).toHaveLength(MESSAGES_PAGE_SIZE);
      expect(total).toBe(25);
    });

    it('continues where the previous page ended, without repeating', async () => {
      await fill(25);

      const first = await listMessages(0);
      const second = await listMessages(1);

      expect(second.messages).toHaveLength(5);

      const seen = [...first.messages, ...second.messages].map(
        (message) => message.subject,
      );

      expect(new Set(seen).size).toBe(25);
    });

    it('keeps the newest first across the page boundary', async () => {
      await fill(25);

      const first = await listMessages(0);
      const second = await listMessages(1);

      const last = first.messages.at(-1);
      const next = second.messages.at(0);

      expect(last!.createdAt.getTime()).toBeGreaterThan(
        next!.createdAt.getTime(),
      );
    });

    // What a stale link produces once messages have been deleted.
    it('answers a page past the end with an empty page, not an error', async () => {
      await fill(3);

      const { messages, total } = await listMessages(9);

      expect(messages).toEqual([]);
      expect(total).toBe(3);
    });

    it('counts every message, not only the page', async () => {
      await fill(25);

      expect((await listMessages(1)).total).toBe(25);
    });
  });

  describe('marking read', () => {
    it('flips the flag and back', async () => {
      await saveMessage(VALID);
      const message = await MessageModel.findOne();

      expect((await markMessageRead(message!.id, true)).read).toBe(true);
      expect((await markMessageRead(message!.id, false)).read).toBe(false);
    });

    // What was sent is never edited: that would make the record a lie.
    it('changes nothing else about the message', async () => {
      await saveMessage(VALID);
      const before = await MessageModel.findOne();

      const after = await markMessageRead(before!.id, true);

      expect(after.name).toBe(before!.name);
      expect(after.email).toBe(before!.email);
      expect(after.subject).toBe(before!.subject);
      expect(after.body).toBe(before!.body);
      expect(after.createdAt.getTime()).toBe(before!.createdAt.getTime());
    });

    it('answers NOT_FOUND for a message that is gone', async () => {
      const absent = new mongoose.Types.ObjectId().toString();

      await expect(markMessageRead(absent, true)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('removal', () => {
    it('deletes the message', async () => {
      await saveMessage(VALID);
      const message = await MessageModel.findOne();

      await removeMessage(message!.id);

      expect(await MessageModel.countDocuments()).toBe(0);
    });

    it('answers NOT_FOUND when it is already gone', async () => {
      const absent = new mongoose.Types.ObjectId().toString();

      await expect(removeMessage(absent)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });
});
