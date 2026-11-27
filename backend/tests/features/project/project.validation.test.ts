import { describe, expect, it } from 'vitest';
import { toValidationDetails } from '@portfolio/shared';

import { projectSchema } from '../../../src/features/project/project.validation.js';

const ID = '507f1f77bcf86cd799439011';

const VALID = {
  slug: 'portfolio',
  title: { en: 'Portfolio' },
  description: { en: 'This site.' },
};

function codesFor(input: unknown) {
  const result = projectSchema.safeParse(input);
  if (result.success) throw new Error('expected validation to fail');

  return toValidationDetails(result.error);
}

function parsed(input: unknown) {
  const result = projectSchema.safeParse(input);
  if (!result.success) throw new Error('expected validation to succeed');

  return result.data;
}

describe('the project schema', () => {
  it('defaults the optional collections and flags', () => {
    expect(parsed(VALID)).toEqual({
      ...VALID,
      stack: [],
      // Absent means an empty gallery, not a missing field: the service works
      // with validated input, so it never has to ask which it got.
      gallery: [],
      featured: false,
      order: 0,
    });
  });

  it('reports each missing field on itself', () => {
    expect(codesFor({})).toEqual({
      slug: 'REQUIRED',
      title: 'REQUIRED',
      description: 'REQUIRED',
    });
  });

  it('requires the launch locale on both localized fields', () => {
    expect(
      codesFor({
        slug: 'portfolio',
        title: { ar: 'م' },
        description: { ar: 'و' },
      }),
    ).toEqual({
      'title.en': 'REQUIRED',
      'description.en': 'REQUIRED',
    });
  });

  /**
   * The address travels in a URL and is compared exactly, so it is held to the
   * same shape an option code is: lowercase, digits, single dashes.
   */
  it('refuses an address that is not one', () => {
    for (const bad of ['Not A Slug', 'trailing-', 'double--dash', 'Ünicode']) {
      expect(codesFor({ ...VALID, slug: bad })).toEqual({
        slug: 'INVALID_SLUG',
      });
    }
  });

  it('accepts stack references as identifiers', () => {
    expect(parsed({ ...VALID, stack: [ID] }).stack).toEqual([ID]);
  });

  // A malformed reference must be a validation error, not a cast failure that
  // surfaces later as a server fault.
  it.each(['nope', '', '507f1f77bcf86cd79943901'])(
    'rejects the stack reference %j',
    (id) => {
      expect(codesFor({ ...VALID, stack: [id] })).toEqual({
        'stack.0': 'INVALID_ID',
      });
    },
  );

  describe('links', () => {
    it.each([
      ['repoUrl', 'https://github.com/me/repo'],
      ['liveUrl', 'http://example.com'],
    ])('accepts %s as an http(s) URL', (field, value) => {
      expect(
        projectSchema.safeParse({ ...VALID, [field]: value }).success,
      ).toBe(true);
    });

    // Rendered as an href, so the protocol matters as much as it does anywhere.
    it.each(['javascript:alert(1)', 'data:text/html,<script>', 'file:///etc'])(
      'rejects the repository link %s',
      (value) => {
        expect(codesFor({ ...VALID, repoUrl: value })).toEqual({
          repoUrl: 'INVALID_URL',
        });
      },
    );

    // Unlike the cover, a link is never one of our own upload paths.
    it('rejects an upload path as a live link', () => {
      expect(
        codesFor({ ...VALID, liveUrl: '/uploads/project/a-1.png' }),
      ).toEqual({ liveUrl: 'INVALID_URL' });
    });
  });

  describe('the cover image', () => {
    it('accepts one of our own upload paths', () => {
      expect(
        projectSchema.safeParse({
          ...VALID,
          imageUrl: '/uploads/project/cover-2b51d475.png',
        }).success,
      ).toBe(true);
    });

    it('accepts an external image URL', () => {
      expect(
        projectSchema.safeParse({
          ...VALID,
          imageUrl: 'https://cdn.example.com/a.png',
        }).success,
      ).toBe(true);
    });

    it.each([
      'javascript:alert(1)',
      '/uploads/project/a.svg',
      '/elsewhere/a.png',
    ])('rejects %s', (value) => {
      expect(codesFor({ ...VALID, imageUrl: value })).toEqual({
        imageUrl: 'INVALID_URL',
      });
    });
  });

  it('rejects a fractional position, as the expertise schema does', () => {
    expect(codesFor({ ...VALID, order: 1.5 })).toEqual({
      order: 'INVALID_INTEGER',
    });
  });

  it('rejects a non-boolean featured flag', () => {
    expect(codesFor({ ...VALID, featured: 'yes' })).toEqual({
      featured: 'REQUIRED',
    });
  });
});
