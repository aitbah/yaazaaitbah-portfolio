import { describe, expect, it } from 'vitest';

import { toValidationDetails } from '@portfolio/shared';
import { profileSchema } from '../../../src/features/profile/profile-schema';

const VALID = {
  firstName: { en: 'Yaaza' },
  lastName: { en: 'Ait Bah' },
  headline: { en: 'Full-stack developer' },
  bio: { en: '' },
};

function withPhoto(photoUrl: string) {
  return profileSchema.safeParse({ ...VALID, photoUrl });
}

// The form no longer lets a photo be typed, but the value still crosses the
// wire and is rendered, so the rule has to hold here as well as on the server.
describe('the photo reference', () => {
  it('accepts a path this application manages', () => {
    expect(withPhoto('/uploads/profile/avatar-abc123.webp').success).toBe(true);
    expect(withPhoto('/uploads/profile/avatar-abc123.png').success).toBe(true);
  });

  it('accepts an absolute http(s) URL', () => {
    expect(withPhoto('https://cdn.example.com/me.jpg').success).toBe(true);
    expect(withPhoto('http://cdn.example.com/me.jpg').success).toBe(true);
  });

  // z.url() accepts all three; this value ends up in a page.
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
      'not-a-url',
    ]) {
      expect(withPhoto(value).success).toBe(false);
    }
  });

  // Removing the photo clears the field; an empty value is absent, not invalid.
  it('treats a cleared photo as absent', () => {
    const result = profileSchema.safeParse({ ...VALID, photoUrl: '' });

    expect(result.success).toBe(true);
    expect(result.data?.photoUrl).toBeUndefined();
  });
});
