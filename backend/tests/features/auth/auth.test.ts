import type * as argon2 from '@node-rs/argon2';
import { verify } from '@node-rs/argon2';
import request from 'supertest';
import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';

import { createApp } from '../../../src/app.js';
import { UserModel } from '../../../src/features/auth/user.model.js';
import {
  loginRateLimit,
  passwordRateLimit,
} from '../../../src/features/auth/auth.routes.js';
import {
  ADMIN_EMAIL,
  ADMIN_ID,
  ADMIN_PASSWORD,
  buildAdmin,
  stubUserLookup,
  type FakeAdmin,
} from './admin.fixture.js';

// Spied, not replaced: the real Argon2 must still run for the timing guarantee
// to mean anything - the test only counts how often it does.
vi.mock('@node-rs/argon2', async (importOriginal) => {
  const actual = await importOriginal<typeof argon2>();

  return { ...actual, verify: vi.fn(actual.verify) };
});

vi.mock('../../../src/features/auth/user.model.js', () => ({
  UserModel: {
    findOne: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

const app = createApp();

const EXPECTED_USER = { id: ADMIN_ID, email: ADMIN_EMAIL, role: 'admin' };

function setCookies(response: request.Response): string[] {
  const raw = (
    response.headers as Record<string, string[] | string | undefined>
  )['set-cookie'];

  if (Array.isArray(raw)) return raw;

  return raw ? [raw] : [];
}

function login(credentials: Record<string, unknown>) {
  return request(app).post('/api/auth/login').send(credentials);
}

/** supertest types the body as `any`; narrow it in one place. */
function detailsOf(response: request.Response): Record<string, unknown> {
  return (response.body as { details: Record<string, unknown> }).details;
}

/** How many times Argon2 actually ran, to tell an early return from a check. */
function verifyCalls() {
  return (verify as unknown as Mock).mock.calls.length;
}

function revokeCalls() {
  const model = UserModel as unknown as { findByIdAndUpdate: Mock };

  return model.findByIdAndUpdate.mock.calls;
}

let admin: FakeAdmin;

beforeAll(async () => {
  admin = await buildAdmin();
});

beforeEach(() => {
  vi.clearAllMocks();
  stubUserLookup(admin);

  // Reset login rate limits between tests to prevent test interference.
  for (const key of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
    loginRateLimit.resetKey(key);
    passwordRateLimit.resetKey(key);
  }
});

describe('POST /api/auth/login', () => {
  it('authenticates the admin and sets an HttpOnly session cookie', async () => {
    const response = await login({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      code: 'SUCCESS',
      details: { user: EXPECTED_USER },
    });

    const [cookie] = setCookies(response);
    expect(cookie).toMatch(/^session=/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('never echoes the password or its hash', async () => {
    const response = await login({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    const body = JSON.stringify(response.body);

    expect(body).not.toContain(ADMIN_PASSWORD);
    expect(body).not.toContain('argon2');
    expect(body).not.toContain('passwordHash');
  });

  it('rejects a wrong password with INVALID_CREDENTIALS and no cookie', async () => {
    const response = await login({ email: ADMIN_EMAIL, password: 'wrong-one' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: 'INVALID_CREDENTIALS',
      details: {},
    });
    expect(setCookies(response)).toEqual([]);
  });

  it('answers an unknown email exactly like a wrong password', async () => {
    stubUserLookup(null);

    const response = await login({
      email: 'nobody@example.com',
      password: ADMIN_PASSWORD,
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: 'INVALID_CREDENTIALS',
      details: {},
    });
  });

  // The content already matched; this is about the cost. Returning early for an
  // unknown email would skip Argon2 and make it measurably faster, which
  // enumerates valid addresses regardless of what the body says.
  it('spends the same verification on an unknown email as on a wrong password', async () => {
    stubUserLookup(null);
    const unknown = await login({
      email: 'nobody@example.com',
      password: 'whatever-they-typed',
    });

    stubUserLookup(admin);
    const wrong = await login({
      email: ADMIN_EMAIL,
      password: 'not-the-password',
    });

    expect(unknown.status).toBe(wrong.status);
    expect(unknown.body).toEqual(wrong.body);
    expect(verifyCalls()).toBe(2);
  });

  it('reports malformed input as VALIDATION_ERROR with per-field codes', async () => {
    const response = await login({ email: 'not-an-email' });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      code: 'VALIDATION_ERROR',
      details: { email: 'INVALID_EMAIL', password: 'REQUIRED' },
    });
  });
});

describe('GET /api/auth/me', () => {
  async function sessionCookie() {
    const response = await login({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    return setCookies(response)[0] ?? '';
  }

  it('returns the admin for a valid session', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Cookie', await sessionCookie());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      code: 'SUCCESS',
      details: { user: EXPECTED_USER },
    });
  });

  it('rejects a request with no cookie', async () => {
    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ code: 'UNAUTHENTICATED', details: {} });
  });

  it('rejects a malformed or tampered token', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Cookie', 'session=not.a.jwt');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ code: 'UNAUTHENTICATED', details: {} });
  });

  it('rejects a valid token whose account no longer exists', async () => {
    const cookie = await sessionCookie();
    stubUserLookup(null);

    const response = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ code: 'UNAUTHENTICATED', details: {} });
  });
});

describe('GET /api/auth/session', () => {
  const NOBODY = { code: 'SUCCESS', details: { user: null } };

  it('returns the admin for a valid session', async () => {
    const cookie = setCookies(
      await login({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    );

    const response = await request(app)
      .get('/api/auth/session')
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      code: 'SUCCESS',
      details: { user: EXPECTED_USER },
    });
  });

  // "Nobody" is an answer here, so the login page does not log an error.
  it('answers nobody, not 401, with no cookie', async () => {
    const response = await request(app).get('/api/auth/session');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(NOBODY);
  });

  it('answers nobody for a tampered token', async () => {
    const response = await request(app)
      .get('/api/auth/session')
      .set('Cookie', 'session=not.a.jwt');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(NOBODY);
  });

  it('answers nobody for a revoked session', async () => {
    const cookie = setCookies(
      await login({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    );
    stubUserLookup({ ...admin, tokenVersion: admin.tokenVersion + 1 });

    const response = await request(app)
      .get('/api/auth/session')
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(NOBODY);
  });
});

describe('session revocation', () => {
  // Tokens are stateless, so without a version a signed one stays usable until
  // it expires and signing out would revoke nothing.
  it('rejects a token issued before the sessions were revoked', async () => {
    const cookie = setCookies(
      await login({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    );

    // The stored version moved on; the cookie still carries the old one.
    stubUserLookup({ ...admin, tokenVersion: admin.tokenVersion + 1 });

    const response = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ code: 'UNAUTHENTICATED', details: {} });
  });

  it('still accepts a token whose version matches', async () => {
    const cookie = setCookies(
      await login({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    );

    const response = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
  });

  it('bumps the stored version when a live session signs out', async () => {
    const cookie = setCookies(
      await login({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    );

    await request(app).post('/api/auth/logout').set('Cookie', cookie);

    // The account and the increment, not the options beside them: this is
    // about the revocation happening, and `returnDocument` is how the caller
    // reads the new version back rather than part of the claim.
    expect(revokeCalls()).toEqual([
      [ADMIN_ID, { $inc: { tokenVersion: 1 } }, expect.anything()],
    ]);
  });

  // Signing out must work when the cookie is already useless.
  it('revokes nothing when there is no valid session to revoke', async () => {
    const response = await request(app).post('/api/auth/logout');

    expect(response.status).toBe(200);
    expect(revokeCalls()).toEqual([]);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the session cookie', async () => {
    const response = await request(app).post('/api/auth/logout');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ code: 'SUCCESS', details: {} });

    const [cookie] = setCookies(response);
    expect(cookie).toMatch(/^session=;/);
    expect(cookie).toContain('Expires=Thu, 01 Jan 1970');
  });
});

/**
 * The endpoint that did not exist: until now the only way to change the
 * password was to re-run `admin:create` inside the container.
 */
describe('PUT /api/auth/password', () => {
  const NEW_PASSWORD = 'a-longer-different-passphrase';

  async function sessionCookie() {
    return setCookies(
      await login({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    );
  }

  function change(cookie: string[], body: Record<string, unknown>) {
    return request(app)
      .put('/api/auth/password')
      .set('Cookie', cookie)
      .send(body);
  }

  it('refuses without a session and writes nothing', async () => {
    const response = await request(app).put('/api/auth/password').send({
      currentPassword: ADMIN_PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    expect(response.status).toBe(401);
    expect(revokeCalls()).toEqual([]);
  });

  it('replaces the hash and revokes every session in one update', async () => {
    const response = await change(await sessionCookie(), {
      currentPassword: ADMIN_PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    expect(response.status).toBe(200);

    const [id, update] = revokeCalls()[0] as [string, Record<string, never>];
    expect(id).toBe(ADMIN_ID);
    expect(update).toMatchObject({ $inc: { tokenVersion: 1 } });

    /**
     * One update rather than two. A password changed without the old sessions
     * dying is the failure this endpoint exists to prevent, and separate writes
     * leave a window in which that is exactly the state.
     */
    const { $set } = update as unknown as { $set: { passwordHash: string } };
    expect(typeof $set.passwordHash).toBe('string');
  });

  // The stored value is a hash. Storing the password itself would be the worst
  // possible outcome of a screen whose whole subject is the password.
  it('never stores the new password as given', async () => {
    await change(await sessionCookie(), {
      currentPassword: ADMIN_PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    const [, update] = revokeCalls()[0] as [
      string,
      { $set: { passwordHash: string } },
    ];

    expect(update.$set.passwordHash).not.toBe(NEW_PASSWORD);
    expect(update.$set.passwordHash).toMatch(/^\$argon2/);
    expect(await verify(update.$set.passwordHash, NEW_PASSWORD)).toBe(true);
  });

  /**
   * The tab that made the change stays signed in, from the version that
   * replaced every other one. Logging the owner out of the screen they are
   * looking at would teach them to avoid doing this.
   */
  it('re-issues this session so the current device survives it', async () => {
    const response = await change(await sessionCookie(), {
      currentPassword: ADMIN_PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    const [cookie] = setCookies(response);
    expect(cookie).toMatch(/^session=/);
    expect(cookie).toContain('HttpOnly');
  });

  /**
   * A stolen session cookie must not be enough to lock the owner out of their
   * own site, which is the whole reason the current password is asked for.
   */
  it('refuses a wrong current password and writes nothing', async () => {
    const response = await change(await sessionCookie(), {
      currentPassword: 'not-the-current-one',
      newPassword: NEW_PASSWORD,
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: 'INVALID_CREDENTIALS',
      details: {},
    });
    expect(revokeCalls()).toEqual([]);
  });

  it('refuses a new password shorter than the policy allows', async () => {
    const response = await change(await sessionCookie(), {
      currentPassword: ADMIN_PASSWORD,
      newPassword: 'short',
    });

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ newPassword: 'TOO_SMALL' });
    expect(revokeCalls()).toEqual([]);
  });

  // A change that changes nothing is not a change, and reporting it as success
  // would leave the owner believing they had rotated a password they had not.
  it('refuses a new password equal to the current one', async () => {
    const response = await change(await sessionCookie(), {
      currentPassword: ADMIN_PASSWORD,
      newPassword: ADMIN_PASSWORD,
    });

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ newPassword: 'UNCHANGED' });
    expect(revokeCalls()).toEqual([]);
  });

  /**
   * The same attack login is limited against, one step further in: a stolen
   * session guessing the current password in order to change it.
   */
  it('rate-limits repeated attempts', async () => {
    const cookie = await sessionCookie();

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await change(cookie, {
        currentPassword: 'wrong',
        newPassword: NEW_PASSWORD,
      });
    }

    const response = await change(cookie, {
      currentPassword: ADMIN_PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    expect(response.status).toBe(429);
  });
});

/**
 * The other credential nothing could rotate. Changing the address is changing
 * the account's identity, so it is guarded exactly as the password is.
 */
describe('PUT /api/auth/email', () => {
  const NEW_EMAIL = 'moved@example.test';

  async function sessionCookie() {
    return setCookies(
      await login({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    );
  }

  function change(cookie: string[], body: Record<string, unknown>) {
    return request(app).put('/api/auth/email').set('Cookie', cookie).send(body);
  }

  it('refuses without a session and writes nothing', async () => {
    const response = await request(app).put('/api/auth/email').send({
      currentPassword: ADMIN_PASSWORD,
      newEmail: NEW_EMAIL,
    });

    expect(response.status).toBe(401);
    expect(revokeCalls()).toEqual([]);
  });

  /**
   * One update, for the reason the password change gives - and the revocation
   * matters more here. If the cookie was stolen, this is the endpoint the thief
   * wants, and the version bump is what ends their session too.
   */
  it('writes the address and revokes every session in one update', async () => {
    const response = await change(await sessionCookie(), {
      currentPassword: ADMIN_PASSWORD,
      newEmail: NEW_EMAIL,
    });

    expect(response.status).toBe(200);

    const [id, update] = revokeCalls()[0] as [string, Record<string, unknown>];
    expect(id).toBe(ADMIN_ID);
    expect(update).toEqual({
      $set: { email: NEW_EMAIL },
      $inc: { tokenVersion: 1 },
    });
  });

  it('re-issues this session so the current device survives it', async () => {
    const response = await change(await sessionCookie(), {
      currentPassword: ADMIN_PASSWORD,
      newEmail: NEW_EMAIL,
    });

    const [cookie] = setCookies(response);
    expect(cookie).toMatch(/^session=/);
    expect(cookie).toContain('HttpOnly');
  });

  // Unlike the password change, which answers with nothing: the client cannot
  // derive the new address from what it holds, and it is what the sidebar and
  // the account page display.
  it('answers with the account as it now stands', async () => {
    const response = await change(await sessionCookie(), {
      currentPassword: ADMIN_PASSWORD,
      newEmail: NEW_EMAIL,
    });

    expect(detailsOf(response)).toEqual({
      user: { ...EXPECTED_USER, email: NEW_EMAIL },
    });
  });

  it('refuses a wrong current password and writes nothing', async () => {
    const response = await change(await sessionCookie(), {
      currentPassword: 'not-the-current-one',
      newEmail: NEW_EMAIL,
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: 'INVALID_CREDENTIALS',
      details: {},
    });
    expect(revokeCalls()).toEqual([]);
  });

  it('refuses something that is not an address', async () => {
    const response = await change(await sessionCookie(), {
      currentPassword: ADMIN_PASSWORD,
      newEmail: 'not-an-address',
    });

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ newEmail: 'INVALID_EMAIL' });
    expect(revokeCalls()).toEqual([]);
  });

  /**
   * The unique index cannot catch this one: the row it would collide with is
   * the owner's own. Writing it anyway would report a save that changed nothing
   * and revoke every session for it.
   */
  it('refuses the address already stored, and revokes nothing', async () => {
    const response = await change(await sessionCookie(), {
      currentPassword: ADMIN_PASSWORD,
      newEmail: ADMIN_EMAIL,
    });

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ newEmail: 'UNCHANGED' });
    expect(revokeCalls()).toEqual([]);
  });

  /**
   * One budget with the password change, because it is one guess being
   * limited. Separate budgets would double the attempts available for the same
   * question - the current password.
   */
  it('shares its rate limit with the password change', async () => {
    const cookie = await sessionCookie();

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await request(app)
        .put('/api/auth/password')
        .set('Cookie', cookie)
        .send({ currentPassword: 'wrong', newPassword: 'a-long-enough-one' });
    }

    const response = await change(cookie, {
      currentPassword: ADMIN_PASSWORD,
      newEmail: NEW_EMAIL,
    });

    expect(response.status).toBe(429);
  });
});

/**
 * "Sign out everywhere else" - the revocation that already existed in the code
 * and was reachable from nowhere.
 */
describe('POST /api/auth/revoke', () => {
  it('refuses without a session', async () => {
    const response = await request(app).post('/api/auth/revoke');

    expect(response.status).toBe(401);
    expect(revokeCalls()).toEqual([]);
  });

  it('bumps the version and keeps this device signed in', async () => {
    const cookie = setCookies(
      await login({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    );

    const response = await request(app)
      .post('/api/auth/revoke')
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(revokeCalls()).toEqual([
      [ADMIN_ID, { $inc: { tokenVersion: 1 } }, expect.anything()],
    ]);
    expect(setCookies(response)[0]).toMatch(/^session=/);
  });

  // Unlike signing out, there is nothing to sign back in as.
  it('answers UNAUTHENTICATED when the account has since gone', async () => {
    const cookie = setCookies(
      await login({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    );
    const model = UserModel as unknown as { findByIdAndUpdate: Mock };
    model.findByIdAndUpdate.mockResolvedValue(null);

    const response = await request(app)
      .post('/api/auth/revoke')
      .set('Cookie', cookie);

    expect(response.status).toBe(401);
  });
});
