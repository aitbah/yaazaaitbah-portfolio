import { apiFetch } from '@/lib/api-client';

/** What the admin may know about the transport - never the credentials. */
export type MailStatus = {
  configured: boolean;
  host?: string;
  port?: number;
  from?: string;
  notifyTo?: string;
};

export async function fetchMailStatus(): Promise<MailStatus> {
  const { mail } = await apiFetch<{ mail: MailStatus }>('/api/mail/status');

  return mail;
}

/**
 * Sends a fixed message to the configured recipient.
 *
 * Answers where it went, because "sent" is not useful on its own: the whole
 * question is whether it reaches an inbox the owner actually reads.
 */
export async function sendTestMail(): Promise<string | undefined> {
  const { sentTo } = await apiFetch<{ sentTo?: string }>('/api/mail/test', {
    method: 'POST',
  });

  return sentTo;
}
