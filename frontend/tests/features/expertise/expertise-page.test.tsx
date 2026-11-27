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
import TechnologiesPage from '../../../src/app/[locale]/admin/(protected)/technologies/page';
import { optionsReply } from '../../support/options';
import { chooseMenuItem, deleteRow, openRowMenu } from '../../support/menus';
import { localizedLabel } from '../../support/localized-label';
import { ToastViewport } from '../../../src/components/ui/toast';

// The same subset the admin layout supplies.
const messages = { ...admin, ...site, ...validation, ...responses };

const TYPESCRIPT = {
  id: 'a1',
  name: { en: 'TypeScript' },
  category: 'frontend',
  level: 80,
  order: 0,
  updatedAt: '2026-09-02T10:00:00.000Z',
};

const DOCKER = {
  id: 'b2',
  name: { en: 'Docker' },
  category: 'infrastructure',
  level: 60,
  order: 0,
  updatedAt: '2026-09-02T10:00:00.000Z',
};

type Reply = { status: number; body: unknown };

const listed = (rows: unknown[]): Reply => ({
  status: 200,
  body: { code: 'SUCCESS', details: { technologies: rows } },
});
const created = (row: unknown): Reply => ({
  status: 200,
  body: { code: 'SUCCESS', details: { technology: row } },
});
const UNREADABLE: Reply = {
  status: 500,
  body: { code: 'SERVER_ERROR', details: {} },
};
const UNRENDERABLE: Reply = {
  status: 422,
  body: { code: 'VALIDATION_ERROR', details: { order: 'TOO_SMALL' } },
};
// Names the localized field itself rather than one of its locales - the form
// renders an input per locale, so nothing on screen can carry this message.
const BAD_LOCALE_KEY: Reply = {
  status: 422,
  body: { code: 'VALIDATION_ERROR', details: { name: 'INVALID_KEY' } },
};
const STALE_ORDER: Reply = {
  status: 409,
  body: { code: 'CONFLICT', details: { order: 'STALE' } },
};
const DUPLICATE: Reply = {
  status: 409,
  body: { code: 'CONFLICT', details: { 'name.en': 'ALREADY_EXISTS' } },
};

/** Every write, so a test can assert what actually went over the wire. */
let sent: { method: string; url: string; body: string | null }[] = [];

function stubApi({ list, write }: { list: Reply; write?: Reply }) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      // Every screen with a dropdown reads the option lists, so every stub
      // has to answer for them - the labels come from there now.
      const options = optionsReply(String(url));

      if (options) {
        return Promise.resolve(options);
      }

      const method = init?.method ?? 'GET';

      if (method !== 'GET') {
        sent.push({
          method,
          url,
          body: typeof init?.body === 'string' ? init.body : null,
        });
      }

      const reply = method === 'GET' ? list : (write ?? created(TYPESCRIPT));

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

  return render(<TechnologiesPage />, { wrapper: Wrapper });
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function choose(field: string, option: string) {
  const trigger = screen.getByRole('combobox', { name: new RegExp(field) });

  // Opened from the keyboard rather than by pointer: Radix opens on both, and
  // this is the path a keyboard user takes anyway.
  fireEvent.keyDown(trigger, { key: 'Enter' });

  fireEvent.click(await screen.findByRole('option', { name: option }));
}

/** JSON.parse is `any`; every body is read through this one narrowing. */
function sentBody(index = 0): Record<string, unknown> {
  const write = sent[index];
  if (!write?.body) throw new Error(`no request was sent at ${index}`);

  return JSON.parse(write.body) as Record<string, unknown>;
}

beforeEach(() => {
  sent = [];
  stubApi({ list: listed([TYPESCRIPT, DOCKER]) });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the technologies page', () => {
  it('lists what the API returned, in the order it returned it', async () => {
    renderPage();

    await screen.findByText('TypeScript');

    const names = screen
      .getAllByRole('listitem')
      .map((item) => item.textContent);

    expect(names[0]).toContain('TypeScript');
    expect(names[1]).toContain('Docker');
  });

  it('shows the category as a translated label, never as the stored code', async () => {
    renderPage();

    await screen.findByText('TypeScript');

    expect(screen.getByText('Infrastructure')).toBeTruthy();
    expect(screen.getByText('60%')).toBeTruthy();
    expect(screen.queryByText(/infrastructure/)).toBeNull();
  });

  it('says so when the portfolio has none yet', async () => {
    stubApi({ list: listed([]) });
    renderPage();

    expect(await screen.findByText('No technologies yet')).toBeTruthy();
  });

  // The list is how the admin sees what exists; saving without it risks a
  // duplicate name, so no editor is offered over a failed read.
  it('reports a failed read instead of offering an editor', async () => {
    stubApi({ list: UNREADABLE });
    renderPage();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Add a technology' }),
    ).toBeNull();
  });
});

