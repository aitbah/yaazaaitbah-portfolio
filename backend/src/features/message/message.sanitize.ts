/**
 * Control characters that have no place in a contact message: everything below
 * space except tab, newline and carriage return, plus DEL. They arrive from
 * something generating input rather than typing it, and they corrupt the logs
 * and terminals that later display the message.
 */
// The rule exists because a control character in a pattern is usually a typo.
// Here they are the subject: this is the pattern that removes them.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Characters that carry no visible text but can reorder or hide what follows:
 * the bidirectional overrides used to disguise one string as another, and the
 * zero-width characters used to slip past naive matching.
 */
const INVISIBLE_CHARACTERS = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;

/** Three or more blank lines in a row are formatting, not content. */
const EXCESSIVE_BLANK_LINES = /\n{3,}/g;

/**
 * Cleans one field of the contact form.
 *
 * This is **not** an escaping step and must not be mistaken for one: the values
 * are stored as text and rendered as text, and nothing here makes an unsafe
 * value safe. It removes what should never have been in a message at all, so
 * that what reaches the inbox is what a person actually typed.
 */
export function sanitizeText(value: string): string {
  return value
    .replace(CONTROL_CHARACTERS, '')
    .replace(INVISIBLE_CHARACTERS, '')
    .replace(/\r\n?/g, '\n')
    .replace(EXCESSIVE_BLANK_LINES, '\n\n')
    .trim();
}
