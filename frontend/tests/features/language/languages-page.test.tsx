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
import LanguagesPage from '../../../src/app/[locale]/admin/(protected)/languages/page';
import { optionsReply } from '../../support/options';
import { chooseMenuItem, deleteRow, openRowMenu } from '../../support/menus';
import { ToastViewport } from '../../../src/components/ui/toast';

const messages = { ...admin, ...site, ...validation, ...responses };

const ARABIC = {
  id: 'l1',
  code: 'ar',
  level: 'native',
  order: 0,
  updatedAt: '2026-09-05T10:00:00.000Z',
};

const FRENCH = {
  id: 'l2',
  code: 'fr',
  level: 'c1',
  order: 1,
  updatedAt: '2026-09-05T10:00:00.000Z',
};

type Reply = { status: number; body: unknown };

const listed = (rows: unknown[]): Reply => ({
  status: 200,
  body: { code: 'SUCCESS', details: { languages: rows } },
});
const saved: Reply = {
  status: 200,
  body: { code: 'SUCCESS', details: { language: FRENCH } },
};
const DUPLICATE: Reply = {
  status: 409,
  body: { code: 'CONFLICT', details: { code: 'ALREADY_EXISTS' } },
};

/** Every write, so a test can assert what actually went over the wire. */
let sent: { method: string; url: string; body: string | null }[] = [];

function stubApi({ list = listed([ARABIC, FRENCH]), write = saved } = {}) {
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

      const reply = method === 'GET' ? list : write;

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

  return render(<LanguagesPage />, { wrapper: Wrapper });
}

/**
 * Opens a select and picks an option.
 *
 * The listbox is awaited once and the option read from it in a single pass:
 * `findByRole('option', …)` recomputes the accessible name of every option on
 * every poll, and the language picker has fifty-three of them - enough to push
 * a test past the default timeout under load.
 */
async function choose(field: string, option: string) {
  const trigger = screen.getByRole('combobox', { name: new RegExp(field) });

  fireEvent.keyDown(trigger, { key: 'Enter' });
  await screen.findByRole('listbox');
  fireEvent.click(screen.getByRole('option', { name: option }));
}

function sentBody(index = 0): Record<string, unknown> {
  const write = sent[index];
  if (!write?.body) throw new Error(`no request was sent at ${index}`);

  return JSON.parse(write.body) as Record<string, unknown>;
}

beforeEach(() => {
  sent = [];
  stubApi();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the languages page', () => {
  /** The name is rendered from the subtag, in the reader's own locale. */
  it('names each language rather than showing its code alone', async () => {
    renderPage();

    expect(await screen.findByText('Arabic')).toBeTruthy();
    expect(screen.getByText('French')).toBeTruthy();
  });

  /**
   * The name is not in the response at all, so it can only have been rendered.
   * That it changes with the reader's locale is pinned in
   * `language-name.test.ts`: the provider here is typed to the one locale the
   * app configures, and lying to it would prove nothing about either.
   */
  it('shows no stored code where a name belongs', async () => {
    renderPage();

    await screen.findByText('Arabic');

    const row = screen.getByText('Arabic').closest('li');

    // The subtag is shown too, deliberately - beside the name, not instead.
    expect(row?.textContent).toContain('Arabic');
    expect(row?.textContent).toContain('ar');
  });

  it('shows the level as a translated label, never as the stored code', async () => {
    renderPage();
    await screen.findByText('Arabic');

    expect(screen.getByText('Native')).toBeTruthy();
    expect(screen.getByText('C1 — Advanced')).toBeTruthy();
  });

  it('lists them in the order the API returned', async () => {
    renderPage();
    await screen.findByText('Arabic');

    const rows = screen.getAllByRole('listitem').map((row) => row.textContent);

    expect(rows[0]).toContain('Arabic');
    expect(rows[1]).toContain('French');
  });

  it('says so when there are none yet', async () => {
    stubApi({ list: listed([]) });
    renderPage();

    expect(await screen.findByText('No languages yet')).toBeTruthy();
  });
});

/**
 * A language list has no date to sort by, so unlike the three sections before
 * it this one reorders - through the shared machinery the expertise and
 * social-link lists use.
 */
