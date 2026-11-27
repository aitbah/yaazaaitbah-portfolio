import { env } from '../../config/env.js';
import { sendMail } from '../../core/mail/mailer.js';
import type { MessageInput } from './message.validation.js';

/**
 * Tells the owner someone wrote. A visitor's text goes only in the body; the
 * subject quotes theirs with newlines removed, and `Reply-To` carries their
 * validated address. Plain text, so nothing to escape.
 */

/** Header-safe: one line, bounded, and no control characters. */
function forHeader(text: string): string {
  return text
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 120)
    .trim();
}

export async function notifyOwnerOfMessage(
  input: MessageInput,
): Promise<boolean> {
  const inbox = new URL('/en/admin/messages', env.FRONTEND_URL).toString();

  return sendMail({
    to: env.CONTACT_NOTIFY_TO ?? '',
    subject: `Portfolio contact: ${forHeader(input.subject)}`,
    replyTo: input.email,
    text: [
      `${input.name} <${input.email}> wrote:`,
      '',
      `Subject: ${input.subject}`,
      '',
      input.body,
      '',
      '—',
      `Reply to this email to answer them directly. The message is also in the inbox: ${inbox}`,
    ].join('\n'),
  });
}
