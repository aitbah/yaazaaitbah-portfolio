import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../src/app.js';
import { loginRateLimit } from '../../../src/features/auth/auth.routes.js';
import { OptionModel } from '../../../src/features/option/option.model.js';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  buildAdmin,
  stubUserLookup,
  type FakeAdmin,
} from '../auth/admin.fixture.js';

/**
 * How many rows the delete guard should find. Hoisted so the mock factory -
 * which runs before this file's own module body - can close over it.
 */
const usage = vi.hoisted(() => ({ rows: 0 }));

vi.mock('../../../src/features/auth/user.model.js', () => ({
  UserModel: {
    findOne: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));
vi.mock('../../../src/features/option/option.model.js', () => ({
  OptionModel: {
    find: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
    exists: vi.fn(),
  },
  OPTION_SORT: { order: 1, 'name.en': 1 },
}));
vi.mock('../../../src/features/option/option.usage.js', () => ({
  // Every list answers the same way here: which collection a list counts in is
  // proved against a real database in `option.persistence.test.ts`.
  OPTION_USAGE: new Proxy(
    {},
    { get: () => () => Promise.resolve(usage.rows) },
  ) as Record<string, (code: string) => Promise<number>>,
}));

const app = createApp();

const ID = '507f1f77bcf86cd799439077';
const UPDATED_AT = new Date('2026-09-07T10:00:00.000Z');

const VALID_BODY = {
  list: 'education-level',
  code: 'bachelor',
  name: { en: "Bachelor's degree" },
};

function asDocument(body: Record<string, unknown> = {}) {
  const merged = { ...VALID_BODY, ...body };

  return {
    _id: ID,
    id: ID,
    list: merged.list,
    code: merged.code,
    name: new Map(Object.entries(merged.name)),
    group: undefined,
    icon: undefined,
    order: 0,
    updatedAt: UPDATED_AT,
  };
}

const model = OptionModel as unknown as Record<
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
  loginRateLimit.resetKey('::ffff:127.0.0.1');
  loginRateLimit.resetKey('127.0.0.1');
  stubUserLookup(admin);
  usage.rows = 0;
  stubList([]);
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

describe('GET /api/options', () => {
  /**
   * Public, like the content it labels: a public page showing an employment
   * type needs the words for it, and a label is not a secret.
   */
  it('lists them without a session', async () => {
    stubList([asDocument()]);

    const response = await request(app).get('/api/options');

    expect(response.status).toBe(200);
    expect(detailsOf(response).options).toEqual([
      {
        id: ID,
        list: 'education-level',
        code: 'bachelor',
        name: { en: "Bachelor's degree" },
        order: 0,
        updatedAt: UPDATED_AT.toISOString(),
      },
    ]);
  });

  it('asks for every list when none is named', async () => {
    await request(app).get('/api/options');

    expect(model.find).toHaveBeenCalledWith({});
  });

  it('filters to one list when one is named', async () => {
    await request(app).get('/api/options?list=skill-category');

    expect(model.find).toHaveBeenCalledWith({ list: 'skill-category' });
  });

  // A typo in a list name must not read as "every list": a client asking for
  // something that does not exist should be told, not quietly given everything.
  it('refuses a list nobody declared', async () => {
    const response = await request(app).get('/api/options?list=nonsense');

    expect(response.status).toBe(422);
    expect(model.find).not.toHaveBeenCalled();
  });
});

describe('POST /api/options', () => {
  it('refuses an anonymous write and stores nothing', async () => {
    const response = await request(app).post('/api/options').send(VALID_BODY);

    expect(response.status).toBe(401);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('creates the option for a signed-in admin', async () => {
    model.create?.mockResolvedValue(asDocument());

    const response = await request(app)
      .post('/api/options')
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(200);
    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({ list: 'education-level', code: 'bachelor' }),
    );
  });

  it('refuses a body naming no list', async () => {
    const response = await request(app)
      .post('/api/options')
      .set('Cookie', await sessionCookie())
      .send({ code: 'bachelor', name: { en: 'Bachelor' } });

    expect(response.status).toBe(422);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('reports a malformed code on the code', async () => {
    const response = await request(app)
      .post('/api/options')
      .set('Cookie', await sessionCookie())
      .send({ ...VALID_BODY, code: 'Not A Code' });

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ code: 'INVALID_CODE' });
  });

  it('answers CONFLICT when that code is already in the list', async () => {
    model.create?.mockRejectedValue({
      code: 11000,
      message: 'E11000 duplicate key error … index: list_1_code_1',
    });

    const response = await request(app)
      .post('/api/options')
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(409);
    expect(detailsOf(response)).toEqual({ code: 'CODE_TAKEN' });
  });

  /**
   * Two unique indexes cover this collection, and a client can only fix what it
   * can see - so the conflict is reported at the field the admin typed in.
   */
  it('reports a duplicate name on the name', async () => {
    model.create?.mockRejectedValue({
      code: 11000,
      message: 'E11000 duplicate key error … index: list_1_name.en_1',
    });

    const response = await request(app)
      .post('/api/options')
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(409);
    expect(detailsOf(response)).toEqual({ 'name.en': 'ALREADY_EXISTS' });
  });
});

describe('PUT /api/options/:id', () => {
  it('refuses an anonymous write', async () => {
    const response = await request(app)
      .put(`/api/options/${ID}`)
      .send({ list: 'education-level', name: { en: 'Bachelor' } });

    expect(response.status).toBe(401);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('renames the option', async () => {
    model.findOneAndUpdate?.mockResolvedValue(
      asDocument({ name: { en: 'Bachelor' } }),
    );

    const response = await request(app)
      .put(`/api/options/${ID}`)
      .set('Cookie', await sessionCookie())
      .send({ list: 'education-level', name: { en: 'Bachelor' } });

    expect(response.status).toBe(200);
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ list: 'education-level' }),
      expect.anything(),
      expect.anything(),
    );
  });

  /**
   * Rows point at the code, so changing one would strand every row holding it.
   * Refused rather than dropped, so a client that tried is told.
   */
  it('refuses a body that carries a code', async () => {
    const response = await request(app)
      .put(`/api/options/${ID}`)
      .set('Cookie', await sessionCookie())
      .send({ list: 'education-level', code: 'other', name: { en: 'Other' } });

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ code: 'NOT_ALLOWED' });
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('answers NOT_FOUND when nothing in that list has that id', async () => {
    model.findOneAndUpdate?.mockResolvedValue(null);

    const response = await request(app)
      .put(`/api/options/${ID}`)
      .set('Cookie', await sessionCookie())
      .send({ list: 'education-level', name: { en: 'Bachelor' } });

    expect(response.status).toBe(404);
  });
});

describe('PUT /api/options/reorder', () => {
  // Mounted before the ':id' route, so `reorder` is never read as an id.
  it('is a route rather than an identifier', async () => {
    const response = await request(app)
      .put('/api/options/reorder')
      .set('Cookie', await sessionCookie())
      .send({ list: 'education-level', ids: ['not-an-id'] });

    expect(response.status).toBe(422);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('refuses an anonymous reorder', async () => {
    const response = await request(app)
      .put('/api/options/reorder')
      .send({ list: 'education-level', ids: [ID] });

    expect(response.status).toBe(401);
  });
});

describe('DELETE /api/options/:id', () => {
  it('refuses an anonymous delete', async () => {
    const response = await request(app).delete(`/api/options/${ID}`);

    expect(response.status).toBe(401);
    expect(model.deleteOne).not.toHaveBeenCalled();
  });

  it('removes an option nothing points at', async () => {
    model.findById?.mockResolvedValue(asDocument());

    const response = await request(app)
      .delete(`/api/options/${ID}`)
      .set('Cookie', await sessionCookie());

    expect(response.status).toBe(200);
    expect(model.deleteOne).toHaveBeenCalled();
  });

  it('refuses one a stored row still holds, and says how many', async () => {
    model.findById?.mockResolvedValue(asDocument());
    usage.rows = 3;

    const response = await request(app)
      .delete(`/api/options/${ID}`)
      .set('Cookie', await sessionCookie());

    expect(response.status).toBe(409);
    expect(detailsOf(response)).toEqual({ option: 'IN_USE', rows: 3 });
    expect(model.deleteOne).not.toHaveBeenCalled();
  });

  it('answers NOT_FOUND for an id nothing has', async () => {
    model.findById?.mockResolvedValue(null);

    const response = await request(app)
      .delete(`/api/options/${ID}`)
      .set('Cookie', await sessionCookie());

    expect(response.status).toBe(404);
  });
});
