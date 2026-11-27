import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../src/app.js';
import { loginRateLimit } from '../../../src/features/auth/auth.routes.js';
import { EducationModel } from '../../../src/features/education/education.model.js';
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
vi.mock('../../../src/features/education/education.model.js', () => ({
  EducationModel: {
    find: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findOneAndDelete: vi.fn(),
  },
  EDUCATION_SORT: { startDate: -1, createdAt: -1 },
}));

const app = createApp();

const ID = '507f1f77bcf86cd799439077';
const UPDATED_AT = new Date('2026-09-05T10:00:00.000Z');

const VALID_BODY = {
  institution: { en: 'University of Casablanca' },
  qualification: { en: 'BSc Computer Science' },
  level: 'bachelor',
  startDate: '2015-09',
  endDate: '2018-06',
  current: false,
};

/** The shape the service reads: localized fields are Maps on a document. */
function asDocument(body: Record<string, unknown> = {}) {
  const merged = { ...VALID_BODY, ...body };

  return {
    _id: ID,
    id: ID,
    institution: new Map(Object.entries(merged.institution)),
    qualification: new Map(Object.entries(merged.qualification)),
    fieldOfStudy: undefined,
    level: merged.level,
    location: undefined,
    startDate: merged.startDate,
    endDate: merged.endDate,
    current: merged.current,
    description: undefined,
    updatedAt: UPDATED_AT,
  };
}

const model = EducationModel as unknown as Record<
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

describe('GET /api/education', () => {
  it('lists it without a session, since the public site shows it', async () => {
    stubList([asDocument()]);

    const response = await request(app).get('/api/education');

    expect(response.status).toBe(200);
    expect(detailsOf(response).education).toEqual([
      {
        id: ID,
        institution: { en: 'University of Casablanca' },
        qualification: { en: 'BSc Computer Science' },
        level: 'bachelor',
        startDate: '2015-09',
        endDate: '2018-06',
        current: false,
        updatedAt: UPDATED_AT.toISOString(),
      },
    ]);
  });

  it('answers with an empty list rather than NOT_FOUND', async () => {
    const response = await request(app).get('/api/education');

    expect(response.status).toBe(200);
    expect(detailsOf(response).education).toEqual([]);
  });

  it('asks the database for it most recent first', async () => {
    const sort = vi.fn().mockResolvedValue([]);
    model.find?.mockReturnValue({ sort });

    await request(app).get('/api/education');

    expect(sort).toHaveBeenCalledWith({ startDate: -1, createdAt: -1 });
  });

  // Absent stays absent rather than becoming an empty object, which a client
  // would have to know to treat as "not filled in".
  it('omits the optional fields that hold nothing', async () => {
    stubList([asDocument()]);

    const [row] = detailsOf(await request(app).get('/api/education'))
      .education as Record<string, unknown>[];

    expect(row).not.toHaveProperty('fieldOfStudy');
    expect(row).not.toHaveProperty('location');
    expect(row).not.toHaveProperty('description');
  });
});

describe('POST /api/education', () => {
  it('refuses an anonymous write and stores nothing', async () => {
    const response = await request(app).post('/api/education').send(VALID_BODY);

    expect(response.status).toBe(401);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('creates the entry for a signed-in admin', async () => {
    model.create?.mockResolvedValue(asDocument());

    const response = await request(app)
      .post('/api/education')
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(200);
    expect(model.create).toHaveBeenCalledWith({ ...VALID_BODY });
  });

  it('reports an invalid body per field and stores nothing', async () => {
    const response = await request(app)
      .post('/api/education')
      .set('Cookie', await sessionCookie())
      .send({ ...VALID_BODY, startDate: 'September 2015' });

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ startDate: 'INVALID_MONTH' });
    expect(model.create).not.toHaveBeenCalled();
  });

  /**
   * There is no test here for a code the option list does not offer: this suite
   * mocks its models, so the check has nothing to read. It is proved against a
   * real database in `option/option.reference.test.ts`.
   */

  /**
   * The same shared rule a career uses, so it reaches the client the same way:
   * a code on the field it is about, never a banner.
   */
  it('reports a period that contradicts itself on the end date', async () => {
    const response = await request(app)
      .post('/api/education')
      .set('Cookie', await sessionCookie())
      .send({ ...VALID_BODY, current: true });

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ endDate: 'NOT_ALLOWED' });
    expect(model.create).not.toHaveBeenCalled();
  });

  it('refuses an end before the start', async () => {
    const response = await request(app)
      .post('/api/education')
      .set('Cookie', await sessionCookie())
      .send({ ...VALID_BODY, endDate: '2014-06' });

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ endDate: 'BEFORE_START' });
  });

  it('answers CONFLICT when the same entry exists', async () => {
    model.create?.mockRejectedValue({ code: 11000 });

    const response = await request(app)
      .post('/api/education')
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(409);
    expect(detailsOf(response)).toEqual({
      'institution.en': 'ALREADY_EXISTS',
    });
  });
});

describe('PUT /api/education/:id', () => {
  it('replaces the entry', async () => {
    model.findOneAndUpdate?.mockResolvedValue(asDocument());

    const response = await request(app)
      .put(`/api/education/${ID}`)
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(200);
    expect(
      (detailsOf(response).entry as Record<string, unknown>).startDate,
    ).toBe('2015-09');
  });

  it('answers NOT_FOUND when nothing has that id', async () => {
    model.findOneAndUpdate?.mockResolvedValue(null);

    const response = await request(app)
      .put(`/api/education/${ID}`)
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(404);
  });

  it('answers NOT_FOUND when the id is not an identifier', async () => {
    const response = await request(app)
      .put('/api/education/nope')
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(404);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/education/:id', () => {
  it('deletes the entry', async () => {
    model.findOneAndDelete?.mockResolvedValue(asDocument());

    const response = await request(app)
      .delete(`/api/education/${ID}`)
      .set('Cookie', await sessionCookie());

    expect(response.status).toBe(200);
  });

  it('refuses an anonymous delete', async () => {
    const response = await request(app).delete(`/api/education/${ID}`);

    expect(response.status).toBe(401);
    expect(model.findOneAndDelete).not.toHaveBeenCalled();
  });

  it('answers NOT_FOUND when nothing has that id', async () => {
    model.findOneAndDelete?.mockResolvedValue(null);

    const response = await request(app)
      .delete(`/api/education/${ID}`)
      .set('Cookie', await sessionCookie());

    expect(response.status).toBe(404);
  });
});

/**
 * What someone studied is ordered by when they studied it. There is no reorder
 * endpoint, and adding one would create a stored position that could disagree
 * with the dates without the admin being able to see it.
 */
describe('there is no reorder endpoint', () => {
  it('reads `reorder` as an id, not as a route', async () => {
    const response = await request(app)
      .put('/api/education/reorder')
      .set('Cookie', await sessionCookie())
      // A valid body, so nothing but the path can be what is refused.
      .send(VALID_BODY);

    expect(response.status).toBe(404);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
