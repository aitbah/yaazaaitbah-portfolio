import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../src/app.js';
import { loginRateLimit } from '../../../src/features/auth/auth.routes.js';
import { ExpertiseModel } from '../../../src/features/expertise/expertise.model.js';
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
/**
 * Deleting a row asks the project feature whether anything still uses it.
 * Stubbed here so this suite keeps testing the expertise endpoints rather than
 * reaching for a database through the real project model.
 */
const projectsUsingRow = vi.fn();

vi.mock('../../../src/features/project/project.service.js', () => ({
  countProjectsUsingExpertise: () => projectsUsingRow() as Promise<number>,
}));
vi.mock('../../../src/features/expertise/expertise.model.js', () => ({
  ExpertiseModel: {
    find: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
    // An update answers with the document *before* the write, so that deciding
    // whether an uploaded logo is now unreferenced happens in the same
    // operation. Reading the result back is the second half of that.
    findById: vi.fn(),
    findOneAndDelete: vi.fn(),
  },
  EXPERTISE_SORT: { order: 1, 'name.en': 1 },
}));

const app = createApp();

const ID = '507f1f77bcf86cd799439022';
const UPDATED_AT = new Date('2026-09-02T10:00:00.000Z');

const VALID_BODY = {
  name: { en: 'TypeScript' },
  category: 'frontend',
  level: 80,
};

/** The shape the service reads: the localized field is a Map on a document. */
function asDocument(body: typeof VALID_BODY, order = 0) {
  return {
    _id: ID,
    id: ID,
    kind: 'technology',
    name: new Map(Object.entries(body.name)),
    category: body.category,
    level: body.level,
    order,
    updatedAt: UPDATED_AT,
  };
}

const model = ExpertiseModel as unknown as {
  find: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  findOneAndUpdate: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
  findOneAndDelete: ReturnType<typeof vi.fn>;
};

function stubList(documents: unknown[]) {
  model.find.mockReturnValue({ sort: () => Promise.resolve(documents) });
}

/** supertest types the body as `any`; narrow it in one place. */
function detailsOf(response: request.Response): Record<string, unknown> {
  return (response.body as { details: Record<string, unknown> }).details;
}

/** MongoDB's duplicate-key error, as the driver raises it. */
const duplicate = Object.assign(new Error('E11000'), { code: 11000 });

let admin: FakeAdmin;

beforeAll(async () => {
  admin = await buildAdmin();
});

