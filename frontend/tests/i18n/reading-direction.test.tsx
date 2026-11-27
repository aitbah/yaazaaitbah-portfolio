// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import admin from '../../messages/en/admin.json';
import { DirectionProvider } from '../../src/components/providers/direction-provider';
import { Progress } from '../../src/components/ui/progress';
import {
  SegmentedControl,
  SegmentedControlItem,
} from '../../src/components/ui/segmented-control';
import { localeDirection, routing } from '../../src/i18n/routing';

afterEach(cleanup);

function inDirection(direction: 'ltr' | 'rtl', children: ReactNode) {
  return render(
    <DirectionProvider direction={direction}>
      <NextIntlClientProvider locale="en" messages={admin}>
        {children}
      </NextIntlClientProvider>
    </DirectionProvider>,
  );
}

/**
 * `<html dir>` is what CSS reads, and it is only half of it. Radix reads the
 * direction from its own context and nothing else - with no provider it
 * computes `ltr` on a document that says `rtl`, and every keyboard and
 * placement decision it makes is then made backwards.
 *
 * Asserted on the attribute Radix writes rather than on the provider, because
 * the provider is not the thing that can break: an import that goes missing
 * from the layout leaves a page that renders perfectly and answers the arrow
 * keys the wrong way round.
 */
describe('the direction Radix is given', () => {
  const control = (
    <SegmentedControl value="en" onValueChange={() => undefined} label="Locale">
      <SegmentedControlItem value="en">EN</SegmentedControlItem>
      <SegmentedControlItem value="ar">AR</SegmentedControlItem>
    </SegmentedControl>
  );

  it('reaches a primitive that never asked for it', () => {
    inDirection('rtl', control);

    expect(screen.getByRole('radiogroup').getAttribute('dir')).toBe('rtl');
  });

  it('leaves a left-to-right page left to right', () => {
    inDirection('ltr', control);

    expect(screen.getByRole('radiogroup').getAttribute('dir')).toBe('ltr');
  });
});

/**
 * Upstream fills the track by sliding a full-width bar out of view with
 * `translateX`, which is an axis the document's direction does not reach. The
 * meter is sized along the inline axis instead, so it fills from wherever the
 * text starts.
 *
 * The absence of the transform is asserted as well as the presence of the
 * size: a bar that is both sized and translated is a bar that is drawn twice
 * as short, and only one of those two mistakes is visible in a snapshot.
 */
describe('the progress meter', () => {
  function indicator(container: HTMLElement) {
    const found = container.querySelector<HTMLElement>(
      '[data-slot="progress-indicator"]',
    );

    expect(found).not.toBeNull();

    return found as HTMLElement;
  }

  it('is sized along the inline axis rather than slid', () => {
    const { container } = inDirection('rtl', <Progress value={40} />);
    const bar = indicator(container);

    expect(bar.style.inlineSize).toBe('40%');
    expect(bar.style.transform).toBe('');
  });

  it('is empty rather than full when it has no value yet', () => {
    const { container } = inDirection('ltr', <Progress />);

    expect(indicator(container).style.inlineSize).toBe('0%');
  });
});

/**
 * The site's own claim about itself. Arabic is the first locale that reads the
 * other way, so this is the assertion that says the right-to-left work has a
 * language to be for - `routing.test.ts` checks the direction of the tag, and
 * this checks that the tag is offered at all.
 */
describe('the languages on offer', () => {
  it('includes Arabic', () => {
    expect(routing.locales).toContain('ar');
  });

  it('offers a language written right to left', () => {
    // The narrower claim of the two: the direction work has a locale to be
    // for. Dropping Arabic without replacing it would leave `localeDirection`
    // correct about a language nobody can reach.
    expect(routing.locales.map(localeDirection)).toContain('rtl');
  });
});
