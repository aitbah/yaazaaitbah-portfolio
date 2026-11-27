import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../src/app.js';
import { loginRateLimit } from '../../../src/features/auth/auth.routes.js';
import {
  contactBurstLimit,
  contactHourlyLimit,
} from '../../../src/features/message/message.routes.js';
import { MessageModel } from '../../../src/features/message/message.model.js';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  buildAdmin,
  stubUserLookup,
  type FakeAdmin,
} from '../auth/admin.fixture.js';

vi.mock('../../../src/features/auth/user.model.js', () => ({
  UserModel: {
    findOne: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));
// The notification is proved in message.notify.test.ts. Here it only has to
// not exist: none of these tests is about mail, and a real one would try the
// network.
vi.mock('../../../src/features/message/message.notify.js', () => ({
  notifyOwnerOfMessage: vi.fn(() => Promise.resolve(true)),
}));
vi.mock('../../../src/features/message/message.model.js', () => ({
  MessageModel: {
    create: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findOneAndDelete: vi.fn(),
  },
  MESSAGE_SORT: { createdAt: -1 },
}));

const app = createApp();

const ID = '507f1f77bcf86cd799439033';
const RECEIVED_AT = new Date('2026-09-02T10:00:00.000Z');

const VALID_BODY = {
  name: 'Someone',
  email: 'someone@example.com',
  subject: 'Hello',
  body: 'I would like to talk.',
};

function asDocument(body: Record<string, unknown> = {}) {
  return {
    _id: ID,
    id: ID,
    ...VALID_BODY,
    read: false,
    createdAt: RECEIVED_AT,
    ...body,
  };
}

const model = MessageModel as unknown as Record<
  string,
  ReturnType<typeof vi.fn>
>;

function stubList(documents: unknown[], unread = 0, total = documents.length) {
  model.find?.mockReturnValue({
    sort: () => ({
      skip: () => ({ limit: () => Promise.resolve(documents) }),
    }),
  });

  // The service counts twice - every message, then the unread ones - so the
  // queue is reset first: `clearAllMocks` clears calls but not queued results,
  // and a leftover from an earlier stub would answer the wrong question.
  model.countDocuments?.mockReset();
  model.countDocuments?.mockResolvedValueOnce(total).mockResolvedValue(unread);
}

/** supertest types the body as `any`; narrow it in one place. */
function detailsOf(response: request.Response): Record<string, unknown> {
  return (response.body as { details: Record<string, unknown> }).details;
}

/** The limits are per-address and stateful, so each test starts clean. */
function resetLimits() {
  for (const key of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
    loginRateLimit.resetKey(key);
    contactBurstLimit.resetKey(key);
    contactHourlyLimit.resetKey(key);
  }
}

let admin: FakeAdmin;

beforeAll(async () => {
  admin = await buildAdmin();
});

beforeEach(() => {
  vi.clearAllMocks();
  stubUserLookup(admin);
  stubList([]);
  model.create?.mockResolvedValue(asDocument());
  resetLimits();
});

async function sessionCookie() {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const raw = (
    response.headers as Record<string, string[] | string | undefined>
  )['set-cookie'];

  return (Array.isArray(raw) ? raw[0] : raw) ?? '';
}

describe('POST /api/messages', () => {
  it('accepts a message from anyone, with no session', async () => {
    const response = await request(app).post('/api/messages').send(VALID_BODY);

    expect(response.status).toBe(200);
    expect(model.create).toHaveBeenCalledTimes(1);
  });

  // The sender does not need an id, and echoing the stored values back would
  // turn the endpoint into a way to probe what validation accepts.
  it('answers with nothing about what was stored', async () => {
    const response = await request(app).post('/api/messages').send(VALID_BODY);

    expect(response.body).toEqual({ code: 'SUCCESS', details: {} });
  });

  it('stores the sanitized text, not the raw input', async () => {
    await request(app)
      .post('/api/messages')
      .send({ ...VALID_BODY, body: 'a\u200Bb\u200Bc' });

    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'abc' }),
    );
  });

  // A message is never edited, so `read` cannot arrive from outside.
  it('never lets the sender set the read flag', async () => {
    await request(app)
      .post('/api/messages')
      .send({ ...VALID_BODY, read: true });

    const [created] = model.create?.mock.calls[0] as [Record<string, unknown>];

    expect('read' in created).toBe(false);
  });

  describe('validation', () => {
    it.each(['name', 'email', 'subject', 'body'])(
      'reports a missing %s on the field itself',
      async (field) => {
        const response = await request(app)
          .post('/api/messages')
          .send({ ...VALID_BODY, [field]: '' });

        expect(response.status).toBe(422);
        expect(detailsOf(response)).toHaveProperty(field);
        expect(model.create).not.toHaveBeenCalled();
      },
    );

    it('rejects an address that is not an email', async () => {
      const response = await request(app)
        .post('/api/messages')
        .send({ ...VALID_BODY, email: 'nope' });

      expect(response.status).toBe(422);
      expect(detailsOf(response)).toEqual({ email: 'INVALID_EMAIL' });
    });

    it('rejects a body past the maximum length', async () => {
      const response = await request(app)
        .post('/api/messages')
        .send({ ...VALID_BODY, body: 'x'.repeat(5001) });

      expect(response.status).toBe(422);
      expect(detailsOf(response)).toEqual({ body: 'TOO_BIG' });
    });
  });

  describe('the honeypot', () => {
    /**
     * Accepted and discarded, never refused. A 422 naming the field would tell
     * whatever sent it exactly what gave it away, and the next attempt would
     * leave that field alone. The answer must be indistinguishable from the
     * one a real sender gets.
     */
    it('answers exactly as it does for a real message, but stores nothing', async () => {
      const real = await request(app).post('/api/messages').send(VALID_BODY);

      resetLimits();
      vi.clearAllMocks();

      const trapped = await request(app)
        .post('/api/messages')
        .send({ ...VALID_BODY, website: 'http://spam.example' });

      expect(trapped.status).toBe(real.status);
      expect(trapped.body).toEqual(real.body);
      expect(model.create).not.toHaveBeenCalled();
    });

    /**
     * The half the trap exists for, once mail is configured.
     *
     * Storing nothing was always the point; **notifying nobody** is what stops
     * the trap becoming a relay. Without this, moving the notification above
     * the guard - or keeping it while the guard goes - would forward every bot
     * submission to the owner's real address and spend the send quota of the
     * provider doing it. The behaviour was correct and rested entirely on a
     * sentence in a comment.
     */
    it('notifies nobody about a trapped submission', async () => {
      const { notifyOwnerOfMessage } =
        await import('../../../src/features/message/message.notify.js');

      await request(app)
        .post('/api/messages')
        .send({ ...VALID_BODY, website: 'http://spam.example' });

      expect(vi.mocked(notifyOwnerOfMessage)).not.toHaveBeenCalled();
    });

    // And the other side of it: a real one still reaches the owner.
    it('notifies the owner about a real submission', async () => {
      const { notifyOwnerOfMessage } =
        await import('../../../src/features/message/message.notify.js');

      await request(app).post('/api/messages').send(VALID_BODY);

      expect(vi.mocked(notifyOwnerOfMessage)).toHaveBeenCalledTimes(1);
    });

    /**
     * The sender never waits for the mail server.
     *
     * This endpoint awaited the notification for its whole life, under a
     * comment promising it did not, and against a configured SMTP host that
     * was about 2.7 s of somebody's time per message.
     *
     * The shape of the test is the shape of the failure: the notification is
     * given a promise that never settles, so if the `await` ever comes back
     * this request never returns and the suite times out. There is no weaker
     * version - a fast mock answers identically either way.
     */
    it('answers without waiting for the notification to be delivered', async () => {
      const { notifyOwnerOfMessage } =
        await import('../../../src/features/message/message.notify.js');

      let deliver = () => undefined as void;
      const inFlight = new Promise<boolean>((resolve) => {
        deliver = () => resolve(true);
      });

      vi.mocked(notifyOwnerOfMessage).mockReturnValueOnce(inFlight);

      const response = await request(app)
        .post('/api/messages')
        .send(VALID_BODY);

      expect(response.status).toBe(200);
      expect(vi.mocked(notifyOwnerOfMessage)).toHaveBeenCalledTimes(1);

      // Settled before the test ends, so nothing is left pending for the next.
      deliver();
      await inFlight;
    });

    it('accepts a submission that left it empty, as a browser does', async () => {
      const response = await request(app)
        .post('/api/messages')
        .send({ ...VALID_BODY, website: '' });

      expect(response.status).toBe(200);
      expect(model.create).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * Two limits, because they answer different abuses. A single window cannot
   * do both: set it low enough to stop a burst and a real person who sends
   * a second message an hour later is refused too.
   */
  describe('rate limiting', () => {
    // A script submitting as fast as it can.
    it('refuses a burst from one address', async () => {
      const first = await request(app).post('/api/messages').send(VALID_BODY);
      const second = await request(app).post('/api/messages').send(VALID_BODY);
      const third = await request(app).post('/api/messages').send(VALID_BODY);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(third.status).toBe(429);
      expect(third.body).toEqual({ code: 'TOO_MANY_REQUESTS', details: {} });
      expect(model.create).toHaveBeenCalledTimes(2);
    });

    it('does not count a rejected attempt against a visitor', async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const invalid = await request(app)
          .post('/api/messages')
          .send({ ...VALID_BODY, email: 'not-an-address' });

        expect(invalid.status).toBe(422);
      }

      const accepted = await request(app)
        .post('/api/messages')
        .send(VALID_BODY);

      expect(accepted.status).toBe(200);
    });

    /**
     * The slower, more patient script: never bursting, but still far past what
     * a person sends. Clearing the burst window between each send is what a
     * minute of waiting would do, so only the hourly limit can refuse this.
     */
    it('refuses a slow drip that stays under the burst limit', async () => {
      const statuses: number[] = [];

      for (let attempt = 0; attempt < 6; attempt += 1) {
        contactBurstLimit.resetKey('::ffff:127.0.0.1');
        contactBurstLimit.resetKey('127.0.0.1');
        contactBurstLimit.resetKey('::1');

        const response = await request(app)
          .post('/api/messages')
          .send(VALID_BODY);

        statuses.push(response.status);
      }

      expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
      expect(statuses[5]).toBe(429);
      expect(model.create).toHaveBeenCalledTimes(5);
    });
  });
});

describe('GET /api/messages', () => {
  it('refuses without a session - an inbox is not public', async () => {
    const response = await request(app).get('/api/messages');

    expect(response.status).toBe(401);
  });

  it('lists them newest first, with the unread count', async () => {
    stubList([asDocument()], 1);

    const response = await request(app)
      .get('/api/messages')
      .set('Cookie', await sessionCookie());

    expect(response.status).toBe(200);
    expect(detailsOf(response)).toEqual({
      messages: [
        {
          id: ID,
          ...VALID_BODY,
          read: false,
          receivedAt: RECEIVED_AT.toISOString(),
        },
      ],
      unread: 1,
      page: 0,
      pageSize: 20,
      total: 1,
    });
  });

  it('asks the database for them newest first, one page at a time', async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const skip = vi.fn().mockReturnValue({ limit });
    const sort = vi.fn().mockReturnValue({ skip });
    model.find?.mockReturnValue({ sort });

    await request(app)
      .get('/api/messages')
      .set('Cookie', await sessionCookie());

    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(skip).toHaveBeenCalledWith(0);
    expect(limit).toHaveBeenCalledWith(20);
  });

  it('skips to the page it was asked for', async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const skip = vi.fn().mockReturnValue({ limit });
    model.find?.mockReturnValue({ sort: () => ({ skip }) });

    const response = await request(app)
      .get('/api/messages?page=2')
      .set('Cookie', await sessionCookie());

    expect(skip).toHaveBeenCalledWith(40);
    expect(detailsOf(response).page).toBe(2);
  });

  /**
   * The page comes from a URL, so it can be anything. An inbox should open at
   * the top rather than refuse to open at all.
   */
  it.each(['abc', '-1', '1.5', ''])(
    'treats the unusable page %j as the first one',
    async (page) => {
      const limit = vi.fn().mockResolvedValue([]);
      const skip = vi.fn().mockReturnValue({ limit });
      model.find?.mockReturnValue({ sort: () => ({ skip }) });

      const response = await request(app)
        .get(`/api/messages?page=${page}`)
        .set('Cookie', await sessionCookie());

      expect(response.status).toBe(200);
      expect(skip).toHaveBeenCalledWith(0);
      expect(detailsOf(response).page).toBe(0);
    },
  );
});