describe('reordering', () => {
  it('sends the whole new order, not the pair that moved', async () => {
    renderPage();
    await screen.findByText('TypeScript');

    fireEvent.click(screen.getByRole('button', { name: 'Move Docker up' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sent[0]?.method).toBe('PUT');
    expect(sent[0]?.url).toContain('/api/technologies/reorder');
    expect(sentBody()).toEqual({ ids: ['b2', 'a1'] });
  });

  it('shows the new order at once, before the server has answered', async () => {
    renderPage();
    await screen.findByText('TypeScript');

    fireEvent.click(screen.getByRole('button', { name: 'Move Docker up' }));

    const names = screen
      .getAllByRole('listitem')
      .map((item) => item.textContent);

    expect(names[0]).toContain('Docker');
  });

  // The ends have nowhere to go, and a disabled button says so clearly.
  it('cannot move the first row up or the last row down', async () => {
    renderPage();
    await screen.findByText('TypeScript');

    expect(
      screen.getByRole('button', { name: 'Move TypeScript up' }),
    ).toHaveProperty('disabled', true);
    expect(
      screen.getByRole('button', { name: 'Move Docker down' }),
    ).toHaveProperty('disabled', true);
  });

  /**
   * Dropping the pending order restores exactly what the server still has. The
   * list snapping back is correct: the order really did not change.
   */
  it('puts the list back and says so when the save is refused', async () => {
    stubApi({ list: listed([TYPESCRIPT, DOCKER]), write: STALE_ORDER });
    renderPage();
    await screen.findByText('TypeScript');

    fireEvent.click(screen.getByRole('button', { name: 'Move Docker up' }));

    await waitFor(() => expect(sent.length).toBe(1));

    await waitFor(() => {
      const names = screen
        .getAllByRole('listitem')
        .map((item) => item.textContent);

      expect(names[0]).toContain('TypeScript');
    });

    /**
     * This test used to assert the generic conflict message, and so pinned the
     * very imprecision it should have caught: the server said the ordering was
     * *stale*, and the screen said something conflicted with something that
     * already exists. `admin.reorder.stale` existed the whole time and was
     * rendered nowhere.
     */
    expect(
      screen.getByText(
        'The list changed somewhere else. Reload and try again.',
      ),
    ).toBeTruthy();
  });
});

describe('creating a technology', () => {
  async function openTheForm() {
    renderPage();
    await screen.findByText('TypeScript');
    fireEvent.click(screen.getByRole('button', { name: 'Add a technology' }));
    await screen.findByText('New technology');
  }

  it('sends what was typed, with the level as a number', async () => {
    await openTheForm();

    type(localizedLabel('Name'), 'Playwright');
    type('Level', '45');
    await choose('Category', 'Backend');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sent[0]?.method).toBe('POST');
    expect(sentBody()).toEqual({
      name: { en: 'Playwright' },
      category: 'backend',
      level: 45,
      order: 0,
    });
  });

  // The shared rules reject a numeric string on purpose, so the number input
  // has to convert before the schema ever sees it.
  it('never sends the level as a string', async () => {
    await openTheForm();

    type(localizedLabel('Name'), 'Playwright');
    type('Level', '45');
    await choose('Category', 'Backend');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(typeof sentBody().level).toBe('number');
  });

  /**
   * `order` has no input - there is no reorder UI yet - so a code naming it
   * would otherwise be set on a field that renders nothing while also
   * suppressing the banner, leaving the admin with no message at all.
   */
  it('falls back to a banner when the error names nothing on screen', async () => {
    stubApi({ list: listed([TYPESCRIPT, DOCKER]), write: UNRENDERABLE });
    await openTheForm();

    type(localizedLabel('Name'), 'Playwright');
    type('Level', '45');
    await choose('Category', 'Backend');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // By its text, not by role: FieldError carries role="alert" too, so a
    // role query would pass whether the banner appeared or not.
    expect(
      await screen.findByText(
        'Please check the highlighted fields and try again.',
      ),
    ).toBeTruthy();
  });

  it('falls back to a banner when the error names the field but not a locale', async () => {
    stubApi({ list: listed([TYPESCRIPT, DOCKER]), write: BAD_LOCALE_KEY });
    await openTheForm();

    type(localizedLabel('Name'), 'Playwright');
    type('Level', '45');
    await choose('Category', 'Backend');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // By its text, not by role: FieldError carries role="alert" too.
    expect(
      await screen.findByText(
        'Please check the highlighted fields and try again.',
      ),
    ).toBeTruthy();
  });

  it('refuses an empty form and sends nothing', async () => {
    await openTheForm();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findAllByText('This field is required.');
    expect(sent).toEqual([]);
  });

  // An untouched category must read as "you did not choose", like every other
  // empty field, rather than as "that is not a category".
  it('reports an unchosen category as required', async () => {
    await openTheForm();

    type(localizedLabel('Name'), 'Playwright');
    type('Level', '45');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const required = screen.getAllByText('This field is required.');
      expect(required.length).toBeGreaterThan(0);
    });
    expect(sent).toEqual([]);
  });

  // Nothing "went wrong": the name is taken, and the message belongs on the
  // field it is about rather than in a generic banner.
  it('puts a duplicate name on the name field and keeps the form open', async () => {
    stubApi({ list: listed([TYPESCRIPT, DOCKER]), write: DUPLICATE });
    await openTheForm();

    type(localizedLabel('Name'), 'TypeScript');
    type('Level', '45');
    await choose('Category', 'Backend');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(await screen.findByText('That name is already taken.')).toBeTruthy();
    // The field says what to fix, so the banner would only repeat it.
    expect(
      screen.queryByText('That conflicts with something that already exists.'),
    ).toBeNull();
    expect(
      screen.queryByText('Something went wrong. Please try again.'),
    ).toBeNull();
    expect(screen.queryByText('New technology')).toBeTruthy();
  });
});

