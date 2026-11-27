// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import home from '../../../../messages/en/home.json';
import { ProjectGallery } from '../../../../src/features/site/sections/project-gallery';

const t = home.home.work;
const SHOTS = [
  { url: '/uploads/project/cover.png', alt: 'The cover' },
  { url: '/uploads/project/one.png', alt: 'Screen one' },
  { url: '/uploads/project/two.png', alt: 'Screen two' },
];

beforeAll(() => {
  // jsdom has the element but not its modal methods.
  HTMLDialogElement.prototype.showModal = function showModal(
    this: HTMLDialogElement,
  ) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
});

afterEach(cleanup);

const show = (shots = SHOTS, open = false) =>
  render(
    <NextIntlClientProvider locale="en" messages={home}>
      <ProjectGallery title="Marketplace" shots={shots} open={open} />
    </NextIntlClientProvider>,
  );

describe('a project’s images', () => {
  it('opens on the cover, then steps through every image, both ways round', () => {
    show();
    const viewer = document.querySelector('dialog')!;

    fireEvent.click(
      screen.getByRole('button', {
        name: t.openImages.replace('{title}', 'Marketplace'),
      }),
    );
    expect(viewer.open).toBe(true);
    expect(viewer.textContent).toContain('01 / 03');

    fireEvent.click(screen.getByRole('button', { name: t.next, hidden: true }));
    expect(viewer.querySelector('figcaption')?.textContent).toBe('Screen one');
    fireEvent.keyDown(viewer, { key: 'ArrowLeft' });
    fireEvent.keyDown(viewer, { key: 'ArrowLeft' });
    expect(viewer.querySelector('figcaption')?.textContent).toBe('Screen two');

    fireEvent.click(
      screen.getByRole('button', { name: t.close, hidden: true }),
    );
    expect(viewer.open).toBe(false);
  });

  it('opens a thumbnail on its own image', () => {
    show();

    fireEvent.click(
      screen.getByRole('button', { name: /Open image 3: Screen two/ }),
    );
    expect(document.querySelector('figcaption')?.textContent).toBe(
      'Screen two',
    );
  });

  it('is revealed from its foot on the home page, and drawn open on a project’s page', () => {
    show();
    expect(document.querySelector('[data-clip]')).not.toBeNull();
    cleanup();
    show(SHOTS, true);
    expect(document.querySelector('[data-clip]')).toBeNull();
  });

  it('has no arrows for a single image, and nothing at all for none', () => {
    show(SHOTS.slice(0, 1));
    expect(
      screen.queryByRole('button', { name: t.next, hidden: true }),
    ).toBeNull();
    cleanup();
    const { container } = show([]);

    expect(container.textContent).toBe('');
  });
});
