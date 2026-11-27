import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../src/app.js';
import { loginRateLimit } from '../../../src/features/auth/auth.routes.js';
import { CredentialModel } from '../../../src/features/credential/credential.model.js';
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
vi.mock('../../../src/features/credential/credential.model.js', () => ({
  CredentialModel: {
    find: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findOneAndDelete: vi.fn(),
  },
  CREDENTIAL_SORT: { issuedAt: -1, createdAt: -1 },
}));

const app = createApp();

const ID = '507f1f77bcf86cd799439088';
const UPDATED_AT = new Date('2026-09-05T10:00:00.000Z');

const VALID_BODY = {
  name: { en: 'AWS Certified Developer' },
  issuer: { en: 'Amazon Web Services' },
  issuedAt: '2023-04',
  expiresAt: '2026-04',
};

/** The shape the service reads: localized fields are Maps on a document. */
function asDocument(
  body: Record<string, unknown> = {},
  kind = 'certification',
) {
  const merged = { ...VALID_BODY, ...body };

  return {
    _id: ID,
    id: ID,
    kind,
    name: new Map(Object.entries(merged.name)),
    issuer: new Map(Object.entries(merged.issuer)),
    issuedAt: merged.issuedAt,
    expiresAt: merged.expiresAt,
    credentialId: undefined,
    credentialUrl: undefined,
    description: undefined,
    updatedAt: UPDATED_AT,
  };
}

const model = CredentialModel as unknown as Record<
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

/**
 * Two resources from one factory, and the separation is only real if the kind
 * comes from the route. These run against both, so a rule proved for one is
 * proved for the shape rather than for the URL that happened to be tested.
 */
const RESOURCES = [
  ['certification', '/api/certifications', 'certifications'],
  ['course', '/api/courses', 'courses'],
] as const;

describe.each(RESOURCES)('GET %s', (kind, path, envelope) => {
  it('lists it without a session, since the public site shows it', async () => {
    stubList([asDocument({}, kind)]);

    const response = await request(app).get(path);

    expect(response.status).toBe(200);
    expect(detailsOf(response)[envelope]).toEqual([
      {
        id: ID,
        kind,
        name: { en: 'AWS Certified Developer' },
        issuer: { en: 'Amazon Web Services' },
        issuedAt: '2023-04',
        expiresAt: '2026-04',
        updatedAt: UPDATED_AT.toISOString(),
      },
    ]);
  });

  /**
   * The envelope is the plural the resource is mounted under. `${kind}s` would
   * have given "certifications" by luck and is exactly the derivation that
   * produced "technologys" once already.
   */
  it('answers under the resource name, not a generic key', async () => {
    const response = await request(app).get(path);

    expect(Object.keys(detailsOf(response))).toEqual([envelope]);
    expect(detailsOf(response)[envelope]).toEqual([]);
  });

  it('asks the database for its own kind, most recent first', async () => {
    const sort = vi.fn().mockResolvedValue([]);
    model.find?.mockReturnValue({ sort });

    await request(app).get(path);

    expect(model.find).toHaveBeenCalledWith({ kind });
    expect(sort).toHaveBeenCalledWith({ issuedAt: -1, createdAt: -1 });
  });

  // Absent stays absent rather than becoming an empty value, which a client
  // would have to know to treat as "not filled in".
  it('omits the optional fields that hold nothing', async () => {
    stubList([asDocument({}, kind)]);

    const [row] = detailsOf(await request(app).get(path))[envelope] as Record<
      string,
      unknown
    >[];

    expect(row).not.toHaveProperty('credentialId');
    expect(row).not.toHaveProperty('credentialUrl');
    expect(row).not.toHaveProperty('description');
  });
});

