import nodemailer, { type Transporter } from 'nodemailer';

import { env } from '../../config/env.js';
import { logger } from '../logging/logger.js';

/**
 * The one place that talks to an SMTP server.
 *
 * Optional on purpose. Mail is the part of this system most likely to be down,
 * misconfigured, or not set up at all - so nothing that matters is allowed to
 * depend on it, and the application starts and serves identically without it.
 */

export type Mail = {
  to: string;
  subject: string;
  /** Plain text only. There is no markup to inject into, so nothing to escape. */
  text: string;
  /** Where a reply goes, when that is not the sender we authenticate as. */
  replyTo?: string;
};

let transport: Transporter | null = null;

function build(): Transporter | null {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = env;

  if (!SMTP_HOST || !SMTP_PORT) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    // 465 is TLS from the first byte; everything else negotiates with
    // STARTTLS. Derived rather than configured, because the two are not
    // independent choices and a mismatch fails in a way that reads like a
    // firewall problem.
    secure: SMTP_PORT === 465,
    auth:
      SMTP_USER && SMTP_PASSWORD
        ? { user: SMTP_USER, pass: SMTP_PASSWORD }
        : undefined,
  });
}

/** Whether anything will actually be sent, for callers that want to say so. */
export function mailIsConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT);
}

/**
 * Sends, and answers whether it went - never throws, so a mail outage cannot
 * fail a request that already succeeded. Failures log at `error`, since nothing
 * else will notice.
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  if (!mailIsConfigured()) {
    return false;
  }

  transport ??= build();

  if (!transport || !env.SMTP_FROM) {
    return false;
  }

  try {
    await transport.sendMail({
      from: env.SMTP_FROM,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      replyTo: mail.replyTo,
    });

    return true;
  } catch (error) {
    // The recipient is logged, never the body: it is someone else's message.
    logger.error({ err: error, to: mail.to }, 'Could not send mail');

    return false;
  }
}

export type MailSettings = {
  configured: boolean;
  host?: string;
  port?: number;
  from?: string;
  notifyTo?: string;
};

/**
 * What the admin may know about the transport.
 *
 * **`SMTP_USER` and `SMTP_PASSWORD` are absent, and that is the point.** The
 * password is obvious; the user is here too because it is half a credential and
 * knowing it helps nobody who is allowed to look. Everything returned is
 * something the owner configured and can already read in their own `.env`.
 */
export function mailSettings(): MailSettings {
  if (!mailIsConfigured()) {
    return { configured: false };
  }

  return {
    configured: true,
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    from: env.SMTP_FROM,
    notifyTo: env.CONTACT_NOTIFY_TO,
  };
}

/**
 * Proves the transport end to end, which is the one thing configuration alone
 * cannot: credentials are only wrong at the moment they are used.
 *
 * The message is entirely ours. No caller supplies any part of it, so there is
 * nothing to validate and nothing anyone can put into an envelope.
 */
export async function sendTestMail(): Promise<boolean> {
  if (!env.CONTACT_NOTIFY_TO) {
    return false;
  }

  return sendMail({
    to: env.CONTACT_NOTIFY_TO,
    subject: 'Portfolio: test message',
    text: [
      'This is a test, sent from the admin.',
      '',
      'If it reached you, the contact form can reach you too.',
    ].join('\n'),
  });
}

/** Said once at startup, so "no mail arrived" is answerable without guessing. */
export function reportMailConfiguration() {
  if (mailIsConfigured()) {
    logger.info({ host: env.SMTP_HOST, port: env.SMTP_PORT }, 'Mail enabled');

    return;
  }

  logger.info('Mail is not configured; notifications are off');
}
