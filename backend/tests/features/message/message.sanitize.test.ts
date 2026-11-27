import { describe, expect, it } from 'vitest';

import { sanitizeText } from '../../../src/features/message/message.sanitize.js';

/**
 * The sanitizer removes what should never have been in a message. It is **not**
 * an escaping step, and these tests are written so that nobody later mistakes
 * it for one: what it leaves alone matters as much as what it strips.
 */
describe('sanitizeText', () => {
  describe('what it removes', () => {
    it('strips control characters', () => {
      expect(sanitizeText('he\u0000llo\u0007the\u001Fre')).toBe('hellothere');
    });

    it('strips DEL', () => {
      expect(sanitizeText('a\u007Fb')).toBe('ab');
    });

    // Used to make one string render as another entirely.
    it('strips bidirectional overrides', () => {
      expect(sanitizeText('safe\u202Eelif.txt')).toBe('safeelif.txt');
    });

    it('strips zero-width characters used to slip past matching', () => {
      expect(sanitizeText('vi\u200Bag\u200Cra')).toBe('viagra');
    });

    it('strips a byte order mark from anywhere in the value', () => {
      expect(sanitizeText('\uFEFFhello\uFEFF')).toBe('hello');
    });

    it('collapses a run of blank lines into one gap', () => {
      expect(sanitizeText('a\n\n\n\n\nb')).toBe('a\n\nb');
    });

    it('trims surrounding whitespace', () => {
      expect(sanitizeText('  hello  ')).toBe('hello');
    });
  });

  describe('what it leaves alone', () => {
    // The whole point: it is not an escaper, and pretending otherwise would be
    // worse than doing nothing.
    it('does not escape or remove markup', () => {
      expect(sanitizeText('<script>alert(1)</script>')).toBe(
        '<script>alert(1)</script>',
      );
    });

    it('keeps quotes, ampersands and backslashes exactly', () => {
      expect(sanitizeText(String.raw`he said "it\'s" & left`)).toBe(
        String.raw`he said "it\'s" & left`,
      );
    });

    it('keeps tabs and single newlines, which people type', () => {
      expect(sanitizeText('a\tb\nc')).toBe('a\tb\nc');
    });

    it('keeps a paragraph break', () => {
      expect(sanitizeText('first\n\nsecond')).toBe('first\n\nsecond');
    });

    it('keeps non-Latin text untouched', () => {
      expect(sanitizeText('مرحبا 世界 Привет')).toBe('مرحبا 世界 Привет');
    });

    it('keeps emoji, which are ordinary characters to a reader', () => {
      expect(sanitizeText('thanks 👍')).toBe('thanks 👍');
    });
  });

  describe('line endings', () => {
    it('normalises Windows endings so stored text is consistent', () => {
      expect(sanitizeText('a\r\nb')).toBe('a\nb');
    });

    it('normalises lone carriage returns too', () => {
      expect(sanitizeText('a\rb')).toBe('a\nb');
    });

    // Windows endings must not survive as extra blank lines.
    it('collapses blank lines that arrived as CRLF', () => {
      expect(sanitizeText('a\r\n\r\n\r\n\r\nb')).toBe('a\n\nb');
    });
  });

  it('leaves an ordinary message completely unchanged', () => {
    const message = 'Hi,\n\nI saw your portfolio. Can we talk?\n\nThanks!';

    expect(sanitizeText(message)).toBe(message);
  });
});
