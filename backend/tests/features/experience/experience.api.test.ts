import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../src/app.js';
import { loginRateLimit } from '../../../src/features/auth/auth.routes.js';
import { ExperienceModel } from '../../../src/features/experience/experience.model.js';
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
vi.mock('../../../src/features/experience/experience.model.js', () => ({
  ExperienceModel: {
    find: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findOneAndDelete: vi.fn(),
  },
  EXPERIENCE_SORT: { startDate: -1, createdAt: -1 },
}));

const app = createApp();

const ID = '507f1f77bcf86cd799439066';
const UPDATED_AT = new Date('2026-09-04T10:00:00.000Z');

const VALID_BODY = {
  role: { en: 'Backend Engineer' },
  organisation: { en: 'Acme' },
  employmentType: 'full-time',
  startDate: '2021-03',
  endDate: '2023-06',
  current: false,
};

/** The shape the service reads: localized fields are Maps on a document. */
function asDocument(body: Record<string, unknown> = {}) {
  const merged = { ...VALID_BODY, ...body };

  return {
    _id: ID,
    id: ID,
    role: new Map(Object.entries(merged.role)),
    organisation: new Map(Object.entries(merged.organisation)),
    location: undefined,
    employmentType: merged.employmentType,
    startDate: merged.startDate,
    endDate: merged.endDate,
    current: merged.current,
    description: undefined,
    updatedAt: UPDATED_AT,
  };
}

const model = ExperienceModel as unknown as Record<
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

describe('GET /api/experience', () => {
  it('lists it without a session, since the public site shows it', async () => {
    stubList([asDocument()]);

    const response = await request(app).get('/api/experience');

    expect(response.status).toBe(200);
    expect(detailsOf(response).experience).toEqual([
      {
        id: ID,
        role: { en: 'Backend Engineer' },
        organisation: { en: 'Acme' },
        employmentType: 'full-time',
        startDate: '2021-03',
        endDate: '2023-06',
        current: false,
        updatedAt: UPDATED_AT.toISOString(),
      },
    ]);
  });

  it('answers with an empty list rather than NOT_FOUND', async () => {
    const response = await request(app).get('/api/experience');

    expect(response.status).toBe(200);
    expect(detailsOf(response).experience).toEqual([]);
  });

  it('asks the database for it most recent first', async () => {
    const sort = vi.fn().mockResolvedValue([]);
    model.find?.mockReturnValue({ sort });

    await request(app).get('/api/experience');

    expect(sort).toHaveBeenCalledWith({ startDate: -1, createdAt: -1 });
  });

  // Absent stays absent rather than becoming an empty object, which a client
  // would have to know to treat as "not filled in".
  it('omits the optional fields that hold nothing', async () => {
    stubList([asDocument()]);

    const [row] = detailsOf(await request(app).get('/api/experience'))
      .experience as Record<string, unknown>[];

    expect(row).not.toHaveProperty('location');
    expect(row).not.toHaveProperty('description');
  });
});

describe('POST /api/experience', () => {
  it('refuses an anonymous write and stores nothing', async () => {
    const response = await request(app)
      .post('/api/experience')
      .send(VALID_BODY);

    expect(response.status).toBe(401);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('creates the position for a signed-in admin', async () => {
    model.create?.mockResolvedValue(asDocument());

    const response = await request(app)
      .post('/api/experience')
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(200);
    expect(model.create).toHaveBeenCalledWith({ ...VALID_BODY });
  });

  it('reports an invalid body per field and stores nothing', async () => {
    const response = await request(app)
      .post('/api/experience')
      .set('Cookie', await sessionCookie())
      .send({ ...VALID_BODY, startDate: 'March 2021' });

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ startDate: 'INVALID_MONTH' });
    expect(model.create).not.toHaveBeenCalled();
  });

  /**
   * The cross-field rule reaches the client as a code on the field it is about,
   * exactly like every other validation error - not as a banner.
   */
  it('reports a period that contradicts itself on the end date', async () => {
    const response = await request(app)
      .post('/api/experience')
      .set('Cookie', await sessionCookie())
      .send({ ...VALID_BODY, current: true });

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ endDate: 'NOT_ALLOWED' });
    expect(model.create).not.toHaveBeenCalled();
  });

  it('answers CONFLICT when the same position exists', async () => {
    model.create?.mockRejectedValue({ code: 11000 });

    const response = await request(app)
      .post('/api/experience')
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(409);
    expect(detailsOf(response)).toEqual({ 'role.en': 'ALREADY_EXISTS' });
  });
});

describe('PUT /api/experience/:id', () => {
  it('replaces the position', async () => {
    model.findOneAndUpdate?.mockResolvedValue(asDocument());

    const response = await request(app)
      .put(`/api/experience/${ID}`)
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(200);
    expect(
      (detailsOf(response).position as Record<string, unknown>).startDate,
    ).toBe('2021-03');
  });

  it('answers NOT_FOUND when nothing has that id', async () => {
    model.findOneAndUpdate?.mockResolvedValue(null);

    const response = await request(app)
      .put(`/api/experience/${ID}`)
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(404);
  });

  it('answers NOT_FOUND when the id is not an identifier', async () => {
    const response = await request(app)
      .put('/api/experience/nope')
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(404);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/experience/:id', () => {
  it('deletes the position', async () => {
    model.findOneAndDelete?.mockResolvedValue(asDocument());

    const response = await request(app)
      .delete(`/api/experience/${ID}`)
      .set('Cookie', await sessionCookie());

    expect(response.status).toBe(200);
  });

  it('refuses an anonymous delete', async () => {
    const response = await request(app).delete(`/api/experience/${ID}`);

    expect(response.status).toBe(401);
    expect(model.findOneAndDelete).not.toHaveBeenCalled();
  });

  it('answers NOT_FOUND when nothing has that id', async () => {
    model.findOneAndDelete?.mockResolvedValue(null);

    const response = await request(app)
      .delete(`/api/experience/${ID}`)
      .set('Cookie', await sessionCookie());

    expect(response.status).toBe(404);
  });
});

/**
 * A career is ordered by when things happened. There is no reorder endpoint,
 * and adding one would create a stored position that could disagree with the
 * dates without the admin being able to see it.
 */
describe('there is no reorder endpoint', () => {
  it('reads `reorder` as an id, not as a route', async () => {
    const response = await request(app)
      .put('/api/experience/reorder')
      .set('Cookie', await sessionCookie())
      // A valid body, so nothing but the path can be what is refused.
      .send(VALID_BODY);

    expect(response.status).toBe(404);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
