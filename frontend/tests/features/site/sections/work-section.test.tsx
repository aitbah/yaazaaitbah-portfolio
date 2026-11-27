// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import home from '../../../../messages/en/home.json';
import {
  shotsOf,
  WorkSection,
} from '../../../../src/features/site/sections/work-section';
import type * as ProjectBodyModule from '../../../../src/features/site/sections/project-body';
import { PROJECTS, TECHNOLOGIES } from './fixtures';

vi.mock('next-intl/server', async () => {
  const { createTranslator } = await import('next-intl');
  const messages = (await import('../../../../messages/en/home.json')).default;

  return {
    getTranslations: ({
      locale,
      namespace,
    }: {
      locale: string;
      namespace?: string;
    }) =>
      Promise.resolve(
        createTranslator({
          locale: locale as 'en',
          messages,
          namespace: namespace as never,
        }),
      ),
  };
});
// The locale-aware link, as the router would write it for English.
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, ...props }: { href: string } & Record<string, unknown>) => (
    <a href={`/en${href}`} {...props} />
  ),
}));
// The case's own body is tested beside it; here it stands in, as the server would stream it.
vi.mock(
  '../../../../src/features/site/sections/project-body',
  async (importOriginal) => ({
    ...(await importOriginal<typeof ProjectBodyModule>()),
    ProjectBody: () => <p>body</p>,
    ProjectLinks: () => null,
  }),
);

afterEach(cleanup);

describe('the work', () => {
  it('tells featured projects as cases and indexes the rest, numbered in the admin’s order', async () => {
    render(
      <NextIntlClientProvider locale="en" messages={home}>
        {await WorkSection({
          projects: PROJECTS,
          expertise: TECHNOLOGIES,
          locale: 'en',
        })}
      </NextIntlClientProvider>,
    );

    const cases = screen.getAllByRole('article');

    expect(cases).toHaveLength(1);
    expect(
      within(cases[0]!).getByRole('heading', { level: 3 }).textContent,
    ).toBe('Marketplace');
    expect(within(cases[0]!).getByText('01')).toBeDefined();
    // Each case leads on to its own page; the rail's cards are links whole.
    expect(
      within(cases[0]!)
        .getByRole('link', { name: new RegExp(home.home.work.read) })
        .getAttribute('href'),
    ).toMatch(/^\/en\/projects\//);
    const row = screen.getByRole('link', { name: /Online store/ });

    expect(row.getAttribute('href')).toBe('/en/projects/store');
    expect(row.textContent).toContain('02');
    expect(screen.getByText(new RegExp(home.home.work.more))).toBeDefined();
  });

  it('lists every image, cover first', () => {
    expect(shotsOf(PROJECTS[1]!, 'en')).toEqual([
      { url: '/uploads/project/cover.png', alt: 'The cover' },
      { url: '/uploads/project/shot.png', alt: 'A screen' },
    ]);
  });
});