describe('PATCH /api/messages/:id/read', () => {
  it('refuses without a session', async () => {
    const response = await request(app)
      .patch(`/api/messages/${ID}/read`)
      .send({ read: true });

    expect(response.status).toBe(401);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // The only mutation a message allows: what was sent is never edited.
  it('sets only the read flag, ignoring anything else sent', async () => {
    model.findOneAndUpdate?.mockResolvedValue(asDocument({ read: true }));

    const response = await request(app)
      .patch(`/api/messages/${ID}/read`)
      .set('Cookie', await sessionCookie())
      .send({ read: true, body: 'rewritten' });

    expect(response.status).toBe(200);

    const [, update] = model.findOneAndUpdate?.mock.calls[0] as [
      unknown,
      Record<string, unknown>,
    ];

    expect(update).toEqual({ $set: { read: true } });
  });

  it('can mark one unread again', async () => {
    model.findOneAndUpdate?.mockResolvedValue(asDocument({ read: false }));

    await request(app)
      .patch(`/api/messages/${ID}/read`)
      .set('Cookie', await sessionCookie())
      .send({ read: false });

    const [, update] = model.findOneAndUpdate?.mock.calls[0] as [
      unknown,
      Record<string, unknown>,
    ];

    expect(update).toEqual({ $set: { read: false } });
  });

  it('answers NOT_FOUND for an id that is not an identifier', async () => {
    const response = await request(app)
      .patch('/api/messages/not-an-id/read')
      .set('Cookie', await sessionCookie())
      .send({ read: true });

    expect(response.status).toBe(404);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/messages/:id', () => {
  it('refuses without a session', async () => {
    const response = await request(app).delete(`/api/messages/${ID}`);

    expect(response.status).toBe(401);
    expect(model.findOneAndDelete).not.toHaveBeenCalled();
  });

  it('deletes the message', async () => {
    model.findOneAndDelete?.mockResolvedValue(asDocument());

    const response = await request(app)
      .delete(`/api/messages/${ID}`)
      .set('Cookie', await sessionCookie());

    expect(response.status).toBe(200);
  });

  it('answers NOT_FOUND when no message has that id', async () => {
    model.findOneAndDelete?.mockResolvedValue(null);

    const response = await request(app)
      .delete(`/api/messages/${ID}`)
      .set('Cookie', await sessionCookie());

    expect(response.status).toBe(404);
  });
});

/**
 * The contract that outranks the notification: a visitor came to leave a
 * message, not to watch us deliver one.
 */
describe('when the notification fails', () => {
  it('still stores the message and still answers 200', async () => {
    const { notifyOwnerOfMessage } =
      await import('../../../src/features/message/message.notify.js');
    vi.mocked(notifyOwnerOfMessage).mockRejectedValueOnce(
      new Error('the mail server is on fire'),
    );

    const response = await request(app).post('/api/messages').send(VALID_BODY);

    expect(response.status).toBe(200);
    expect(model.create).toHaveBeenCalled();
  });
});
