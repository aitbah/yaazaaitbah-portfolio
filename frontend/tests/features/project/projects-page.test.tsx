// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import admin from '../../../messages/en/admin.json';
import site from '../../../messages/en/site.json';
import responses from '../../../messages/en/responses.json';
import validation from '../../../messages/en/validation.json';
// The (protected) segment is what applies the session guard, and it is part of
// this path: moving the page out of that group breaks this import.
import ProjectsPage from '../../../src/app/[locale]/admin/(protected)/projects/page';
import { resetShowMore } from '../../../src/components/show-more';
import { chooseMenuItem, deleteRow, openRowMenu } from '../../support/menus';
import { localizedLabel } from '../../support/localized-label';
import { ToastViewport } from '../../../src/components/ui/toast';

// The same subset the admin layout supplies.
const messages = { ...admin, ...site, ...validation, ...responses };

const TYPESCRIPT = {
  id: '507f1f77bcf86cd799439011',
  kind: 'technology',
  name: { en: 'TypeScript' },
  category: 'frontend',
  level: 80,
  order: 0,
  updatedAt: '2026-09-02T10:00:00.000Z',
};

const DOCKER = {
  id: '507f1f77bcf86cd799439012',
  kind: 'tool',
  name: { en: 'Docker' },
  category: 'devops',
  level: 60,
  order: 0,
  updatedAt: '2026-09-02T10:00:00.000Z',
};

const PORTFOLIO = {
  id: '507f1f77bcf86cd7994390a1',
  slug: 'portfolio',
  title: { en: 'Portfolio' },
  description: { en: 'This site.' },
  stack: ['507f1f77bcf86cd799439011'],
  featured: true,
  order: 0,
  updatedAt: '2026-09-02T10:00:00.000Z',
};

const SCRAPER = {
  id: '507f1f77bcf86cd7994390a2',
  slug: 'scraper',
  title: { en: 'Scraper' },
  description: { en: 'Collects things.' },
  stack: [],
  featured: false,
  order: 0,
  updatedAt: '2026-09-02T10:00:00.000Z',
};

type Reply = { status: number; body: unknown };

const ok = (details: unknown): Reply => ({
  status: 200,
  body: { code: 'SUCCESS', details },
});
const UNREADABLE: Reply = {
  status: 500,
  body: { code: 'SERVER_ERROR', details: {} },
};
const DUPLICATE: Reply = {
  status: 409,
  body: { code: 'CONFLICT', details: { 'title.en': 'ALREADY_EXISTS' } },
};
const ABSENT_SKILL: Reply = {
  status: 422,
  body: { code: 'VALIDATION_ERROR', details: { stack: 'NOT_FOUND' } },
};

/** Every write, so a test can assert what actually went over the wire. */
let sent: { method: string; url: string; body: string | null }[] = [];

/**
 * A project's stack is technologies *and* tools, so the page reads two lists.
 * `stack` stands for both here; a test that needs one to fail passes it.
 */
function stubApi({
  projects = ok({ projects: [PORTFOLIO, SCRAPER] }),
  technologies = ok({ technologies: [TYPESCRIPT] }),
  tools = ok({ tools: [DOCKER] }),
  write,
}: {
  projects?: Reply;
  technologies?: Reply;
  tools?: Reply;
  write?: Reply;
} = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';

      if (method !== 'GET') {
        sent.push({
          method,
          url,
          body: typeof init?.body === 'string' ? init.body : null,
        });
      }

      const reply =
        method !== 'GET'
          ? (write ?? ok({ project: PORTFOLIO }))
          : url.includes('/api/technologies')
            ? technologies
            : url.includes('/api/tools')
              ? tools
              : projects;

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
      <NextIntlClientProvider locale="en" messages={messages}>
        <ToastViewport>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </ToastViewport>
      </NextIntlClientProvider>
    );
  }

  return render(<ProjectsPage />, { wrapper: Wrapper });
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

/** JSON.parse is `any`; every body is read through this one narrowing. */
function sentBody(index = 0): Record<string, unknown> {
  const write = sent[index];
  if (!write?.body) throw new Error(`no request was sent at ${index}`);

  return JSON.parse(write.body) as Record<string, unknown>;
}

