// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PlatformMark } from '../../../src/features/social-link/platform-mark';

afterEach(cleanup);

/**
 * The slug arrives from the platform's option row now, rather than from a map
 * written out beside this component - so this is about what the component does
 * with one, and the option lists' own tests cover which slugs exist.
 *
 * That the seeded platforms name only real slugs, and that each one is filed
 * under a heading that exists, moved with the data: `shared/tests/
 * option-seed.test.ts`.
 */
describe('a platform with a vendored mark', () => {
  it('draws the brand logo under the platform name', () => {
    render(<PlatformMark slug="github" title="GitHub" />);

    expect(screen.getByRole('img', { name: 'GitHub' })).toBeTruthy();
  });
});

/**
 * Not every platform has one. LinkedIn was removed from the icon set upstream
 * after a trademark request, and `website` and `other` are not brands at all -
 * so the column falls back to a generic mark rather than to a blank cell.
 */
describe('a platform with no vendored mark', () => {
  it('still draws something when the option carries no slug', () => {
    render(<PlatformMark slug={undefined} title="LinkedIn" />);

    expect(screen.getByLabelText('LinkedIn')).toBeTruthy();
  });

  /**
   * The one case the old map could not produce and the option list can: the
   * owner may type a slug the vendored set has never carried. A wrong slug
   * draws the globe rather than nothing at all.
   */
  it('falls back when the slug names no drawing', () => {
    render(<PlatformMark slug="myspace" title="MySpace" />);

    expect(screen.getByLabelText('MySpace')).toBeTruthy();
  });
});