describe('reordering', () => {
  it('offers the controls the date-ordered lists do not', async () => {
    renderPage();
    await screen.findByText('Arabic');

    expect(screen.getByRole('button', { name: 'Move French up' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Move Arabic down' }),
    ).toBeTruthy();
  });

  /** The buttons name their row, in the reader's locale, like everything else. */
  it('cannot move the first row up or the last down', async () => {
    renderPage();
    await screen.findByText('Arabic');

    expect(
      screen.getByRole('button', { name: 'Move Arabic up' }),
    ).toHaveProperty('disabled', true);
    expect(
      screen.getByRole('button', { name: 'Move French down' }),
    ).toHaveProperty('disabled', true);
  });

  it('sends the whole ordering, not the pair that moved', async () => {
    renderPage();
    await screen.findByText('Arabic');

    fireEvent.click(screen.getByRole('button', { name: 'Move French up' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sent[0]?.method).toBe('PUT');
    expect(sent[0]?.url).toContain('/api/languages/reorder');
    expect(sentBody().ids).toEqual(['l2', 'l1']);
  });

  /**
   * The server refuses an ordering whose ids no longer match what it holds -
   * two tabs, or a row added or deleted elsewhere and then a move. Wired
   * through the page rather than only unit-tested, because the failure this
   * replaces was not the message being wrong but the message never being
   * reached: every list rendered the generic conflict text instead.
   */
  it('says the list changed, when the server refuses the order as stale', async () => {
    stubApi({
      write: {
        status: 409,
        body: { code: 'CONFLICT', details: { order: 'STALE' } },
      },
    });
    renderPage();
    await screen.findByText('Arabic');

    fireEvent.click(screen.getByRole('button', { name: 'Move French up' }));

    expect(
      await screen.findByText(
        'The list changed somewhere else. Reload and try again.',
      ),
    ).toBeTruthy();
  });
});

describe('creating a language', () => {
  async function openTheForm() {
    renderPage();
    const [add] = await screen.findAllByRole('button', {
      name: 'Add a language',
    });
    fireEvent.click(add!);
    await screen.findByText('New language');
  }

  it('sends the subtag and the level, and nothing else', async () => {
    await openTheForm();

    await choose('Language', 'German');
    await choose('Level', 'B2 — Upper intermediate');
    fireEvent.click(screen.getByRole('button', { name: 'Save language' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sent[0]?.method).toBe('POST');
    // A subtag, never a name: the name is the reader's to render.
    expect(sentBody()).toEqual({ code: 'de', level: 'b2' });
  });

  /** The picker is sorted by the name shown, not by the subtag behind it. */
  it('offers the languages in the order their names read', async () => {
    await openTheForm();

    const trigger = screen.getByRole('combobox', { name: /Language/ });
    fireEvent.keyDown(trigger, { key: 'Enter' });

    const options = (await screen.findAllByRole('option')).map(
      (option) => option.textContent ?? '',
    );

    // Pairs where the two orders disagree, which is the only kind that proves
    // anything: the contract lists the subtags alphabetically, so `ar`/`de`/`es`
    // would come out right whether or not anything sorted them.
    expect(options.indexOf('Chinese')).toBeLessThan(options.indexOf('German'));
    expect(options.indexOf('Dutch')).toBeLessThan(options.indexOf('English'));
  });

  it('refuses an empty form and sends nothing', async () => {
    await openTheForm();

    fireEvent.click(screen.getByRole('button', { name: 'Save language' }));

    await screen.findAllByText('This field is required.');
    expect(sent).toEqual([]);
  });

  // Nothing "went wrong": that language is already listed, and the message
  // belongs on the field it is about rather than in a banner.
  it('puts a duplicate on the language and keeps the form open', async () => {
    stubApi({ write: DUPLICATE });
    await openTheForm();

    await choose('Language', 'French');
    await choose('Level', 'C1 — Advanced');
    fireEvent.click(screen.getByRole('button', { name: 'Save language' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(await screen.findByText('That name is already taken.')).toBeTruthy();
    expect(screen.queryByText('New language')).toBeTruthy();
  });
});

describe('editing and deleting', () => {
  it('loads the language into the form and replaces it by id', async () => {
    renderPage();
    await screen.findByText('French');

    await openRowMenu('Actions for French');
    await chooseMenuItem('Edit');
    await screen.findByText('Edit French');

    await choose('Level', 'C2 — Proficient');
    fireEvent.click(screen.getByRole('button', { name: 'Save language' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sent[0]?.method).toBe('PUT');
    expect(sent[0]?.url).toContain('/api/languages/l2');
    expect(sentBody()).toEqual({ code: 'fr', level: 'c2' });
  });

  it('deletes by id once the admin confirms', async () => {
    renderPage();
    await screen.findByText('French');

    await deleteRow('Actions for French');

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sent[0]?.method).toBe('DELETE');
    expect(sent[0]?.url).toContain('/api/languages/l2');
  });
});