async function openTheForm() {
  renderPage();
  await screen.findByText('Portfolio');
  fireEvent.click(screen.getByRole('button', { name: 'Add a project' }));
  await screen.findByText('New project');
}

beforeEach(() => {
  sent = [];
  stubApi();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // How far a list is open outlives its component, by design - so each test
  // starts every list closed.
  resetShowMore();
});

describe('a long list of projects', () => {
  /** One more than the admin's step, so exactly one card waits behind it. */
  const THIRTEEN = Array.from({ length: 13 }, (_, i) => ({
    ...SCRAPER,
    id: `507f1f77bcf86cd7994391${String(i).padStart(2, '0')}`,
    slug: `project-${i + 1}`,
    title: { en: `Project ${i + 1}` },
  }));

  it('shows the first twelve, and says so', async () => {
    stubApi({ projects: ok({ projects: THIRTEEN }) });
    renderPage();
    await screen.findByText('Project 1');

    expect(screen.getByText('Project 12')).toBeTruthy();
    expect(screen.queryByText('Project 13')).toBeNull();
    expect(screen.getByText('Showing 12 of 13')).toBeTruthy();
  });

  it('shows the rest when asked, and moves focus to it', async () => {
    stubApi({ projects: ok({ projects: THIRTEEN }) });
    renderPage();
    await screen.findByText('Project 1');

    fireEvent.click(screen.getByRole('button', { name: 'Show more projects' }));

    expect(screen.getByText('Project 13')).toBeTruthy();
    expect(document.activeElement?.textContent).toContain('Project 13');
    expect(
      screen.queryByRole('button', { name: 'Show more projects' }),
    ).toBeNull();
  });

  // A card moved past the last visible one would otherwise vanish mid-move.
  it('opens the next step when a card is moved past the last one showing', async () => {
    stubApi({ projects: ok({ projects: THIRTEEN }) });
    renderPage();
    await screen.findByText('Project 1');

    fireEvent.click(
      screen.getByRole('button', { name: 'Move Project 12 down' }),
    );

    await waitFor(() =>
      expect(screen.getByText('Showing 13 of 13')).toBeTruthy(),
    );
    expect(screen.getByText('Project 12')).toBeTruthy();
  });

  it('keeps the count across opening and closing the editor', async () => {
    stubApi({ projects: ok({ projects: THIRTEEN }) });
    renderPage();
    await screen.findByText('Project 1');

    fireEvent.click(screen.getByRole('button', { name: 'Show more projects' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a project' }));
    await screen.findByText('New project');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('Project 13')).toBeTruthy();
  });
});

describe('the projects page', () => {
  it('lists what the API returned, in the order it returned it', async () => {
    renderPage();
    await screen.findByText('Portfolio');

    const rows = screen.getAllByRole('listitem').map((li) => li.textContent);

    expect(rows[0]).toContain('Portfolio');
    expect(rows[1]).toContain('Scraper');
  });

  it('marks the featured ones and counts their stack', async () => {
    renderPage();
    await screen.findByText('Portfolio');

    const featured = screen
      .getAllByRole('listitem')
      .find((li) => li.textContent?.includes('Portfolio'));

    expect(featured?.textContent).toContain('Featured');
    expect(featured?.textContent).toContain('1 item');
    expect(
      screen
        .getAllByRole('listitem')
        .find((li) => li.textContent?.includes('Scraper'))?.textContent,
    ).toContain('Nothing');
  });

  it('says so when the portfolio has no projects yet', async () => {
    stubApi({ projects: ok({ projects: [] }) });
    renderPage();

    expect(await screen.findByText('No projects yet')).toBeTruthy();
  });

  it('reports a failed project read instead of offering an editor', async () => {
    stubApi({ projects: UNREADABLE });
    renderPage();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add a project' })).toBeNull();
  });

  // The form offers the technologies and tools that exist, so a failed read
  // disabling as a failed project read.
  it('reports a failed stack read the same way', async () => {
    stubApi({ technologies: UNREADABLE });
    renderPage();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add a project' })).toBeNull();
  });
});

describe('creating a project', () => {
  it('sends what was filled in, with the defaults for what was not', async () => {
    await openTheForm();

    type(localizedLabel('Title'), 'New thing');
    type(localizedLabel('Description'), 'It does things.');
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sent[0]?.method).toBe('POST');
    expect(sentBody()).toEqual({
      // Suggested from the title while it was typed, which is the whole
      // behaviour: an address exists without the owner having to invent one.
      slug: 'new-thing',
      title: { en: 'New thing' },
      description: { en: 'It does things.' },
      // An empty gallery is a real empty array, not an absent field, so the
      // API never has to tell "no images" from "no gallery sent".
      gallery: [],
      stack: [],
      featured: false,
      order: 0,
    });
  });

  /**
   * The four fields that say why the project was hard. Optional every one, so
   * the assertion that matters is the *absence* above: a project saved without
   * them sends nothing rather than four empty objects for the API to clear.
   */
  it('sends what the project says about itself, when it says it', async () => {
    await openTheForm();

    type(localizedLabel('Title'), 'New thing');
    type(localizedLabel('Description'), 'It does things.');
    type(localizedLabel('Your role'), 'Built the sync layer');
    type(
      localizedLabel('The problem'),
      'Two clients could write the same row.',
    );
    type(
      localizedLabel('The approach'),
      'Merged per field, not last-write-wins.',
    );
    type(localizedLabel('The outcome'), 'Conflicts went to none.');
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sentBody()).toMatchObject({
      role: { en: 'Built the sync layer' },
      problem: { en: 'Two clients could write the same row.' },
      approach: { en: 'Merged per field, not last-write-wins.' },
      outcome: { en: 'Conflicts went to none.' },
    });
  });

  // Blank is absent, not an empty object: `PUT` clears what it is not sent, and
  // an empty object would be a value that renders as nothing.
  it('omits a story field left blank', async () => {
    await openTheForm();

    type(localizedLabel('Title'), 'New thing');
    type(localizedLabel('Description'), 'It does things.');
    type(localizedLabel('Your role'), 'Built the sync layer');
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }));

    await waitFor(() => expect(sent.length).toBe(1));

    const body = sentBody();
    expect(body.role).toEqual({ en: 'Built the sync layer' });
    expect(body).not.toHaveProperty('problem');
    expect(body).not.toHaveProperty('approach');
    expect(body).not.toHaveProperty('outcome');
  });

  /**
   * The suggestion stops the moment the owner types their own. It has to: an
   * address that kept following the title would move a published project's URL
   * the day its name was tidied up.
   */
  it('stops suggesting an address once one is typed by hand', async () => {
    await openTheForm();

    type(localizedLabel('Title'), 'New thing');
    type('Address', 'a-chosen-address');
    type(localizedLabel('Title'), 'A completely different name');
    type(localizedLabel('Description'), 'It does things.');
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sentBody().slug).toBe('a-chosen-address');
  });

  it('offers the stack that exists and sends the chosen ids', async () => {
    await openTheForm();

    type(localizedLabel('Title'), 'New thing');
    type(localizedLabel('Description'), 'It does things.');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Docker' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sentBody().stack).toEqual(['507f1f77bcf86cd799439012']);
  });

  it('sends the featured flag as a boolean', async () => {
    await openTheForm();

    type(localizedLabel('Title'), 'New thing');
    type(localizedLabel('Description'), 'It does things.');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Featured' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sentBody().featured).toBe(true);
  });

  it('refuses an empty form and sends nothing', async () => {
    await openTheForm();

    fireEvent.click(screen.getByRole('button', { name: 'Save project' }));

    await screen.findAllByText('This field is required.');
    expect(sent).toEqual([]);
  });

  // Rendered as an href, so an unsafe protocol must never reach the API.
  it('rejects an unsafe repository link before sending', async () => {
    await openTheForm();

    type(localizedLabel('Title'), 'New thing');
    type(localizedLabel('Description'), 'It does things.');
    type('Repository URL', 'javascript:alert(1)');
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }));

    expect(await screen.findByText('Enter a valid URL.')).toBeTruthy();
    expect(sent).toEqual([]);
  });

  it('omits a link that was left blank rather than sending an empty string', async () => {
    await openTheForm();

    type(localizedLabel('Title'), 'New thing');
    type(localizedLabel('Description'), 'It does things.');
    type('Repository URL', 'https://github.com/me/repo');
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sentBody().repoUrl).toBe('https://github.com/me/repo');
    expect('liveUrl' in sentBody()).toBe(false);
  });

  it('puts a duplicate title on the title field and keeps the form open', async () => {
    stubApi({ write: DUPLICATE });
    await openTheForm();

    type(localizedLabel('Title'), 'Portfolio');
    type(localizedLabel('Description'), 'It does things.');
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(await screen.findByText('That name is already taken.')).toBeTruthy();
    expect(screen.queryByText('New project')).toBeTruthy();
  });

  /**
   * The group is a registered field, so the message lands on it rather than in
   * a banner - which is what should happen when a skill was deleted in another
   * tab between loading the form and saving it.
   */
  it('puts a rejected reference on the stack group', async () => {
    stubApi({ write: ABSENT_SKILL });
    await openTheForm();

    type(localizedLabel('Title'), 'New thing');
    type(localizedLabel('Description'), 'It does things.');
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(
      await screen.findByText('One of the selections no longer exists.'),
    ).toBeTruthy();
    // The field says what is wrong, so the banner would only repeat it.
    expect(
      screen.queryByText('Please check the highlighted fields and try again.'),
    ).toBeNull();
  });
});

