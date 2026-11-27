import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../src/app.js';
import { loginRateLimit } from '../../../src/features/auth/auth.routes.js';
import { SocialLinkModel } from '../../../src/features/social-link/social-link.model.js';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  buildAdmin,
  stubUserLookup,
  type FakeAdmin,
} from '../auth/admin.fixture.js';

vi.mock('../../../src/features/option/option.lookup.js', () => ({
  // These suites mock their models, so there are no option rows for the real
  // check to read. That a level or a category must be one the owner offers is
  // proved against a real database in `option/option.reference.test.ts`.
  assertOptionExists: vi.fn(),
  assertOptionalOptionExists: vi.fn(),
}));
vi.mock('../../../src/features/auth/user.model.js', () => ({
  UserModel: {
    findOne: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));
vi.mock('../../../src/features/social-link/social-link.model.js', () => ({
  SocialLinkModel: {
    find: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findOneAndDelete: vi.fn(),
  },
  SOCIAL_LINK_SORT: { order: 1, platform: 1 },
}));

const app = createApp();

const ID = '507f1f77bcf86cd799439044';
const UPDATED_AT = new Date('2026-09-02T10:00:00.000Z');

const VALID_BODY = { platform: 'github', url: 'https://github.com/me' };

function asDocument(body: Record<string, unknown> = {}) {
  return {
    _id: ID,
    id: ID,
    ...VALID_BODY,
    order: 0,
    updatedAt: UPDATED_AT,
    ...body,
  };
}

const model = SocialLinkModel as unknown as Record<
  string,
  ReturnType<typeof vi.fn>
>;

function stubList(documents: unknown[]) {
  model.find?.mockReturnValue({ sort: () => Promise.resolve(documents) });
}

/** supertest types the body as `any`; narrow it in one place. */
function detailsOf(response: request.Response): Record<string, unknown> {
  return (response.body as { details: Record<string, unknown> }).details;
}

let admin: FakeAdmin;

beforeAll(async () => {
  admin = await buildAdmin();
});

beforeEach(() => {
  vi.clearAllMocks();
  stubUserLookup(admin);
  stubList([]);

  for (const key of ['127.0.0.1', '::1']) {
    loginRateLimit.resetKey(key);
  }
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

describe('GET /api/social-links', () => {
  it('lists them without a session, since the public site shows them', async () => {
    stubList([asDocument()]);

    const response = await request(app).get('/api/social-links');

    expect(response.status).toBe(200);
    expect(detailsOf(response).socialLinks).toEqual([
      {
        id: ID,
        platform: 'github',
        url: 'https://github.com/me',
        order: 0,
        updatedAt: UPDATED_AT.toISOString(),
      },
    ]);
  });

  it('answers with an empty list rather than NOT_FOUND', async () => {
    const response = await request(app).get('/api/social-links');

    expect(response.status).toBe(200);
    expect(detailsOf(response).socialLinks).toEqual([]);
  });

  it('asks the database for them in display order', async () => {
    const sort = vi.fn().mockResolvedValue([]);
    model.find?.mockReturnValue({ sort });

    await request(app).get('/api/social-links');

    expect(sort).toHaveBeenCalledWith({ order: 1, platform: 1 });
  });
});

describe('POST /api/social-links', () => {
  it('refuses without a session', async () => {
    const response = await request(app)
      .post('/api/social-links')
      .send(VALID_BODY);

    expect(response.status).toBe(401);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('creates the link for a signed-in admin', async () => {
    model.create?.mockResolvedValue(asDocument());

    const response = await request(app)
      .post('/api/social-links')
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(200);
    expect(model.create).toHaveBeenCalledWith({ ...VALID_BODY, order: 0 });
  });

  it('answers CONFLICT when the same link already exists', async () => {
    model.create?.mockRejectedValue(
      Object.assign(new Error('E11000'), { code: 11000 }),
    );

    const response = await request(app)
      .post('/api/social-links')
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(409);
    expect(detailsOf(response)).toEqual({ url: 'URL_TAKEN' });
  });

  // Rendered as an href, so the protocol matters as much as it does anywhere.
  it.each(['javascript:alert(1)', 'data:text/html,x', '/uploads/a.png'])(
    'rejects the URL %s and stores nothing',
    async (url) => {
      const response = await request(app)
        .post('/api/social-links')
        .set('Cookie', await sessionCookie())
        .send({ ...VALID_BODY, url });

      expect(response.status).toBe(422);
      expect(detailsOf(response)).toEqual({ url: 'INVALID_URL' });
      expect(model.create).not.toHaveBeenCalled();
    },
  );

  it('reports an unchosen platform as required, not as a wrong value', async () => {
    const response = await request(app)
      .post('/api/social-links')
      .set('Cookie', await sessionCookie())
      .send({ url: 'https://github.com/me' });

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ platform: 'REQUIRED' });
  });

  /**
   * There is no test here for a code the option list does not offer: this suite
   * mocks its models, so the check has nothing to read. It is proved against a
   * real database in `option/option.reference.test.ts`.
   */
});

describe('PUT /api/social-links/:id', () => {
  it('refuses without a session', async () => {
    const response = await request(app)
      .put(`/api/social-links/${ID}`)
      .send(VALID_BODY);

    expect(response.status).toBe(401);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  /**
   * Not a replacement, though the effect is one: a replacement document carries
   * no `createdAt`, and Mongoose fills the missing one in with the current
   * time.
   */
  it('sets the fields rather than replacing the document', async () => {
    model.findOneAndUpdate?.mockResolvedValue(asDocument());

    await request(app)
      .put(`/api/social-links/${ID}`)
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    const [, update] = model.findOneAndUpdate?.mock.calls[0] as [
      unknown,
      Record<string, unknown>,
    ];

    expect(update).toEqual({ $set: { ...VALID_BODY, order: 0 } });
  });

  it('answers NOT_FOUND when no link has that id', async () => {
    model.findOneAndUpdate?.mockResolvedValue(null);

    const response = await request(app)
      .put(`/api/social-links/${ID}`)
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(404);
  });

  it('answers NOT_FOUND for an id that is not an identifier', async () => {
    const response = await request(app)
      .put('/api/social-links/not-an-id')
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(404);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/social-links/:id', () => {
  it('refuses without a session', async () => {
    const response = await request(app).delete(`/api/social-links/${ID}`);

    expect(response.status).toBe(401);
    expect(model.findOneAndDelete).not.toHaveBeenCalled();
  });

  it('deletes the link', async () => {
    model.findOneAndDelete?.mockResolvedValue(asDocument());

    const response = await request(app)
      .delete(`/api/social-links/${ID}`)
      .set('Cookie', await sessionCookie());

    expect(response.status).toBe(200);
  });

  it('answers NOT_FOUND when no link has that id', async () => {
    model.findOneAndDelete?.mockResolvedValue(null);

    const response = await request(app)
      .delete(`/api/social-links/${ID}`)
      .set('Cookie', await sessionCookie());

    expect(response.status).toBe(404);
  });
});
