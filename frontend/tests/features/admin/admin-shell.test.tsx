// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import admin from '../../../messages/en/admin.json';
import site from '../../../messages/en/site.json';
import responses from '../../../messages/en/responses.json';
import validation from '../../../messages/en/validation.json';
import ProtectedAdminLayout from '../../../src/app/[locale]/admin/(protected)/layout';
import { SidebarProvider } from '../../../src/components/ui/sidebar';
import { TooltipProvider } from '../../../src/components/ui/tooltip';
import { AdminHeader } from '../../../src/features/admin/admin-header';
import { AdminSidebar } from '../../../src/features/admin/admin-sidebar';

// Mutable, so a test can put the browser on another admin page.
const nav = vi.hoisted(() => ({
  pathname: '/admin',
  replace: vi.fn(),
  // The sidebar's links navigate themselves now, so that they can ask before
  // discarding an edited form.
  push: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
  usePathname: () => nav.pathname,
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
}));

// The same subset the admin layout supplies.
// `site` carries the theme labels the header's toggle reads.
const messages = { ...admin, ...site, ...validation, ...responses };

const EMAIL = 'admin@example.com';
const PROFILE = {
  firstName: { en: 'Yaaza' },
  lastName: { en: 'Ait Bah' },
  headline: { en: 'Full-stack developer' },
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </NextIntlClientProvider>
  );
}

/** The pieces on their own; the layout supplies both providers in real use. */
function renderShell() {
  function Wrapper({ children }: { children: ReactNode }) {
    return providers({
      children: (
        <TooltipProvider>
          <SidebarProvider>{children}</SidebarProvider>
        </TooltipProvider>
      ),
    });
  }

  return render(
    <>
      <AdminSidebar />
      <AdminHeader />
    </>,
    { wrapper: Wrapper },
  );
}

/**
 * The header on its own.
 *
 * Narrower than `renderShell` on purpose: the tests that stub `location` are
 * about the header, and the sidebar's avatar asks `next/image` to resolve a
 * relative URL against `window.location` - so stubbing it whole breaks a
 * component none of those tests are about.
 */
function renderHeader() {
  function Wrapper({ children }: { children: ReactNode }) {
    return providers({
      children: (
        <TooltipProvider>
          <SidebarProvider>{children}</SidebarProvider>
        </TooltipProvider>
      ),
    });
  }

  return render(<AdminHeader />, { wrapper: Wrapper });
}

/** The sidebar's own navigation, apart from the breadcrumb's. */
function sidebarNav() {
  return within(screen.getByRole('navigation', { name: 'Admin navigation' }));
}

/** The sidebar header's first line, which is the title. */
function sidebarTitle(): string {
  const header = document.querySelector('[data-sidebar="header"]');

  return header?.firstElementChild?.textContent ?? '';
}

function renderLayout() {
  return render(<ProtectedAdminLayout>content</ProtectedAdminLayout>, {
    wrapper: ({ children }: { children: ReactNode }) => providers({ children }),
  });
}

beforeEach(() => {
  nav.pathname = '/admin';
  nav.replace.mockClear();
  nav.push.mockClear();
  // jsdom has no matchMedia, and the sidebar asks it whether it is on mobile.
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  stubApi();
});

/**
 * Answers per endpoint, because the shell now reads two: the session knows the
 * account, and the profile knows the person whose name the sidebar shows.
 * `profile` is what a test varies - `null` is a fresh install with nothing
 * saved yet, which is the fallback case worth pinning.
 */