describe('editing a technology', () => {
  it('loads it into the form and replaces it by id', async () => {
    renderPage();
    await screen.findByText('Docker');

    await openRowMenu('Actions for Docker');
    await chooseMenuItem('Edit');
    await screen.findByText('Edit Docker');

    expect(
      screen.getByLabelText<HTMLInputElement>(localizedLabel('Name')).value,
    ).toBe('Docker');
    expect(screen.getByLabelText<HTMLInputElement>('Level').value).toBe('60');

    type('Level', '75');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sent[0]?.method).toBe('PUT');
    expect(sent[0]?.url).toContain('/api/technologies/b2');
    expect(sentBody().level).toBe(75);
  });

  it('keeps a locale the form never rendered an input for', async () => {
    const translated = {
      ...DOCKER,
      name: { en: 'Docker', de: 'Hafenarbeiter' },
    };
    stubApi({ list: listed([translated]) });
    renderPage();

    await screen.findByText('Docker');
    await openRowMenu('Actions for Docker');
    await chooseMenuItem('Edit');
    await screen.findByText('Edit Docker');

    type(localizedLabel('Name'), 'Docker Engine');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(sent.length).toBe(1));

    // PUT replaces the document, so a translation written through the API
    // would be deleted by an ordinary save.
    expect(sentBody().name).toEqual({
      de: 'Hafenarbeiter',
      en: 'Docker Engine',
    });
  });

  it('closes the editor without sending anything on cancel', async () => {
    renderPage();
    await screen.findByText('TypeScript');

    await openRowMenu('Actions for TypeScript');
    await chooseMenuItem('Edit');
    await screen.findByText('Edit TypeScript');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await screen.findByRole('button', { name: 'Add a technology' });
    expect(sent).toEqual([]);
  });
});

describe('deleting a technology', () => {
  const IN_USE: Reply = {
    status: 409,
    body: { code: 'CONFLICT', details: { technology: 'IN_USE', projects: 2 } },
  };

  /**
   * "That conflicts with something that already exists" is true but useless.
   * The API says how many projects use it, so the admin learns where to go.
   */
  it('says how many projects still use a row it refuses to delete', async () => {
    stubApi({ list: listed([TYPESCRIPT, DOCKER]), write: IN_USE });
    renderPage();
    await screen.findByText('TypeScript');

    await deleteRow('Actions for TypeScript');

    expect(
      await screen.findByText(
        '2 projects still use this. Unlink it there first.',
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText('That conflicts with something that already exists.'),
    ).toBeNull();
  });

  // Deleting is not undoable and sits one entry away from Edit, so it asks -
  // in a real dialog, which unlike `window.confirm` is translated, styled and
  // present in the accessibility tree of the page it interrupts.
  it('asks first, and does nothing when the admin declines', async () => {
    renderPage();
    await screen.findByText('TypeScript');

    await openRowMenu('Actions for TypeScript');
    await chooseMenuItem('Delete');

    expect(await screen.findByRole('alertdialog')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(sent).toEqual([]);
  });

  it('deletes by id once the admin confirms', async () => {
    renderPage();
    await screen.findByText('TypeScript');

    await deleteRow('Actions for TypeScript');

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sent[0]?.method).toBe('DELETE');
    expect(sent[0]?.url).toContain('/api/technologies/a1');
  });
});
