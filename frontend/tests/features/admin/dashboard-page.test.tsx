// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The locale prefix is next-intl's job and is covered by its own tests; here a
// plain anchor keeps the client navigation out of the module graph.
vi.mock('@/i18n/navigation', () => ({
  Link: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
  usePathname: () => '/admin',
  useRouter: () => ({ replace: vi.fn() }),
}));

import admin from '../../../messages/en/admin.json';
import responses from '../../../messages/en/responses.json';
import validation from '../../../messages/en/validation.json';
import DashboardPage from '../../../src/app/[locale]/admin/(protected)/page';

const messages = { ...admin, ...validation, ...responses };

const PROFILE = {
  firstName: { en: 'Yaaza' },
  lastName: { en: 'Ait Bah' },
  headline: { en: 'Developer' },
  updatedAt: '2026-09-01T10:00:00.000Z',
};

const MESSAGE = {
  id: 'm1',
  name: 'Ada',
  email: 'ada@example.com',
  subject: 'About your portfolio',
  body: 'Hello.',
  read: false,
  receivedAt: '2026-09-02T10:00:00.000Z',
};

type Reply = { status: number; body: unknown };

const ok = (details: unknown): Reply => ({
  status: 200,
  body: { code: 'SUCCESS', details },
});
const FAILED: Reply = {
  status: 500,
  body: { code: 'SERVER_ERROR', details: {} },
};

/** One reply per endpoint, so a test can fail exactly one of them. */
function stubApi(overrides: Record<string, Reply> = {}) {
  const replies: Record<string, Reply> = {
    '/api/skills': ok({ skills: [{ id: 's1' }, { id: 's2' }] }),
    '/api/projects': ok({
      projects: [
        { id: 'p1', featured: true, skills: [] },
        { id: 'p2', featured: false, skills: [] },
        { id: 'p3', featured: false, skills: [] },
      ],
    }),
    '/api/technologies': ok({ technologies: [{ id: 't1' }, { id: 't2' }] }),
    '/api/tools': ok({ tools: [{ id: 'o1' }] }),
    '/api/experience': ok({
      experience: [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }],
    }),
    '/api/social-links': ok({ socialLinks: [{ id: 'l1' }] }),
    '/api/messages': ok({
      messages: [MESSAGE],
      unread: 1,
      page: 0,
      pageSize: 20,
      total: 7,
    }),
    '/api/profile': ok({ profile: PROFILE }),
    '/api/education': ok({ education: [{ id: 'd1' }, { id: 'd2' }] }),
    '/api/certifications': ok({ certifications: [{ id: 'c1' }] }),
    '/api/courses': ok({ courses: [] }),
    '/api/languages': ok({
      languages: [{ id: 'g1' }, { id: 'g2' }, { id: 'g3' }],
    }),
    ...overrides,
  };

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const match = Object.keys(replies).find((path) => url.includes(path));
      const reply = match ? replies[match]! : FAILED;

      return Promise.resolve({
        ok: reply.status >= 200 && reply.status < 300,
        status: reply.status,
        json: () => Promise.resolve(reply.body),
      });
    }),
  );
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </NextIntlClientProvider>
    );
  }

  return render(<DashboardPage />, { wrapper: Wrapper });
}

