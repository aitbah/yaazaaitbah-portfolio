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
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import admin from '../../../messages/en/admin.json';
import site from '../../../messages/en/site.json';
import responses from '../../../messages/en/responses.json';
import validation from '../../../messages/en/validation.json';
import SkillsPage from '../../../src/app/[locale]/admin/(protected)/skills/page';
import TechnologiesPage from '../../../src/app/[locale]/admin/(protected)/technologies/page';
import ToolsPage from '../../../src/app/[locale]/admin/(protected)/tools/page';
import ProjectsPage from '../../../src/app/[locale]/admin/(protected)/projects/page';
import { optionsReply } from '../../support/options';
import { localizedLabel } from '../../support/localized-label';
import { ToastViewport } from '../../../src/components/ui/toast';

const messages = { ...admin, ...site, ...validation, ...responses };

const TYPESCRIPT = {
  id: '507f1f77bcf86cd799439011',
  kind: 'technology',
  name: { en: 'TypeScript' },
  category: 'frontend',
  level: 90,
  order: 0,
  updatedAt: '2026-09-04T10:00:00.000Z',
};

const DOCKER = {
  id: '507f1f77bcf86cd799439012',
  kind: 'tool',
  name: { en: 'Docker' },
  category: 'devops',
  level: 80,
  order: 0,
  updatedAt: '2026-09-04T10:00:00.000Z',
};

const PROBLEM_SOLVING = {
  id: '507f1f77bcf86cd799439013',
  kind: 'skill',
  name: { en: 'Problem Solving' },
  category: 'engineering',
  level: 92,
  order: 0,
  updatedAt: '2026-09-04T10:00:00.000Z',
};

/** Which resource each request asked for, so a test can prove the separation. */
let asked: string[] = [];

function stubApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      // Every screen with a dropdown reads the option lists, so every stub
      // has to answer for them - the labels come from there now.
      const options = optionsReply(String(url));

      if (options) {
        return Promise.resolve(options);
      }

      asked.push(url);

      const details = url.includes('/api/technologies')
        ? { technologies: [TYPESCRIPT] }
        : url.includes('/api/tools')
          ? { tools: [DOCKER] }
          : url.includes('/api/skills')
            ? { skills: [PROBLEM_SOLVING] }
            : { projects: [] };

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ code: 'SUCCESS', details }),
      });
    }),
  );
}

function renderPage(page: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ToastViewport>
        <QueryClientProvider client={queryClient}>{page}</QueryClientProvider>
      </ToastViewport>
    </NextIntlClientProvider>,
  );
}

async function openTheForm(add: string) {
  const [button] = await screen.findAllByRole('button', { name: add });
  fireEvent.click(button!);
}

beforeEach(() => {
  asked = [];
  stubApi();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('three pages, three lists', () => {
  const PAGES: {
    page: ReactNode;
    heading: string;
    only: string;
    resource: string;
  }[] = [
    {
      page: <SkillsPage />,
      heading: 'Skills',
      only: 'Problem Solving',
      resource: '/api/skills',
    },
    {
      page: <TechnologiesPage />,
      heading: 'Technologies',
      only: 'TypeScript',
      resource: '/api/technologies',
    },
    {
      page: <ToolsPage />,
      heading: 'Tools',
      only: 'Docker',
      resource: '/api/tools',
    },
  ];

  it.each(PAGES)(
    'shows only its own kind on $heading',
    async ({ page, heading, only, resource }) => {
      renderPage(page);

      expect(
        await screen.findByRole('heading', { level: 1, name: heading }),
      ).toBeTruthy();
      expect(await screen.findByText(only)).toBeTruthy();

      // The resource is the separation: no filter to omit, no mixed list.
      expect(asked.some((url) => url.includes(resource))).toBe(true);
    },
  );
});

/**
 * There is no brand mark for "Problem Solving", so the skill form has no
 * picker at all rather than one that can never match anything. The API refuses
 * the field too - this is the half the admin can see.
 */
describe('only two kinds carry a logo', () => {
  it('offers no logo picker on a skill', async () => {
    renderPage(<SkillsPage />);
    await screen.findByText('Problem Solving');
    await openTheForm('Add a skill');

    expect(await screen.findByLabelText(localizedLabel('Name'))).toBeTruthy();
    expect(screen.queryByLabelText('Search logos')).toBeNull();
    expect(screen.queryByText('Branding')).toBeNull();
  });

  it.each([
    { page: <TechnologiesPage />, add: 'Add a technology' },
    { page: <ToolsPage />, add: 'Add a tool' },
  ])('offers one behind "$add"', async ({ page, add }) => {
    renderPage(page);
    await openTheForm(add);

    expect(await screen.findByLabelText('Search logos')).toBeTruthy();
  });
});

/**
 * The categories are per kind, which is the point of the split rather than a
 * side effect: a technology is never `collaboration` and a skill is never
 * `database`.
 */
describe('each kind offers its own categories', () => {
  async function categories(add: string) {
    await openTheForm(add);

    const trigger = await screen.findByRole('combobox', { name: /Category/ });
    fireEvent.keyDown(trigger, { key: 'Enter' });

    return (await screen.findAllByRole('option')).map((o) => o.textContent);
  }

  it('offers capabilities on a skill, and nothing technical', async () => {
    renderPage(<SkillsPage />);

    const options = await categories('Add a skill');

    expect(options).toContain('Collaboration');
    expect(options).toContain('Architecture');
    expect(options).not.toContain('Database');
    expect(options).not.toContain('Frontend');
  });

  it('offers the stack on a technology, and no soft skills', async () => {
    renderPage(<TechnologiesPage />);

    const options = await categories('Add a technology');

    expect(options).toContain('Database');
    expect(options).toContain('Language');
    expect(options).not.toContain('Collaboration');
  });
});

/**
 * A project's stack is what it was built with. "Problem Solving" on a project
 * card is not something the public site could render meaningfully, so the
 * picker never offers it - and the API refuses it even if something did.
 */
describe('a project links to technologies and tools', () => {
  it('groups them by kind and offers no skills', async () => {
    renderPage(<ProjectsPage />);
    await openTheForm('Add a project');

    const group = await screen.findByRole('group', { name: 'Built with' });

    expect(
      within(group).getByRole('checkbox', { name: 'TypeScript' }),
    ).toBeTruthy();
    expect(
      within(group).getByRole('checkbox', { name: 'Docker' }),
    ).toBeTruthy();
    expect(
      within(group).queryByRole('checkbox', { name: 'Problem Solving' }),
    ).toBeNull();

    // Grouped, because a flat list mixes two different claims into one wall
    // of checkboxes.
    expect(within(group).getByText('Technologies')).toBeTruthy();
    expect(within(group).getByText('Tools')).toBeTruthy();
  });

  it('never asks for the skills at all', async () => {
    renderPage(<ProjectsPage />);
    await openTheForm('Add a project');

    await waitFor(() =>
      expect(asked.some((url) => url.includes('/api/technologies'))).toBe(true),
    );
    expect(asked.some((url) => url.includes('/api/skills'))).toBe(false);
  });
});