function stubApi(profile: Record<string, unknown> | null = PROFILE) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => {
      const details = String(url).includes('/api/profile')
        ? { profile }
        : { user: { id: '1', email: EMAIL, role: 'admin' } };

      if (String(url).includes('/api/profile') && profile === null) {
        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ code: 'NOT_FOUND', details: {} }),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ code: 'SUCCESS', details }),
      });
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('admin shell', () => {
  it('renders the navigation and the identity as written text', async () => {
    const { container } = renderShell();

    // Scoped: the breadcrumb roots at the dashboard's label too.
    expect(sidebarNav().getByText('Dashboard')).toBeDefined();
    expect(await screen.findByText(EMAIL)).toBeDefined();

    // The bug the login suite exists for, guarded here too.
    expect(container.textContent).not.toContain('admin.');
  });

  /**
   * The header carries the trigger and the breadcrumb, and nothing about the
   * account: sign-out ends a session mid-edit, and the top-right corner of
   * every screen is where a misclick finds it.
   */
  it('keeps the account out of the header', async () => {
    renderShell();

    await screen.findByText(EMAIL);

    const header = document.querySelector('header');

    expect(header).not.toBeNull();
    expect(header?.textContent).not.toContain(EMAIL);
    expect(header?.textContent).not.toContain('Sign out');
  });

  /** The sidebar footer is where the account went, with the person on it. */
  it('names the signed-in person in the sidebar footer', async () => {
    renderShell();

    expect(await screen.findByText('Yaaza Ait Bah')).toBeDefined();
    expect(screen.getByText(EMAIL)).toBeDefined();
  });

  /** A fresh install has no profile, and the address is all there is to say. */
  it('falls back to the address before a profile exists', async () => {
    stubApi(null);
    renderShell();

    expect(await screen.findByText(EMAIL)).toBeDefined();
    expect(screen.queryByText('Yaaza Ait Bah')).toBeNull();
  });

  it("titles the sidebar with the owner's name", async () => {
    renderShell();

    await screen.findByText(EMAIL);
    expect(sidebarTitle()).toBe('Portfolio Yaaza Ait Bah');
  });

  // Scoped to the sidebar header: the breadcrumb roots at the same title, so
  // an unscoped query would find the fallback whether or not the header uses it.
  it('titles the sidebar generically before a profile exists', async () => {
    stubApi(null);
    renderShell();

    await screen.findByText(EMAIL);
    expect(sidebarTitle()).toBe('Portfolio Admin');
  });

  it('keeps sign-out behind the account menu', async () => {
    renderShell();

    await screen.findByText(EMAIL);
    expect(screen.queryByText('Sign out')).toBeNull();

    fireEvent.keyDown(
      screen.getByRole('button', { name: `Account menu for ${EMAIL}` }),
      { key: 'Enter' },
    );

    expect(
      await screen.findByRole('menuitem', { name: 'Sign out' }),
    ).toBeDefined();
  });

  it('signs out and returns to the login page', async () => {
    renderShell();

    await screen.findByText(EMAIL);
    fireEvent.keyDown(
      screen.getByRole('button', { name: `Account menu for ${EMAIL}` }),
      { key: 'Enter' },
    );
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }));

    await waitFor(() => {
      const calls = vi.mocked(globalThis.fetch).mock.calls;

      expect(calls.some(([, init]) => init?.method === 'POST')).toBe(true);
    });
  });

  /**
   * With the sidebar collapsed to a rail its labels are hidden, and the page's
   * own heading scrolls away - so the header has to say where you are.
   */
  it('names the current section in the breadcrumb', () => {
    nav.pathname = '/admin/skills';
    renderShell();

    const breadcrumb = screen.getByRole('navigation', { name: 'breadcrumb' });

    expect(breadcrumb.textContent).toContain('Skills');
    expect(breadcrumb.textContent).toContain('Dashboard');
  });

  // A route with no entry of its own must not invent a label from the URL.
  it('shows the root alone for a page with no navigation entry', () => {
    nav.pathname = '/admin/nothing-here';
    renderShell();

    const breadcrumb = screen.getByRole('navigation', { name: 'breadcrumb' });

    expect(breadcrumb.textContent).toBe('Dashboard');
  });

  it('marks the current page as the active navigation entry', () => {
    renderShell();

    const dashboard = sidebarNav().getByText('Dashboard').closest('a');
    expect(dashboard?.getAttribute('data-active')).toBe('true');
  });

  it('links to the profile page', () => {
    renderShell();

    const profile = screen.getByText('Profile').closest('a');
    expect(profile?.getAttribute('href')).toBe('/admin/profile');
  });

  it('moves the active entry with the current page', () => {
    nav.pathname = '/admin/profile';
    renderShell();

    // Scoped to the sidebar: the breadcrumb names the current section too.
    const sidebar = sidebarNav();

    expect(sidebar.getByText('Profile').closest('a')?.dataset.active).toBe(
      'true',
    );
    expect(
      sidebar.getByText('Dashboard').closest('a')?.dataset.active,
    ).not.toBe('true');
  });

  /**
   * The vendored trigger labels itself in English; the shell overrides it.
   *
   * And exactly one control carries that name. The rail along the sidebar's
   * edge does the same job for the mouse, and upstream puts it in the tree as
   * a second button - under an English label, on every page. It is hidden from
   * the tree now, so what is asserted here is both halves: the trigger is
   * named in the reader's language, and nothing else is named the same.
   */
  it('gives the sidebar exactly one translated toggle', () => {
    const { container } = renderShell();

    expect(screen.getAllByLabelText('Toggle the navigation menu')).toHaveLength(
      1,
    );
    expect(
      container
        .querySelector('[data-slot="sidebar-trigger"]')
        ?.getAttribute('aria-label'),
    ).toBe('Toggle the navigation menu');

    // The rail keeps a visible native tooltip and stays out of the tree.
    const rail = container.querySelector('[data-slot="sidebar-rail"]');

    expect(rail).not.toBeNull();
    expect(rail?.getAttribute('title')).toBe('Toggle the navigation menu');
    expect(rail?.getAttribute('aria-hidden')).toBe('true');
  });

  // The vendored sidebar renders only divs, so the landmark is ours to add.
  /**
   * The header carries the account menu and the sidebar trigger. Inside `main`
   * it is announced as part of the page's content, so every page would begin
   * with the account before its own heading.
   */
  it('keeps the header out of the main landmark', async () => {
    renderLayout();

    const main = await screen.findByRole('main');

    expect(main.querySelector('header')).toBeNull();
  });

  it('marks the page content as the main landmark', async () => {
    renderLayout();

    expect((await screen.findByRole('main')).textContent).toContain('content');
  });

  /**
   * A flat list reads as one undifferentiated column, and one group of eleven
   * was still a list. The sections are real headings, not just a smaller font,
   * and none of them repeats the name of an entry inside it.
   */
  it('groups the navigation under labelled sections', () => {
    renderShell();

    for (const label of [
      'Overview',
      'Personal',
      'Expertise',
      'Career',
      'Qualifications',
      'Inbox',
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('still reaches every page from the sidebar', () => {
    renderShell();

    const targets = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    for (const href of [
      '/admin',
      '/admin/profile',
      '/admin/skills',
      '/admin/technologies',
      '/admin/tools',
      '/admin/experience',
      '/admin/education',
      '/admin/certifications',
      '/admin/courses',
      '/admin/languages',
      '/admin/projects',
      '/admin/social-links',
      '/admin/messages',
    ]) {
      expect(targets).toContain(href);
    }
  });

  it('puts the navigation in a named landmark', () => {
    renderShell();

    expect(
      screen.getByRole('navigation', { name: 'Admin navigation' }),
    ).toBeDefined();
  });
});

/**
 * Language and theme sit in the header, as the same control twice.
 *
 * The language switch used to be a radio group inside the account menu, two
 * clicks deep and one row above "Log out". Both of these change how the screen
 * is drawn, both are reversible in one click, and neither is an account action.
 */
describe('the header settings', () => {
  function header() {
    return within(screen.getByRole('banner'));
  }

  it('offers every configured language, with the current one marked', () => {
    renderShell();

    const languages = header().getByRole('radiogroup', {
      name: 'Interface language',
    });

    expect(
      within(languages)
        .getByRole('radio', { name: 'English' })
        .getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      within(languages).getByRole('radio', { name: 'français' }),
    ).toBeDefined();
  });

  // Each language named in itself - "français", not "French" - because the
  // person who needs the switch is the one who cannot read what is on screen.
  // In its own spelling too: French does not capitalise its language names.
  /**
   * The same page in the other language, and by loading the document rather
   * than navigating within it.
   *
   * `[locale]` sits above everything, so changing it re-renders the root layout
   * on the client - and React then writes `<html>`'s attributes from JSX that
   * carries no class, wiping the one the theme script put there. Switching
   * language turned a dark admin white. `keeps the theme` in the end-to-end
   * suite is the test of the symptom; this is the test of the mechanism.
   */
  it('keeps you on the page you are on, by loading it', () => {
    const assign = vi.fn();

    vi.stubGlobal('location', { assign, search: '', hash: '' });
    nav.pathname = '/admin/projects';
    renderHeader();

    fireEvent.click(screen.getByRole('radio', { name: 'français' }));

    expect(assign).toHaveBeenCalledWith('/fr/admin/projects');
    // Not a client navigation: that is what wiped the theme.
    expect(nav.replace).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  // A query string or a fragment is part of where you are.
  it('carries the rest of the address with it', () => {
    const assign = vi.fn();

    vi.stubGlobal('location', {
      assign,
      search: '?list=skill-category',
      hash: '#top',
    });
    nav.pathname = '/admin/options';
    renderHeader();

    fireEvent.click(screen.getByRole('radio', { name: 'français' }));

    expect(assign).toHaveBeenCalledWith(
      '/fr/admin/options?list=skill-category#top',
    );

    vi.unstubAllGlobals();
  });

  it('offers the theme beside it', () => {
    renderShell();

    expect(header().getByRole('radiogroup', { name: 'Theme' })).toBeDefined();
  });
});

describe('the assembled admin layout', () => {
  // SidebarInset is itself a <main>: wrapping the children in another one
  // nests two, which the HTML spec forbids and screen readers stumble on.
  it('exposes exactly one main landmark', async () => {
    const { container } = renderLayout();

    await screen.findByText('content');
    expect(container.querySelectorAll('main')).toHaveLength(1);
  });
});
