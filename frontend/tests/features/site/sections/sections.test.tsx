// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import home from '../../../../messages/en/home.json';
import { optionText } from '../../../../src/features/option/option-text';
import { ContactSection } from '../../../../src/features/site/sections/contact-section';
import { ExpertiseSection } from '../../../../src/features/site/sections/expertise-section';
import { Hero } from '../../../../src/features/site/sections/hero';
import { PathSection } from '../../../../src/features/site/sections/path-section';
import { ProfileSection } from '../../../../src/features/site/sections/profile-section';
import {
  ProjectBody,
  ProjectLinks,
  stackOf,
} from '../../../../src/features/site/sections/project-body';
import { RecordSection } from '../../../../src/features/site/sections/record-section';
import { SiteFooter } from '../../../../src/features/site/sections/site-footer';
import { SiteHeader } from '../../../../src/features/site/site-header';
import {
  CREDENTIALS,
  EDUCATION,
  EXPERIENCE,
  LANGUAGES,
  OPTIONS,
  PROJECTS,
  SKILLS,
  SOCIAL,
  TECHNOLOGIES,
  TOOLS,
  project,
} from './fixtures';

// The server's translator is the real one, over the real English messages.
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
// The language switcher reads the router, which a unit test has none of.
vi.mock('../../../../src/components/language-switcher', () => ({
  LanguageSwitcher: () => null,
}));

const text = optionText(OPTIONS, 'en');
const t = home.home;
const show = (ui: ReactNode) =>
  render(
    <NextIntlClientProvider locale="en" messages={home}>
      {ui}
    </NextIntlClientProvider>,
  );

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the opening', () => {
  it('names the owner once, says what they do, and offers the work and a way to write', () => {
    show(
      <Hero
        firstName="Yaaza"
        lastName="Ait Bah"
        headline="Full-stack web developer"
        photo={{ url: '/uploads/profile/me.webp', alt: 'Yaaza Ait Bah' }}
        facts={[
          { label: t.hero.basedIn, value: 'Casablanca, Morocco' },
          { label: t.hero.status, value: 'Open to work', open: true },
        ]}
        actions={{ work: t.hero.work, contact: t.hero.contact }}
      />,
    );

    expect(
      screen.getByRole('heading', { level: 1 }).getAttribute('aria-label'),
    ).toBe('Yaaza Ait Bah');
    expect(screen.getByText('Full-stack web developer')).toBeDefined();
    expect(screen.getByText('Casablanca, Morocco')).toBeDefined();
    expect(screen.getByRole('img', { name: 'Yaaza Ait Bah' })).toBeDefined();
    expect(
      screen
        .getByRole('link', { name: new RegExp(t.hero.work) })
        .getAttribute('href'),
    ).toBe('#work');
    expect(
      screen
        .getByRole('link', { name: new RegExp(t.hero.contact) })
        .getAttribute('href'),
    ).toBe('#contact');
    // Open to work: its marker is filled.
    expect(
      screen.getByText('Open to work').querySelector('i')?.className,
    ).toContain('bg-site-red');
  });

  it('stands without a photograph, and offers no work when there is none', () => {
    show(
      <Hero
        firstName="Yaaza"
        lastName="Ait Bah"
        headline=""
        facts={[]}
        actions={{ contact: t.hero.contact }}
      />,
    );

    expect(document.querySelector('[data-hero-figure]')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
    expect(
      screen.queryByRole('link', { name: new RegExp(t.hero.work) }),
    ).toBeNull();
  });
});

describe('the profile', () => {
  it('sets each paragraph of the biography', () => {
    show(
      <ProfileSection title={t.profile.title} paragraphs={['One.', 'Two.']} />,
    );

    expect(
      screen.getByRole('heading', { name: t.profile.title }),
    ).toBeDefined();
    expect(screen.getAllByText(/One\.|Two\./)).toHaveLength(2);
    // Every paragraph is set as the statement, and lit as it is read.
    expect(screen.getByText('One.').hasAttribute('data-lead')).toBe(true);
    expect(screen.getByText('Two.').hasAttribute('data-lead')).toBe(true);
  });
});

