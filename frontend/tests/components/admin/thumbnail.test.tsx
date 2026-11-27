// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Thumbnail } from '../../../src/components/admin/thumbnail';

const LABELS = {
  emptyLabel: 'No cover yet',
  unavailableLabel: 'Image unavailable',
  // Required by the component on purpose: without it the browser picks a
  // candidate for the whole viewport, which is the one way this optimization
  // can look finished and save nothing.
  sizes: '64px',
};

afterEach(cleanup);

describe('a stored image', () => {
  /**
   * Same-origin and through the optimizer, which is what the rewrite in
   * `next.config.ts` is for: the stored path is the `url` parameter rather than
   * the `src`, and the browser is offered widths rather than the original.
   */
  it('asks the optimizer for the stored reference', () => {
    render(<Thumbnail url="/uploads/a.png" alt="A project" {...LABELS} />);

    const image = screen.getByAltText('A project');

    expect(image.getAttribute('src')).toContain('%2Fuploads%2Fa.png');
    expect(image.getAttribute('srcset')).toBeTruthy();
    expect(image.getAttribute('sizes')).toBe('64px');
  });
});

describe('the two absences', () => {
  /**
   * Nothing was ever chosen. Saying so is information - an empty box is not,
   * and it is exactly where a missing cover goes unnoticed.
   */
  it('says there is no image when none was chosen', () => {
    render(<Thumbnail url="" alt="A project" {...LABELS} />);

    expect(screen.getByText('No cover yet')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  /**
   * Something was chosen whose file has since gone - a swapped volume, a
   * manual delete. "No image" would be a lie, and a broken image icon would
   * blame the browser for it.
   */
  it('distinguishes a reference whose file cannot be fetched', () => {
    render(<Thumbnail url="/uploads/gone.png" alt="A project" {...LABELS} />);

    fireEvent.error(screen.getByAltText('A project'));

    expect(screen.getByText('Image unavailable')).toBeTruthy();
    expect(screen.queryByText('No cover yet')).toBeNull();
  });
});