describe('editing a project', () => {
  // Editing a title must never move an address that is already published.
  it('leaves an existing address alone when the title changes', async () => {
    renderPage();
    await screen.findByText('Portfolio');

    await openRowMenu('Actions for Portfolio');
    await chooseMenuItem('Edit');
    await screen.findByText('Edit Portfolio');

    type(localizedLabel('Title'), 'Portfolio v2');
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sentBody().slug).toBe('portfolio');
  });

  it('loads the project into the form and replaces it by id', async () => {
    renderPage();
    await screen.findByText('Portfolio');

    await openRowMenu('Actions for Portfolio');
    await chooseMenuItem('Edit');
    await screen.findByText('Edit Portfolio');

    expect(
      screen.getByLabelText<HTMLInputElement>(localizedLabel('Title')).value,
    ).toBe('Portfolio');
    // The skill it already uses is ticked; the other is not.
    expect(screen.getByRole('checkbox', { name: 'TypeScript' })).toHaveProperty(
      'ariaChecked',
      'true',
    );
    expect(screen.getByRole('checkbox', { name: 'Docker' })).toHaveProperty(
      'ariaChecked',
      'false',
    );

    type(localizedLabel('Title'), 'Portfolio v2');
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sent[0]?.method).toBe('PUT');
    expect(sent[0]?.url).toContain('/api/projects/507f1f77bcf86cd7994390a1');
    expect(sentBody().title).toEqual({ en: 'Portfolio v2' });
  });

  it('keeps a locale the form never rendered an input for', async () => {
    const translated = {
      ...PORTFOLIO,
      title: { en: 'Portfolio', de: 'Mappe' },
    };
    stubApi({ projects: ok({ projects: [translated] }) });
    renderPage();

    await screen.findByText('Portfolio');
    await openRowMenu('Actions for Portfolio');
    await chooseMenuItem('Edit');
    await screen.findByText('Edit Portfolio');

    type(localizedLabel('Title'), 'Portfolio v2');
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }));

    await waitFor(() => expect(sent.length).toBe(1));

    // PUT replaces the document, so a translation written through the API
    // would be deleted by an ordinary save.
    expect(sentBody().title).toEqual({ de: 'Mappe', en: 'Portfolio v2' });
  });

  it('closes the editor without sending anything on cancel', async () => {
    renderPage();
    await screen.findByText('Portfolio');

    await openRowMenu('Actions for Portfolio');
    await chooseMenuItem('Edit');
    await screen.findByText('Edit Portfolio');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await screen.findByRole('button', { name: 'Add a project' });
    expect(sent).toEqual([]);
  });
});

describe('deleting a project', () => {
  it('asks first, and does nothing when the admin declines', async () => {
    renderPage();
    await screen.findByText('Portfolio');

    await openRowMenu('Actions for Portfolio');
    await chooseMenuItem('Delete');

    expect(await screen.findByRole('alertdialog')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(sent).toEqual([]);
  });

  it('deletes by id once the admin confirms', async () => {
    renderPage();
    await screen.findByText('Portfolio');

    await deleteRow('Actions for Portfolio');

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sent[0]?.method).toBe('DELETE');
    expect(sent[0]?.url).toContain('/api/projects/507f1f77bcf86cd7994390a1');
  });
});
