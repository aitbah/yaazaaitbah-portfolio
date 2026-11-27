import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../src/app.js';
import { mailTestRateLimit } from '../../../src/core/mail/mail.routes.js';
import { mailSettings, sendTestMail } from '../../../src/core/mail/mailer.js';
import { loginRateLimit } from '../../../src/features/auth/auth.routes.js';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  buildAdmin,
  stubUserLookup,
  type FakeAdmin,
} from '../../features/auth/admin.fixture.js';

vi.mock('../../../src/core/mail/mailer.js', () => ({
  mailSettings: vi.fn(),
  sendTestMail: vi.fn(),
  mailIsConfigured: vi.fn(() => true),
}));

vi.mock('../../../src/features/auth/user.model.js', () => ({
  UserModel: {
    findOne: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

const app = createApp();
const settings = vi.mocked(mailSettings);
const testSend = vi.mocked(sendTestMail);

const CONFIGURED = {
  configured: true as const,
  host: 'smtp.example.test',
  port: 587,
  from: 'site@example.test',
  notifyTo: 'owner@example.test',
};

function setCookies(response: request.Response): string[] {
  const raw = (
    response.headers as Record<string, string[] | string | undefined>
  )['set-cookie'];

  if (Array.isArray(raw)) return raw;

  return raw ? [raw] : [];
}

/** supertest types the body as `any`; narrow it in one place. */
function detailsOf(response: request.Response): Record<string, unknown> {
  return (response.body as { details: Record<string, unknown> }).details;
}

let admin: FakeAdmin;

beforeEach(async () => {
  vi.clearAllMocks();
  admin ??= await buildAdmin();
  stubUserLookup(admin);
  settings.mockReturnValue(CONFIGURED);
  testSend.mockResolvedValue(true);

  for (const key of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
    loginRateLimit.resetKey(key);
    mailTestRateLimit.resetKey(key);
  }
});

async function sessionCookie() {
  return setCookies(
    await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  );
}

describe('GET /api/mail/status', () => {
  it('refuses without a session', async () => {
    const response = await request(app).get('/api/mail/status');

    expect(response.status).toBe(401);
  });

  it('answers what the transport is', async () => {
    const response = await request(app)
      .get('/api/mail/status')
      .set('Cookie', await sessionCookie());

    expect(response.status).toBe(200);
    expect(detailsOf(response)).toEqual({ mail: CONFIGURED });
  });

  /**
   * The credentials are not in the response and are not meant to be. The
   * password is obvious; the user is half a credential and knowing it helps
   * nobody who is allowed to look.
   */
  it('never carries the credentials', async () => {
    const response = await request(app)
      .get('/api/mail/status')
      .set('Cookie', await sessionCookie());

    const body = JSON.stringify(response.body);
    expect(body).not.toMatch(/password/i);
    expect(body).not.toMatch(/SMTP_USER/i);
  });

  it('says so when nothing is configured', async () => {
    settings.mockReturnValue({ configured: false });

    const response = await request(app)
      .get('/api/mail/status')
      .set('Cookie', await sessionCookie());

    expect(detailsOf(response)).toEqual({ mail: { configured: false } });
  });
});

describe('POST /api/mail/test', () => {
  it('refuses without a session and sends nothing', async () => {
    const response = await request(app).post('/api/mail/test');

    expect(response.status).toBe(401);
    expect(testSend).not.toHaveBeenCalled();
  });

  it('sends, and names where it went', async () => {
    const response = await request(app)
      .post('/api/mail/test')
      .set('Cookie', await sessionCookie());

    expect(response.status).toBe(200);
    expect(detailsOf(response)).toEqual({ sentTo: 'owner@example.test' });
    expect(testSend).toHaveBeenCalled();
  });

  /**
   * The whole point of the endpoint. `sendMail` answers `false` and logs, which
   * is right for a contact form that must not fail because mail did - but here
   * the send *is* the request, so a refusal has to be an error rather than a
   * success with a quiet flag.
   */
  it('reports a refused send as a failure, not a success', async () => {
    testSend.mockResolvedValue(false);

    const response = await request(app)
      .post('/api/mail/test')
      .set('Cookie', await sessionCookie());

    expect(response.status).toBe(503);
    expect(detailsOf(response)).toEqual({ mail: 'SEND_FAILED' });
  });

  it('distinguishes an unconfigured transport, and does not try', async () => {
    settings.mockReturnValue({ configured: false });

    const response = await request(app)
      .post('/api/mail/test')
      .set('Cookie', await sessionCookie());

    expect(response.status).toBe(503);
    expect(detailsOf(response)).toEqual({ mail: 'NOT_CONFIGURED' });
    expect(testSend).not.toHaveBeenCalled();
  });

  // Not against the owner: against a stuck page, a double click or a retry
  // loop, at a provider that counts messages.
  it('limits repeated sends', async () => {
    const cookie = await sessionCookie();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app).post('/api/mail/test').set('Cookie', cookie);
    }

    const response = await request(app)
      .post('/api/mail/test')
      .set('Cookie', cookie);

    expect(response.status).toBe(429);
  });
});