beforeEach(() => {
  vi.clearAllMocks();
  stubUserLookup(admin);
  stubList([]);
  // Nothing references the row unless a test says otherwise.
  projectsUsingRow.mockResolvedValue(0);

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

describe('GET /api/technologies', () => {
  it('lists them without a session, since the public site shows them', async () => {
    stubList([asDocument(VALID_BODY)]);

    const response = await request(app).get('/api/technologies');

    expect(response.status).toBe(200);
    expect(detailsOf(response).technologies).toEqual([
      {
        id: ID,
        // Carried even though the resource already says it: the project picker
        // offers technologies and tools in one list and groups them by this.
        kind: 'technology',
        name: { en: 'TypeScript' },
        category: 'frontend',
        level: 80,
        order: 0,
        updatedAt: UPDATED_AT.toISOString(),
      },
    ]);
  });

  // An empty portfolio is a state, not a failure - unlike the single profile,
  // which answers NOT_FOUND because there is nothing to show.
  it('answers with an empty list rather than NOT_FOUND', async () => {
    const response = await request(app).get('/api/technologies');

    expect(response.status).toBe(200);
    expect(detailsOf(response).technologies).toEqual([]);
  });

  it('asks the database for them in display order', async () => {
    const sort = vi.fn().mockResolvedValue([]);
    model.find.mockReturnValue({ sort });

    await request(app).get('/api/technologies');

    expect(sort).toHaveBeenCalledWith({ order: 1, 'name.en': 1 });
  });
});

describe('POST /api/technologies', () => {
  it('refuses without a session', async () => {
    const response = await request(app)
      .post('/api/technologies')
      .send(VALID_BODY);

    expect(response.status).toBe(401);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('creates the row for a signed-in admin', async () => {
    model.create.mockResolvedValue(asDocument(VALID_BODY));

    const response = await request(app)
      .post('/api/technologies')
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(200);
    // The kind comes from the route, never from the body: `/api/technologies`
    // can only ever create a technology.
    expect(model.create).toHaveBeenCalledWith({
      ...VALID_BODY,
      order: 0,
      kind: 'technology',
    });
  });

  it('reports an invalid body per field and stores nothing', async () => {
    const response = await request(app)
      .post('/api/technologies')
      .set('Cookie', await sessionCookie())
      .send({ ...VALID_BODY, level: 140 });

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ level: 'TOO_BIG' });
    expect(model.create).not.toHaveBeenCalled();
  });

  it('answers CONFLICT when the name is already taken', async () => {
    model.create.mockRejectedValue(duplicate);

    const response = await request(app)
      .post('/api/technologies')
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(409);
    expect(detailsOf(response)).toEqual({ 'name.en': 'ALREADY_EXISTS' });
  });
});

describe('PUT /api/technologies/:id', () => {
  it('refuses without a session', async () => {
    const response = await request(app)
      .put(`/api/technologies/${ID}`)
      .send(VALID_BODY);

    expect(response.status).toBe(401);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('replaces the row', async () => {
    model.findOneAndUpdate.mockResolvedValue(asDocument(VALID_BODY, 3));
    model.findById.mockResolvedValue(asDocument(VALID_BODY, 3));

    const response = await request(app)
      .put(`/api/technologies/${ID}`)
      .set('Cookie', await sessionCookie())
      .send({ ...VALID_BODY, order: 3 });

    expect(response.status).toBe(200);
    expect(
      (detailsOf(response).technology as Record<string, unknown>).order,
    ).toBe(3);
  });

  /**
   * Not a replacement: a replacement document carries no `createdAt`, and
   * Mongoose fills the missing one in with the current time, so editing a
   * row would silently reset its creation date. The persistence suite proves
   * the date survives; this proves the call that makes it possible.
   */
  it('sets the fields rather than replacing the document', async () => {
    model.findOneAndUpdate.mockResolvedValue(asDocument(VALID_BODY));
    model.findById.mockResolvedValue(asDocument(VALID_BODY));

    await request(app)
      .put(`/api/technologies/${ID}`)
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    const [, update] = model.findOneAndUpdate.mock.calls[0] as [
      unknown,
      Record<string, unknown>,
    ];

    // The icon was not sent, so it is cleared rather than left behind: PUT
    // replaces, and that is what makes a logo removable at all.
    expect(update).toEqual({
      $set: { ...VALID_BODY, order: 0 },
      $unset: { icon: '' },
    });
  });

  it('answers NOT_FOUND when nothing has that id', async () => {
    model.findOneAndUpdate.mockResolvedValue(null);

    const response = await request(app)
      .put(`/api/technologies/${ID}`)
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(404);
  });

  // A malformed id is a request for something that cannot exist, so it must
  // not surface as a cast failure turned SERVER_ERROR.
  it('answers NOT_FOUND for an id that is not an identifier', async () => {
    const response = await request(app)
      .put('/api/technologies/not-an-id')
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(404);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/technologies/:id', () => {
  it('refuses without a session', async () => {
    const response = await request(app).delete(`/api/technologies/${ID}`);

    expect(response.status).toBe(401);
    expect(model.findOneAndDelete).not.toHaveBeenCalled();
  });

  it('deletes the row', async () => {
    model.findOneAndDelete.mockResolvedValue(asDocument(VALID_BODY));

    const response = await request(app)
      .delete(`/api/technologies/${ID}`)
      .set('Cookie', await sessionCookie());

    expect(response.status).toBe(200);
  });

  it('answers NOT_FOUND when nothing has that id', async () => {
    model.findOneAndDelete.mockResolvedValue(null);

    const response = await request(app)
      .delete(`/api/technologies/${ID}`)
      .set('Cookie', await sessionCookie());

    expect(response.status).toBe(404);
  });

  /**
   * Cascading the removal would change what those projects display without
   * anyone seeing it happen - the admin never opened them.
   */
  it('refuses to delete a row a project still uses', async () => {
    projectsUsingRow.mockResolvedValue(2);

    const response = await request(app)
      .delete(`/api/technologies/${ID}`)
      .set('Cookie', await sessionCookie());

    expect(response.status).toBe(409);
    expect(detailsOf(response)).toEqual({ technology: 'IN_USE', projects: 2 });
    expect(model.findOneAndDelete).not.toHaveBeenCalled();
  });
});

/**
 * The three resources are the separation, so the boundary is where it has to
 * be proved: one implementation serving three paths is only correct if a
 * request can never reach the wrong list.
 */
describe('the three resources', () => {
  it('answers each list under its own name', async () => {
    stubList([]);

    for (const [path, key] of [
      ['/api/skills', 'skills'],
      ['/api/technologies', 'technologies'],
      ['/api/tools', 'tools'],
    ]) {
      const response = await request(app).get(path!);

      expect(response.status).toBe(200);
      expect(detailsOf(response)[key!]).toEqual([]);
    }
  });

  // Reading, writing and deleting all filter by kind, so an id belonging to
  // another list reads as "no such thing" rather than quietly crossing over.
  it('scopes a read to the kind the route names', async () => {
    const sort = vi.fn().mockResolvedValue([]);
    model.find.mockReturnValue({ sort });

    await request(app).get('/api/tools');

    expect(model.find).toHaveBeenCalledWith({ kind: 'tool' });
  });

  it('scopes an update to the kind the route names', async () => {
    model.findOneAndUpdate.mockResolvedValue(asDocument(VALID_BODY));
    model.findById.mockResolvedValue(asDocument(VALID_BODY));

    await request(app)
      .put(`/api/tools/${ID}`)
      .set('Cookie', await sessionCookie())
      .send({ name: { en: 'Docker' }, category: 'devops', level: 80 });

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'tool' }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('scopes a delete to the kind the route names', async () => {
    model.findOneAndDelete.mockResolvedValue(asDocument(VALID_BODY));

    await request(app)
      .delete(`/api/tools/${ID}`)
      .set('Cookie', await sessionCookie());

    expect(model.findOneAndDelete).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'tool' }),
    );
  });
});

describe('a skill has no logo', () => {
  const SKILL = {
    name: { en: 'Problem Solving' },
    category: 'engineering',
    level: 90,
  };

  /**
   * Not merely hidden by the form: the route does not exist, so there is no
   * way to store a file that nothing could ever point at.
   */
  it('does not expose an upload endpoint at all', async () => {
    const response = await request(app)
      .post('/api/skills/icon')
      .set('Cookie', await sessionCookie())
      .set('Content-Type', 'image/png')
      .send(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    expect(response.status).toBe(404);
  });

  it('still exposes one for a technology and a tool', async () => {
    for (const path of ['/api/technologies/icon', '/api/tools/icon']) {
      const response = await request(app)
        .post(path)
        .set('Cookie', await sessionCookie())
        .set('Content-Type', 'image/png')
        .send(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

      // Refused on its bytes, which is the signature check doing its job -
      // the point here is that the route answered at all.
      expect(response.status).not.toBe(404);
    }
  });

  it('refuses a logo in the body, by name', async () => {
    const response = await request(app)
      .post('/api/skills')
      .set('Cookie', await sessionCookie())
      .send({ ...SKILL, icon: { kind: 'preset', value: 'react' } });

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ icon: 'NOT_ALLOWED' });
    expect(model.create).not.toHaveBeenCalled();
  });

  /**
   * There is no test here for a code the option list does not offer: this suite
   * mocks its models, so the check has nothing to read. It is proved against a
   * real database in `option/option.reference.test.ts`.
   */
});