describe.each(RESOURCES)('POST %s', (kind, path) => {
  it('refuses an anonymous write and stores nothing', async () => {
    const response = await request(app).post(path).send(VALID_BODY);

    expect(response.status).toBe(401);
    expect(model.create).not.toHaveBeenCalled();
  });

  /** The kind comes from the route, so the body can never choose it. */
  it('stamps the kind from the route, not from the body', async () => {
    model.create?.mockResolvedValue(asDocument({}, kind));

    const response = await request(app)
      .post(path)
      .set('Cookie', await sessionCookie())
      // A body that tries to be the other kind, and is ignored.
      .send({ ...VALID_BODY, kind: 'something-else' });

    expect(response.status).toBe(200);
    expect(model.create).toHaveBeenCalledWith({ ...VALID_BODY, kind });
  });

  it('reports an invalid body per field and stores nothing', async () => {
    const response = await request(app)
      .post(path)
      .set('Cookie', await sessionCookie())
      .send({ ...VALID_BODY, issuedAt: 'April 2023' });

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ issuedAt: 'INVALID_MONTH' });
    expect(model.create).not.toHaveBeenCalled();
  });

  /**
   * The decision this entity turns on. An expired certification is a true fact
   * about someone's history, and a validator that refused it would be refusing
   * the truth - the admin marks it expired instead.
   */
  it('accepts a credential that has already expired', async () => {
    // Issued long ago and expired long ago, which is an ordinary history and
    // not a contradiction - the expiry still follows the issue.
    const expired = { issuedAt: '2016-01', expiresAt: '2019-01' };

    model.create?.mockResolvedValue(asDocument(expired, kind));

    const response = await request(app)
      .post(path)
      .set('Cookie', await sessionCookie())
      .send({ ...VALID_BODY, ...expired });

    expect(response.status).toBe(200);
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining(expired));
  });

  it('accepts a credential that never expires', async () => {
    model.create?.mockResolvedValue(asDocument({ expiresAt: undefined }, kind));

    const response = await request(app)
      .post(path)
      .set('Cookie', await sessionCookie())
      .send({ ...VALID_BODY, expiresAt: undefined });

    expect(response.status).toBe(200);
  });

  it('refuses an expiry that precedes the issue', async () => {
    const response = await request(app)
      .post(path)
      .set('Cookie', await sessionCookie())
      .send({ ...VALID_BODY, expiresAt: '2022-01' });

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ expiresAt: 'BEFORE_ISSUE' });
    expect(model.create).not.toHaveBeenCalled();
  });

  it('refuses a credential URL that is not an http(s) link', async () => {
    const response = await request(app)
      .post(path)
      .set('Cookie', await sessionCookie())
      .send({ ...VALID_BODY, credentialUrl: 'javascript:alert(1)' });

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ credentialUrl: 'INVALID_URL' });
    expect(model.create).not.toHaveBeenCalled();
  });

  it('answers CONFLICT when the same credential exists', async () => {
    model.create?.mockRejectedValue({ code: 11000 });

    const response = await request(app)
      .post(path)
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(409);
    expect(detailsOf(response)).toEqual({ 'name.en': 'ALREADY_EXISTS' });
  });
});

describe.each(RESOURCES)('PUT and DELETE %s', (kind, path) => {
  it('scopes the update to its own kind', async () => {
    model.findOneAndUpdate?.mockResolvedValue(asDocument({}, kind));

    await request(app)
      .put(`${path}/${ID}`)
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ kind }),
      expect.anything(),
      expect.anything(),
    );
  });

  // An id belonging to the other kind is not this resource's to change.
  it('answers NOT_FOUND when the id belongs to the other kind', async () => {
    model.findOneAndUpdate?.mockResolvedValue(null);

    const response = await request(app)
      .put(`${path}/${ID}`)
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(404);
  });

  it('answers NOT_FOUND when the id is not an identifier', async () => {
    const response = await request(app)
      .put(`${path}/nope`)
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(404);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('scopes the delete to its own kind', async () => {
    model.findOneAndDelete?.mockResolvedValue(asDocument({}, kind));

    const response = await request(app)
      .delete(`${path}/${ID}`)
      .set('Cookie', await sessionCookie());

    expect(response.status).toBe(200);
    expect(model.findOneAndDelete).toHaveBeenCalledWith(
      expect.objectContaining({ kind }),
    );
  });

  it('refuses an anonymous delete', async () => {
    const response = await request(app).delete(`${path}/${ID}`);

    expect(response.status).toBe(401);
    expect(model.findOneAndDelete).not.toHaveBeenCalled();
  });
});

/**
 * A credential is placed by when it was issued. There is no reorder endpoint,
 * and adding one would create a stored position that could disagree with the
 * date without the admin being able to see it.
 */
describe('there is no reorder endpoint', () => {
  it.each(RESOURCES)('reads `reorder` as an id on %s', async (_kind, path) => {
    const response = await request(app)
      .put(`${path}/reorder`)
      .set('Cookie', await sessionCookie())
      // A valid body, so nothing but the path can be what is refused.
      .send(VALID_BODY);

    expect(response.status).toBe(404);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