describe('a project', () => {
  it('reads its stack by id, in its own order, skipping what no longer exists', () => {
    expect(
      stackOf(PROJECTS[1]!, [...TECHNOLOGIES, ...TOOLS]).map((row) => row.id),
    ).toEqual(['t1', 't2']);
  });

  it('tells the case: description, role, the steps it has, and the stack', async () => {
    show(
      await ProjectBody({
        project: PROJECTS[1]!,
        expertise: [...TECHNOLOGIES, ...TOOLS],
        locale: 'en',
      }),
    );

    expect(screen.getByText('A marketplace.')).toBeDefined();
    expect(screen.getByText('Everything.')).toBeDefined();
    expect(screen.getByText(t.work.problem)).toBeDefined();
    expect(screen.getByText(t.work.outcome)).toBeDefined();
    // No approach is stored, so it is left out rather than labelled empty.
    expect(screen.queryByText(t.work.approach)).toBeNull();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(
      ['React', 'Laravel'],
    );
  });

  it('leaves out what is not stored', async () => {
    show(
      await ProjectBody({
        project: project({ description: { en: 'Only this.' } }),
        expertise: [],
        locale: 'en',
      }),
    );

    expect(screen.queryByText(t.work.role)).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('links to the site and the source, and to nothing when there are none', async () => {
    show(await ProjectLinks({ project: PROJECTS[1]!, locale: 'en' }));

    expect(
      screen
        .getByRole('link', { name: new RegExp(t.work.live) })
        .getAttribute('href'),
    ).toBe('https://example.test');
    expect(
      screen
        .getByRole('link', { name: new RegExp(t.work.source) })
        .getAttribute('rel'),
    ).toContain('noopener');
    cleanup();
    expect(
      await ProjectLinks({ project: project({}), locale: 'en' }),
    ).toBeNull();
  });
});

describe('the expertise', () => {
  it('sets each kind as a grid of tiles, each said with its level and category', async () => {
    show(
      await ExpertiseSection({
        rows: { skills: SKILLS, technologies: TECHNOLOGIES, tools: TOOLS },
        optionText: text,
        locale: 'en',
      }),
    );

    for (const kind of [
      t.expertise.skills,
      t.expertise.technologies,
      t.expertise.tools,
    ]) {
      expect(
        screen.getByRole('heading', { name: new RegExp(kind) }),
      ).toBeDefined();
    }
    expect(screen.getByText('Frontend, level 85 of 100')).toBeDefined();
    // Each tile's ring is filled to its level.
    const tiles = [...document.querySelectorAll<HTMLElement>('[data-tile]')];

    expect(tiles).toHaveLength(
      SKILLS.length + TECHNOLOGIES.length + TOOLS.length,
    );
    expect(
      tiles.every((tile) => tile.style.getPropertyValue('--level') !== ''),
    ).toBe(true);
  });

  it('leaves out a kind with nothing in it', async () => {
    show(
      await ExpertiseSection({
        rows: { skills: SKILLS, technologies: [], tools: [] },
        optionText: text,
        locale: 'en',
      }),
    );

    expect(
      screen.queryByRole('heading', { name: new RegExp(t.expertise.tools) }),
    ).toBeNull();
    expect(document.querySelectorAll('[data-tiles]')).toHaveLength(1);
  });
});

describe('the path', () => {
  it('sets experience, then education, each most recent first, with how long', async () => {
    show(
      await PathSection({
        experience: EXPERIENCE,
        education: EDUCATION,
        optionText: text,
        locale: 'en',
        today: new Date(Date.UTC(2026, 9, 13)),
      }),
    );

    const [work, school] = screen.getAllByRole('list');
    const job = within(work!).getByRole('listitem');
    const course = within(school!).getByRole('listitem');

    expect(
      screen
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual([t.path.experience, t.path.education]);
    expect(within(job).getByRole('heading').textContent).toBe('Developer');
    expect(within(job).getByText(/Full-time/)).toBeDefined();
    expect(within(job).getByText(new RegExp(t.path.present))).toBeDefined();
    expect(within(course).getByRole('heading').textContent).toBe('Technician');
    expect(within(course).getByText(/Vocational training/)).toBeDefined();
  });

  it('is nothing without a dated stint', async () => {
    expect(
      await PathSection({
        experience: [],
        education: [],
        optionText: text,
        locale: 'en',
        today: new Date(),
      }),
    ).toBeNull();
  });
});

describe('the record', () => {
  it('lists each credential with what it carries, and each language on the scale', async () => {
    show(
      await RecordSection({
        credentials: CREDENTIALS,
        languages: LANGUAGES,
        options: OPTIONS,
        optionText: text,
        locale: 'en',
      }),
    );

    expect(screen.getByText(t.record.certification)).toBeDefined();
    expect(screen.getByText(t.record.course)).toBeDefined();
    expect(screen.getByText(/ABC-1/)).toBeDefined();
    expect(
      screen
        .getByRole('link', { name: new RegExp(t.record.view) })
        .getAttribute('href'),
    ).toBe('https://example.test/c');
    // Arabic first: the languages keep the admin's order.
    const scales = screen.getAllByRole('img');

    expect(scales.map((scale) => scale.getAttribute('aria-label'))).toEqual([
      'Native',
      'B1 — Intermediate',
    ]);
    expect(scales[1]!.querySelectorAll('[data-step="on"]')).toHaveLength(2);
  });
});

describe('the contact', () => {
  it('offers the email, the facts, the CV and the profiles elsewhere', async () => {
    show(
      await ContactSection({
        locale: 'en',
        email: 'me@example.test',
        location: 'Casablanca',
        availability: 'Not looking',
        resume: { href: '/uploads/resume/cv.pdf', language: 'en' },
        socialLinks: SOCIAL,
        options: OPTIONS,
        optionText: text,
      }),
    );

    expect(
      screen
        .getAllByRole('link', { name: /me@example\.test/ })[0]!
        .getAttribute('href'),
    ).toBe('mailto:me@example.test');
    expect(
      screen.getByRole('link', { name: /Download/ }).getAttribute('href'),
    ).toBe('/uploads/resume/cv.pdf');
    expect(
      screen.getByRole('link', { name: /GitHub/ }).getAttribute('rel'),
    ).toContain('me');
    expect(screen.getByRole('button', { name: t.contact.send })).toBeDefined();
  });

  it('has no CV and no email when none is published', async () => {
    show(
      await ContactSection({
        locale: 'en',
        socialLinks: [],
        options: OPTIONS,
        optionText: text,
      }),
    );

    expect(
      screen.queryByRole('link', { name: new RegExp(t.contact.cv) }),
    ).toBeNull();
    expect(screen.queryByRole('link', { name: /@/ })).toBeNull();
  });
});

describe('the frame', () => {
  it('names the sections that have content, and switches the theme', async () => {
    // The theme switch asks the system for its preference.
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    show(
      await SiteHeader({
        name: 'Yaaza Ait Bah',
        sections: ['work', 'contact'],
        locale: 'en',
      }),
    );

    const nav = screen.getByRole('navigation', { name: t.nav.label });

    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['#work']);
    // Contact is the bar's one action, beside the sections.
    expect(
      screen
        .getByRole('link', { name: new RegExp(t.nav.talk) })
        .getAttribute('href'),
    ).toBe('#contact');
    expect(screen.getByRole('button', { name: /theme/ })).toBeDefined();
  });

  it('invites a message, offers the CV, the sections and the profiles, and ends on the way back up', async () => {
    show(
      await SiteFooter({
        locale: 'en',
        firstName: 'Yaaza',
        lastName: 'Ait Bah',
        updatedAt: '2026-10-10T00:00:00Z',
        email: 'me@example.test',
        resume: { href: '/uploads/resume/cv.pdf', language: 'en' },
        location: 'Casablanca',
        availability: 'Not looking',
        sections: ['work', 'contact'],
        socialLinks: SOCIAL,
        options: OPTIONS,
        optionText: text,
      }),
    );

    const footer = screen.getByRole('contentinfo');

    expect(footer.textContent).toContain('Oct 2026');
    expect(footer.textContent).toContain('Casablanca');
    expect(
      screen
        .getByRole('link', { name: new RegExp(t.footer.write) })
        .getAttribute('href'),
    ).toBe('mailto:me@example.test');
    expect(
      screen
        .getByRole('link', { name: new RegExp(t.contact.cv) })
        .getAttribute('href'),
    ).toBe('/uploads/resume/cv.pdf');
    expect(
      within(screen.getByRole('navigation', { name: t.footer.sections }))
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['#work', '#contact']);
    expect(
      screen.getByRole('link', { name: /GitHub/ }).getAttribute('rel'),
    ).toContain('me');
    expect(
      screen
        .getByRole('link', { name: new RegExp(t.nav.top) })
        .getAttribute('href'),
    ).toBe('#top');
  });
});