beforeEach(() => {
  stubApi();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** The card whose heading is `name`, so counts are read from the right one. */
function card(name: string): HTMLElement {
  const heading = screen.getByText(name);
  const container = heading.closest('[data-slot="card"]');

  if (!container) throw new Error(`no card for ${name}`);

  return container as HTMLElement;
}

describe('the dashboard overview', () => {
  it('counts every entity', async () => {
    renderPage();
    await screen.findByText('Expertise');

    expect(card('Experience').textContent).toContain('3');
    expect(card('Projects').textContent).toContain('3');
    // One tile for the three kinds, with the split spelled out under it: the
    // separation is the point, so a single total on its own would undo it.
    expect(card('Expertise').textContent).toContain('5');
    expect(card('Expertise').textContent).toContain(
      '2 skills · 2 technologies · 1 tools',
    );
    expect(screen.getByText('1 social link')).toBeTruthy();
  });

  // The inbox pages, so the card must show the total rather than the page.
  it('counts every message, not only the first page', async () => {
    renderPage();
    await screen.findByText('Messages');

    expect(card('Messages').textContent).toContain('7');
  });

  it('says how many messages are unread and how many projects are featured', async () => {
    renderPage();
    await screen.findByText('Expertise');

    expect(card('Messages').textContent).toContain('1 unread');
    expect(card('Projects').textContent).toContain('1 featured');
  });

  it('shows the latest messages', async () => {
    renderPage();

    expect(await screen.findByText('About your portfolio')).toBeTruthy();
    expect(screen.getByText('Ada')).toBeTruthy();
  });

  it('links to every section', async () => {
    renderPage();
    await screen.findByText('Expertise');

    const targets = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    for (const href of [
      '/admin/skills',
      '/admin/projects',
      '/admin/social-links',
      '/admin/messages',
      '/admin/profile',
      '/admin/education',
      '/admin/certifications',
      '/admin/courses',
      '/admin/languages',
    ]) {
      expect(targets).toContain(href);
    }
  });

  /**
   * The four sections built after the dashboard was, which for a while it did
   * not mention at all - not a count, not a link, not a row.
   */
  it('counts the background sections', async () => {
    renderPage();

    expect(await screen.findByLabelText('Education, 2 entries')).toBeTruthy();

    const panel = card('Background');

    expect(screen.getByLabelText('Certifications, 1 entry')).toBeTruthy();
    expect(screen.getByLabelText('Courses, nothing yet')).toBeTruthy();
    expect(screen.getByLabelText('Languages, 3 entries')).toBeTruthy();

    // The number is what the panel shows; the label is what it means.
    expect(panel.textContent).toContain('Education');
    expect(panel.textContent).toContain('2');
  });

  /**
   * Per row rather than per panel: three sections that answered are still worth
   * reporting when the fourth did not.
   */
  it('costs one failed background read its own number and no other', async () => {
    stubApi({ '/api/certifications': FAILED });
    renderPage();

    expect(await screen.findByLabelText('Education, 2 entries')).toBeTruthy();

    const rows = [...card('Background').querySelectorAll('li')];
    const row = (name: string) =>
      rows.find((item) => item.textContent?.startsWith(name))?.textContent;

    expect(row('Certifications')).toContain(
      'Something went wrong. Please try again.',
    );

    // The other three still say their number, which is the whole claim: the
    // aria-label is built from the count either way, so asserting on it would
    // pass with every row showing the error.
    expect(row('Languages')).toBe('Languages3');
    expect(row('Education')).toBe('Education2');
    expect(row('Courses')).toBe('Courses0');
  });

  it('says when the profile has not been filled in yet', async () => {
    stubApi({
      '/api/profile': { status: 404, body: { code: 'NOT_FOUND', details: {} } },
    });
    renderPage();

    expect(
      await screen.findByText('No profile yet. Fill it in to create one.'),
    ).toBeTruthy();
  });

  it('says when there are no messages yet', async () => {
    stubApi({
      '/api/messages': ok({
        messages: [],
        unread: 0,
        page: 0,
        pageSize: 20,
        total: 0,
      }),
    });
    renderPage();

    expect(await screen.findByText('No messages yet.')).toBeTruthy();
  });

  /**
   * An overview that disappears whenever one thing is unavailable is worse than
   * one that is clearly partial.
   */
  it('keeps the rest of the page when one section fails to load', async () => {
    stubApi({ '/api/skills': FAILED });
    renderPage();

    await screen.findByText('Projects');

    expect(card('Expertise').textContent).toContain(
      'Something went wrong. Please try again.',
    );
    expect(card('Projects').textContent).toContain('3');
  });

  /**
   * The counts say what exists; only their absence says what to do next. A new
   * install otherwise lands on a page of zeroes with no order to them.
   */
  it('lists what the site still needs, and links to where it is added', async () => {
    stubApi({
      '/api/profile': { status: 404, body: { code: 'NOT_FOUND', details: {} } },
    });
    renderPage();

    expect(await screen.findByText('Site readiness')).toBeTruthy();

    const bio = screen.getByText('Write a bio').closest('a');

    expect(bio?.getAttribute('href')).toBe('/admin/profile');
    // Eleven checks, and the five that come from the profile are all unmet.
    expect(screen.getByText('6 of 11 done')).toBeTruthy();
  });

  it('leaves out what is already done', async () => {
    renderPage();

    await screen.findByText('Site readiness');

    // Skills, technologies, tools, experience, projects and links all exist in
    // the fixture; only the profile's own fields are missing.
    expect(screen.queryByText('Add a skill')).toBeNull();
    expect(screen.getByText('Add a profile photo')).toBeTruthy();
  });

  it('says so when nothing is left', async () => {
    stubApi({
      '/api/profile': ok({
        profile: {
          ...PROFILE,
          bio: { en: 'A bio.' },
          photoUrl: '/uploads/profile/a.png',
          resume: { en: '/uploads/resume/c.pdf' },
        },
      }),
    });
    renderPage();

    expect(
      await screen.findByText('Everything the site needs is filled in.'),
    ).toBeTruthy();
  });
});
