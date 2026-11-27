import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMailStub = vi.fn();
// Typed with its argument, so the assertions below can read what was passed:
// a no-argument mock infers an empty tuple and `calls[0][0]` will not compile.
const createTransport = vi.fn((_options: Record<string, unknown>) => ({
  sendMail: sendMailStub,
}));

vi.mock('nodemailer', () => ({
  default: { createTransport },
  createTransport,
}));

/**
 * The environment is read at import time, so each case builds its own module
 * graph rather than trying to change one that has already been loaded.
 */
async function loadMailer(smtp: Record<string, unknown>) {
  vi.resetModules();
  vi.doMock('../../../src/config/env.js', () => ({
    env: {
      NODE_ENV: 'test',
      // The logger reads this at import time and is pulled in by the mailer.
      LOG_LEVEL: 'silent',
      FRONTEND_URL: 'http://localhost:3000',
      ...smtp,
    },
  }));

  return import('../../../src/core/mail/mailer.js');
}

const CONFIGURED = {
  SMTP_HOST: 'smtp.example.test',
  SMTP_PORT: 587,
  SMTP_FROM: 'site@example.test',
  CONTACT_NOTIFY_TO: 'owner@example.test',
};

const MAIL = {
  to: 'owner@example.test',
  subject: 'A subject',
  text: 'A body',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the mailer without configuration', () => {
  /**
   * The state the project is in today, and the one a deployment starts in. It
   * has to be indistinguishable from working, from the caller's side.
   */
  it('reports itself off and sends nothing', async () => {
    const mailer = await loadMailer({});

    expect(mailer.mailIsConfigured()).toBe(false);
    expect(await mailer.sendMail(MAIL)).toBe(false);
    expect(createTransport).not.toHaveBeenCalled();
  });
});

describe('the mailer with configuration', () => {
  it('sends from the configured address', async () => {
    const mailer = await loadMailer(CONFIGURED);

    expect(
      await mailer.sendMail({ ...MAIL, replyTo: 'them@example.test' }),
    ).toBe(true);
    expect(sendMailStub).toHaveBeenCalledWith({
      from: 'site@example.test',
      to: 'owner@example.test',
      subject: 'A subject',
      text: 'A body',
      replyTo: 'them@example.test',
    });
  });

  /**
   * A transport built once and kept. Building one per message would open a
   * connection per message, which is the thing a pool exists to avoid.
   */
  it('builds the transport once', async () => {
    const mailer = await loadMailer(CONFIGURED);

    await mailer.sendMail(MAIL);
    await mailer.sendMail(MAIL);

    expect(createTransport).toHaveBeenCalledTimes(1);
  });

  // 465 is TLS from the first byte; everything else negotiates with STARTTLS.
  // A mismatch here fails in a way that reads like a firewall problem.
  it('derives the encryption from the port', async () => {
    await (await loadMailer({ ...CONFIGURED, SMTP_PORT: 465 })).sendMail(MAIL);
    expect(createTransport.mock.calls[0]?.[0]).toMatchObject({ secure: true });

    vi.clearAllMocks();

    await (await loadMailer({ ...CONFIGURED, SMTP_PORT: 587 })).sendMail(MAIL);
    expect(createTransport.mock.calls[0]?.[0]).toMatchObject({ secure: false });
  });

  it('omits authentication when there are no credentials', async () => {
    await (await loadMailer(CONFIGURED)).sendMail(MAIL);

    expect(createTransport.mock.calls[0]?.[0]).toMatchObject({
      auth: undefined,
    });
  });

  it('authenticates when there are', async () => {
    await (
      await loadMailer({
        ...CONFIGURED,
        SMTP_USER: 'someone',
        SMTP_PASSWORD: 'a-secret',
      })
    ).sendMail(MAIL);

    expect(createTransport.mock.calls[0]?.[0]).toMatchObject({
      auth: { user: 'someone', pass: 'a-secret' },
    });
  });

  /**
   * The whole reason this answers instead of throwing. Every caller is telling
   * somebody about something that already happened and is already stored - a
   * transport that is down must not turn that into a failed request.
   */
  it('answers false when the server refuses, rather than throwing', async () => {
    const mailer = await loadMailer(CONFIGURED);
    sendMailStub.mockRejectedValueOnce(new Error('connection refused'));

    await expect(mailer.sendMail(MAIL)).resolves.toBe(false);
  });
});
