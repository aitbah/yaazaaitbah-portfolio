import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../src/app.js';
import { loginRateLimit } from '../../../src/features/auth/auth.routes.js';
import { LanguageModel } from '../../../src/features/language/language.model.js';
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
vi.mock('../../../src/features/language/language.model.js', () => ({
  LanguageModel: {
    find: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findOneAndDelete: vi.fn(),
  },
  LANGUAGE_SORT: { order: 1, code: 1 },
}));

const app = createApp();

const ID = '507f1f77bcf86cd799439099';
const UPDATED_AT = new Date('2026-09-05T10:00:00.000Z');

const VALID_BODY = { code: 'fr', level: 'c1' };

function asDocument(body: Record<string, unknown> = {}) {
  const merged = { ...VALID_BODY, order: 0, ...body };

  return { _id: ID, id: ID, ...merged, updatedAt: UPDATED_AT };
}

const model = LanguageModel as unknown as Record<
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

describe('GET /api/languages', () => {
  it('lists them without a session, since the public site shows them', async () => {
    stubList([asDocument()]);

    const response = await request(app).get('/api/languages');

    expect(response.status).toBe(200);
    expect(detailsOf(response).languages).toEqual([
      {
        id: ID,
        code: 'fr',
        level: 'c1',
        order: 0,
        updatedAt: UPDATED_AT.toISOString(),
      },
    ]);
  });

  /**
   * The name is the client's to render from the code, in the reader's own
   * locale. A stored name would be one more thing to translate per language per
   * locale, and would be wrong on every page written in another language.
   */
  it('carries the code and no name at all', async () => {
    stubList([asDocument()]);

    const [row] = detailsOf(await request(app).get('/api/languages'))
      .languages as Record<string, unknown>[];

    expect(row).not.toHaveProperty('name');
    expect(row?.code).toBe('fr');
  });

  it('asks the database for them in the stored order', async () => {
    const sort = vi.fn().mockResolvedValue([]);
    model.find?.mockReturnValue({ sort });

    await request(app).get('/api/languages');

    expect(sort).toHaveBeenCalledWith({ order: 1, code: 1 });
  });
});

describe('POST /api/languages', () => {
  it('refuses an anonymous write and stores nothing', async () => {
    const response = await request(app).post('/api/languages').send(VALID_BODY);

    expect(response.status).toBe(401);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('creates the language for a signed-in admin', async () => {
    model.create?.mockResolvedValue(asDocument());

    const response = await request(app)
      .post('/api/languages')
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(200);
    expect(model.create).toHaveBeenCalledWith(VALID_BODY);
  });

  it('refuses a subtag the picker does not offer', async () => {
    const response = await request(app)
      .post('/api/languages')
      .set('Cookie', await sessionCookie())
      .send({ ...VALID_BODY, code: 'xx' });

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ code: 'INVALID_VALUE' });
    expect(model.create).not.toHaveBeenCalled();
  });

  /**
   * There is no test here for a code the option list does not offer: this suite
   * mocks its models, so the check has nothing to read. It is proved against a
   * real database in `option/option.reference.test.ts`.
   */

  it('answers CONFLICT when that language is already listed', async () => {
    model.create?.mockRejectedValue({ code: 11000 });

    const response = await request(app)
      .post('/api/languages')
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(409);
    // Its own code, not the name one: a duplicate language is a duplicate
    // subtag, and "that name is already taken" names nothing on the form.
    expect(detailsOf(response)).toEqual({ code: 'CODE_TAKEN' });
  });
});

describe('PUT and DELETE /api/languages/:id', () => {
  it('replaces the language', async () => {
    model.findOneAndUpdate?.mockResolvedValue(asDocument({ level: 'native' }));

    const response = await request(app)
      .put(`/api/languages/${ID}`)
      .set('Cookie', await sessionCookie())
      .send({ ...VALID_BODY, level: 'native' });

    expect(response.status).toBe(200);
    expect(
      (detailsOf(response).language as Record<string, unknown>).level,
    ).toBe('native');
  });

  it('answers NOT_FOUND when the id is not an identifier', async () => {
    const response = await request(app)
      .put('/api/languages/nope')
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(404);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('deletes the language', async () => {
    model.findOneAndDelete?.mockResolvedValue(asDocument());

    const response = await request(app)
      .delete(`/api/languages/${ID}`)
      .set('Cookie', await sessionCookie());

    expect(response.status).toBe(200);
  });

  it('refuses an anonymous delete', async () => {
    const response = await request(app).delete(`/api/languages/${ID}`);

    expect(response.status).toBe(401);
    expect(model.findOneAndDelete).not.toHaveBeenCalled();
  });
});

/**
 * A language list has no date to sort by, so unlike the three sections before
 * it this one *does* reorder - through the same endpoint and the same shared
 * helper the expertise and social-link lists use.
 */
describe('PUT /api/languages/reorder', () => {
  it('is a route rather than an id', async () => {
    const response = await request(app)
      .put('/api/languages/reorder')
      .set('Cookie', await sessionCookie())
      .send({ ids: [ID] });

    // It reached the reorder handler rather than being read as an identifier,
    // which the mocked model cannot complete - but never a 404 from `:id`.
    expect(response.status).not.toBe(404);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('refuses an anonymous reorder', async () => {
    const response = await request(app)
      .put('/api/languages/reorder')
      .send({ ids: [ID] });

    expect(response.status).toBe(401);
  });

  it('refuses a body that is not a list of ids', async () => {
    const response = await request(app)
      .put('/api/languages/reorder')
      .set('Cookie', await sessionCookie())
      .send({ ids: ['not-an-id'] });

    expect(response.status).toBe(422);
  });
});
