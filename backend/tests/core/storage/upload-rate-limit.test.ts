import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../src/app.js';
import { loginRateLimit } from '../../../src/features/auth/auth.routes.js';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  buildAdmin,
  stubUserLookup,
} from '../../features/auth/admin.fixture.js';

vi.mock('../../../src/features/auth/user.model.js', () => ({
  UserModel: {
    findOne: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

// Its own file on purpose: the limiter counts per process, so it needs a store
// no other test has already spent.
const app = createApp();

const UPLOAD_MAX_ATTEMPTS = 20;

let admin: Awaited<ReturnType<typeof buildAdmin>>;

beforeEach(async () => {
  admin ??= await buildAdmin();
  stubUserLookup(admin);

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
 * The order of `requireAuth` and the upload limiter, which nothing pinned.
 *
 * `auth.routes.ts` states the rule and says why: a limiter ahead of the auth
 * check spends its budget on requests that were never going to be allowed, so
 * an anonymous flood consumes the owner's allowance and locks them out of their
 * own form. The upload routes had it the other way round, and no test noticed
 * because both orders answer every single request identically. Only the
 * twenty-first one tells them apart.
 */
describe('an anonymous flood at an upload endpoint', () => {
  it('is refused for the right reason, however long it goes on', async () => {
    for (let attempt = 0; attempt < UPLOAD_MAX_ATTEMPTS + 5; attempt += 1) {
      const response = await request(app)
        .post('/api/profile/photo')
        .set('Content-Type', 'image/png')
        .send(Buffer.from('not really a png'));

      // Never TOO_MANY_REQUESTS: an unsigned token is rejected before it is
      // counted, so the flood never reaches the limiter at all.
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        code: 'UNAUTHENTICATED',
        details: {},
      });
    }
  });

  it('leaves the owner able to upload afterwards', async () => {
    for (let attempt = 0; attempt < UPLOAD_MAX_ATTEMPTS + 5; attempt += 1) {
      await request(app)
        .post('/api/profile/photo')
        .set('Content-Type', 'image/png')
        .send(Buffer.from('not really a png'));
    }

    const owner = await request(app)
      .post('/api/profile/photo')
      .set('Cookie', await sessionCookie())
      .set('Content-Type', 'image/png')
      .send(Buffer.from('not really a png'));

    // Rejected on the bytes, which is the endpoint working. The budget the
    // flood was aimed at was never touched.
    expect(owner.status).not.toBe(429);
  });
});
