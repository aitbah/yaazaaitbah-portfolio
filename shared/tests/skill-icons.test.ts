import { describe, expect, it } from 'vitest';

import { SKILL_ICON_SLUGS } from '../src/skill-icon-slugs.js';
import { SKILL_ICONS } from '../src/skill-icons.data.js';
import { expertiseIcon } from '../src/validation-rules.js';

/**
 * The two generated files are written by one script, but they are two files:
 * regenerating one without the other, or hand-editing either, produces a slug
 * that validates and then draws nothing. These pin them together.
 */
describe('the vendored skill icons', () => {
  it('can draw every slug that validation accepts', () => {
    const drawable = new Set(SKILL_ICONS.map((icon) => icon.slug));
    const undrawable = SKILL_ICON_SLUGS.filter((slug) => !drawable.has(slug));

    expect(undrawable).toEqual([]);
  });

  it('accepts no slug it cannot name', () => {
    const known = new Set<string>(SKILL_ICON_SLUGS);
    const unnamed = SKILL_ICONS.filter((icon) => !known.has(icon.slug));

    expect(unnamed).toEqual([]);
  });

  it('gives every icon a path and a colour', () => {
    const incomplete = SKILL_ICONS.filter(
      (icon) => !/^[0-9A-F]{6}$/.test(icon.hex) || icon.path.length === 0,
    );

    expect(incomplete).toEqual([]);
  });

  // The set is the reason SVG upload stays refused, so it has to be broad
  // enough to be the primary path rather than a token gesture.
  it('carries the technologies a portfolio actually lists', () => {
    const known = new Set<string>(SKILL_ICON_SLUGS);

    for (const slug of [
      'react',
      'vuedotjs',
      'laravel',
      'nodedotjs',
      'docker',
    ]) {
      expect(known.has(slug), slug).toBe(true);
    }
  });
});

describe('a skill icon', () => {
  it('accepts a preset naming a vendored logo', () => {
    const result = expertiseIcon.safeParse({ kind: 'preset', value: 'react' });

    expect(result.success).toBe(true);
  });

  /**
   * The whole point of storing a slug rather than markup: an unknown one is
   * refused at the door, so nothing can be saved that would later render blank.
   */
  it('refuses a preset naming a logo we do not have', () => {
    const result = expertiseIcon.safeParse({
      kind: 'preset',
      value: 'not-a-logo',
    });

    expect(result.success).toBe(false);
  });

  it('accepts an upload of our own', () => {
    const result = expertiseIcon.safeParse({
      kind: 'upload',
      value: '/uploads/skill/logo-abc.png',
    });

    expect(result.success).toBe(true);
  });

  // A preset is a name, never markup. If this ever passes, SVG has found a way
  // back in through the field that was designed to keep it out.
  it('refuses markup in either arm', () => {
    for (const value of [
      '<svg onload="alert(1)"></svg>',
      'javascript:alert(1)',
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    ]) {
      expect(expertiseIcon.safeParse({ kind: 'preset', value }).success).toBe(
        false,
      );
      expect(expertiseIcon.safeParse({ kind: 'upload', value }).success).toBe(
        false,
      );
    }
  });

  it('refuses a shape that is neither', () => {
    expect(
      expertiseIcon.safeParse({ kind: 'svg', value: '<svg/>' }).success,
    ).toBe(false);
    // Both arms at once is not a state worth representing.
    expect(expertiseIcon.safeParse({ value: 'react' }).success).toBe(false);
  });
});
