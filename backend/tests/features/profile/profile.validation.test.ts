import { describe, expect, it } from 'vitest';

import { toValidationDetails } from '@portfolio/shared';
import { profileSchema } from '../../../src/features/profile/profile.validation.js';

const VALID = {
  firstName: { en: 'Yaaza' },
  lastName: { en: 'Ait Bah' },
  headline: { en: 'Full-stack developer' },
};

function codesFor(input: unknown) {
  const result = profileSchema.safeParse(input);
  if (result.success) throw new Error('expected validation to fail');

  return toValidationDetails(result.error);
}

describe('profile validation', () => {
  it('accepts a profile carrying only the launch locale', () => {
    expect(profileSchema.safeParse(VALID).success).toBe(true);
  });

  it('accepts the optional fields when they are supplied', () => {
    const result = profileSchema.safeParse({
      ...VALID,
      bio: { en: 'Building things for the web.' },
      photoUrl: 'https://cdn.example.com/me.jpg',
    });

    expect(result.success).toBe(true);
  });

  // A wholly absent field reports on itself; a missing locale reports on the
  // locale, so a form can highlight the right input either way.
  it('reports each missing field under its own name', () => {
    expect(codesFor({})).toEqual({
      firstName: 'REQUIRED',
      lastName: 'REQUIRED',
      headline: 'REQUIRED',
    });
  });

  it('rejects a blank value as required, not as too short', () => {
    expect(codesFor({ ...VALID, headline: { en: '   ' } })).toEqual({
      'headline.en': 'REQUIRED',
    });
  });

  it('rejects a photo reference that is not a URL', () => {
    expect(codesFor({ ...VALID, photoUrl: 'not-a-url' })).toEqual({
      photoUrl: 'INVALID_URL',
    });
  });

  it('caps the length of a localized field', () => {
    expect(codesFor({ ...VALID, firstName: { en: 'y'.repeat(81) } })).toEqual({
      'firstName.en': 'TOO_BIG',
    });
  });
});

// The whole point of the Map shape: a new language is data, not a schema change.
describe('multilingual structure', () => {
  it('accepts any additional locale beside the launch one', () => {
    const result = profileSchema.safeParse({
      firstName: { en: 'Yaaza', ar: 'ياعزى' },
      lastName: { en: 'Ait Bah', ar: 'أيت بها' },
      headline: { en: 'Full-stack developer', ar: 'مطور ويب' },
    });

    expect(result.success).toBe(true);
    expect(result.data?.firstName).toEqual({ en: 'Yaaza', ar: 'ياعزى' });
  });

  it('requires the launch locale even when another one is present', () => {
    expect(codesFor({ ...VALID, firstName: { ar: 'ياعزى' } })).toEqual({
      'firstName.en': 'REQUIRED',
    });
  });

  it('validates an added locale like any other value', () => {
    expect(
      codesFor({ ...VALID, headline: { en: 'Developer', ar: '' } }),
    ).toEqual({ 'headline.ar': 'REQUIRED' });
  });
});

describe('the photo reference', () => {
  const withPhoto = (photoUrl: string) =>
    profileSchema.safeParse({
      firstName: { en: 'Yaaza' },
      lastName: { en: 'Ait Bah' },
      headline: { en: 'Developer' },
      photoUrl,
    });

  it('accepts a path this application manages', () => {
    expect(withPhoto('/uploads/profile/avatar-abc123.webp').success).toBe(true);
  });

  it('accepts an absolute http(s) URL', () => {
    expect(withPhoto('https://cdn.example.com/me.jpg').success).toBe(true);
    expect(withPhoto('http://cdn.example.com/me.jpg').success).toBe(true);
  });

  // z.url() accepts all three; this value is rendered in a page, so it must not.
  it('rejects a scheme that can execute or read local files', () => {
    for (const value of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
    ]) {
      const result = withPhoto(value);

      expect(result.success).toBe(false);
      expect(toValidationDetails(result.error!)).toEqual({
        photoUrl: 'INVALID_URL',
      });
    }
  });

  it('rejects a path that tries to leave the uploads directory', () => {
    for (const value of [
      '/uploads/../secret.png',
      '/uploads/profile/../../etc/passwd',
      '/etc/passwd',
      '/uploads/profile/script.svg',
    ]) {
      expect(withPhoto(value).success).toBe(false);
    }
  });
});

/**
 * A CV is served from our own uploads, with the headers that make it a
 * download rather than a document the browser renders. A link to someone
 * else's host would have neither - which is why, unlike a photo, an external
 * URL is not a valid resume.
 */
describe('the resume', () => {
  const withResume = (resume: Record<string, string>) => ({
    ...VALID,
    resume,
  });

  it('accepts a stored document path', () => {
    expect(
      profileSchema.safeParse(withResume({ en: '/uploads/resume/cv-abc.pdf' }))
        .success,
    ).toBe(true);
  });

  it('accepts one per locale', () => {
    expect(
      profileSchema.safeParse(
        withResume({
          en: '/uploads/resume/cv-en.pdf',
          fr: '/uploads/resume/cv-fr.pdf',
        }),
      ).success,
    ).toBe(true);
  });

  it.each([
    ['an external URL', 'https://cdn.example.com/cv.pdf'],
    ['an image path', '/uploads/profile/avatar-abc.png'],
    ['a path outside the uploads root', '/etc/passwd'],
    ['a traversal', '/uploads/resume/../../etc/passwd'],
    ['nothing at all', ''],
  ])('refuses %s', (_what, value) => {
    expect(codesFor(withResume({ en: value }))).toEqual({
      'resume.en': 'INVALID_URL',
    });
  });

  // Absent is a profile with no CV, which is a normal profile.
  it('accepts the field being absent', () => {
    expect(profileSchema.safeParse(VALID).success).toBe(true);
  });
});
