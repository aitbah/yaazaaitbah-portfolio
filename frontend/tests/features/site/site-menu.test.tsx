// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import home from '../../../messages/en/home.json';
import { SiteMenu } from '../../../src/features/site/site-menu';

vi.mock('../../../src/components/language-switcher', () => ({
  LanguageSwitcher: () => <span>languages</span>,
}));

const t = home.home.nav;

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
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

afterEach(cleanup);

const show = () =>
  render(
    <NextIntlClientProvider locale="en" messages={home}>
      <SiteMenu name="Ada Lovelace" sections={['work', 'path', 'contact']} />
    </NextIntlClientProvider>,
  );

describe('the phone menu', () => {
  it('opens on the sections that have content, numbered as their chapters', () => {
    show();
    const dialog = document.querySelector('dialog')!;

    expect(dialog.open).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: t.menu }));
    expect(dialog.open).toBe(true);

    const links = [...dialog.querySelectorAll('nav a')];

    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '#work',
      '#path',
      '#contact',
    ]);
    // Work is the second chapter, the path the fourth, contact the sixth.
    expect(links.map((link) => link.textContent)).toEqual([
      `02${t.work}`,
      `04${t.path}`,
      `06${t.contact}`,
    ]);
  });

  it('closes when a section is chosen, and from its own button', () => {
    show();
    const dialog = document.querySelector('dialog')!;

    fireEvent.click(screen.getByRole('button', { name: t.menu }));
    fireEvent.click(dialog.querySelector('a[href="#path"]')!);
    expect(dialog.open).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: t.menu }));
    fireEvent.click(
      screen.getByRole('button', { name: t.close, hidden: true }),
    );
    expect(dialog.open).toBe(false);
  });

  it('carries the language and the theme', () => {
    show();
    const dialog = document.querySelector('dialog')!;

    expect(dialog.textContent).toContain('languages');
    expect(dialog.querySelector('button[aria-label]')).not.toBeNull();
  });
});
