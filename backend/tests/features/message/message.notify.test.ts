import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMail = vi.fn(() => Promise.resolve(true));

vi.mock('../../../src/core/mail/mailer.js', () => ({
  sendMail,
  mailIsConfigured: () => true,
}));

const { notifyOwnerOfMessage } =
  await import('../../../src/features/message/message.notify.js');

const MESSAGE = {
  name: 'A Visitor',
  email: 'visitor@example.test',
  subject: 'About a project',
  body: 'I saw the site and had a question.',
};

/** What actually reached the transport. */
function sent(): {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
} {
  const [mail] = sendMail.mock.calls[0] as unknown as [
    { to: string; subject: string; text: string; replyTo?: string },
  ];

  return mail;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('notifying the owner', () => {
  it('carries the sender, the subject and the body', async () => {
    await notifyOwnerOfMessage(MESSAGE);

    const mail = sent();
    expect(mail.subject).toContain('About a project');
    expect(mail.text).toContain('A Visitor');
    expect(mail.text).toContain('visitor@example.test');
    expect(mail.text).toContain('I saw the site and had a question.');
  });

  // So answering is one click, from whatever the owner reads mail in.
  it('replies to the person who wrote, not to the site', async () => {
    await notifyOwnerOfMessage(MESSAGE);

    expect(sent().replyTo).toBe('visitor@example.test');
  });

  it('links to the inbox the message is also in', async () => {
    await notifyOwnerOfMessage(MESSAGE);

    expect(sent().text).toContain('/en/admin/messages');
  });

  /**
   * The one place a visitor's text meets a header.
   *
   * A newline in a mail header starts another header. Left alone, a subject
   * carrying `\\r\\nBcc: someone@else` would make this endpoint send mail on a
   * stranger's behalf - the whole of email header injection, from the only
   * public write this application has.
   */
  it('cannot be made to start a second header', async () => {
    await notifyOwnerOfMessage({
      ...MESSAGE,
      subject: 'Hello\r\nBcc: someone@else.test\r\nX-Anything: yes',
    });

    const { subject } = sent();

    // One line, and still our subject. The literal text "Bcc:" surviving is
    // fine and is not what this is about - a visitor may legitimately write it.
    // What must not survive is the newline that would make it a header.
    expect(subject.split(/\r|\n/)).toHaveLength(1);
    expect(subject.startsWith('Portfolio contact: ')).toBe(true);
  });

  // The body is where their text belongs, and it survives intact there.
  it('keeps the newlines in the body, where they are safe', async () => {
    await notifyOwnerOfMessage({
      ...MESSAGE,
      body: 'One line.\nAnother line.',
    });

    expect(sent().text).toContain('One line.\nAnother line.');
  });

  // An unbounded header is its own problem, whatever it holds.
  it('bounds the subject line', async () => {
    await notifyOwnerOfMessage({ ...MESSAGE, subject: 'x'.repeat(500) });

    expect(sent().subject.length).toBeLessThan(200);
  });
});
