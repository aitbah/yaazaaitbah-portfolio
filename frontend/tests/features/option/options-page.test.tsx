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
import OptionsPage from '../../../src/app/[locale]/admin/(protected)/options/page';
import { localizedLabel } from '../../support/localized-label';
import { chooseMenuItem, deleteRow, openRowMenu } from '../../support/menus';
import { OPTION_ROWS } from '../../support/options';
import { ToastViewport } from '../../../src/components/ui/toast';

const messages = { ...admin, ...site, ...validation, ...responses };

type Reply = { status: number; body: unknown };

const listed = (rows: unknown[]): Reply => ({
  status: 200,
  body: { code: 'SUCCESS', details: { options: rows } },
});
const saved: Reply = {
  status: 200,
  body: {
    code: 'SUCCESS',
    details: { option: { ...OPTION_ROWS[0], id: 'new' } },
  },
};
const IN_USE: Reply = {
  status: 409,
  body: { code: 'CONFLICT', details: { option: 'IN_USE', rows: 3 } },
};
const DUPLICATE: Reply = {
  status: 409,
  body: { code: 'CONFLICT', details: { code: 'CODE_TAKEN' } },
};

/** Every write, so a test can assert what actually went over the wire. */
let sent: { method: string; url: string; body: string | null }[] = [];

function stubApi({ list = listed(OPTION_ROWS), write = saved } = {}) {
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

  return render(<OptionsPage />, { wrapper: Wrapper });
}

async function choose(field: string, option: string) {
  const trigger = screen.getByRole('combobox', { name: new RegExp(field) });

  fireEvent.keyDown(trigger, { key: 'Enter' });
  await screen.findByRole('listbox');
  fireEvent.click(screen.getByRole('option', { name: option }));
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
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

describe('the options page', () => {
  it('opens on the first list and shows its options', async () => {
    renderPage();

    expect(await screen.findByText('Open to work')).toBeTruthy();
    // A different list's option, which must not be on screen at the same time.
    expect(screen.queryByText('Full-time')).toBeNull();
  });

  /** The list a row belongs to is what decides whether it is even rendered. */
  it('shows another list when one is chosen', async () => {
    renderPage();
    await screen.findByText('Open to work');

    await choose('List', 'Employment types');

    expect(await screen.findByText('Full-time')).toBeTruthy();
    expect(screen.queryByText('Open to work')).toBeNull();
  });

  /**
   * The code is what every stored row actually holds, so it is shown beside the
   * label rather than hidden behind it.
   */
  it('shows the stored code beside the label', async () => {
    renderPage();

    expect(await screen.findByText('open-to-work')).toBeTruthy();
  });

  it('sends the list with a new option', async () => {
    renderPage();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Add an option' }),
    );

    type('Code', 'open-to-mentoring');
    type(localizedLabel('Label'), 'Open to mentoring');
    fireEvent.click(screen.getByRole('button', { name: 'Save option' }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sentBody()).toMatchObject({
      list: 'availability-status',
      code: 'open-to-mentoring',
      name: { en: 'Open to mentoring' },
    });
  });

  /**
   * Rows point at the code, so an edit must not carry one - the API answers
   * `NOT_ALLOWED` for a code in an edit, deliberately.
   */
  it('never sends a code when editing', async () => {
    renderPage();
    await screen.findByText('Open to work');
    await openRowMenu('Actions for Open to work');
    await chooseMenuItem('Edit');

    type(localizedLabel('Label'), 'Looking for work');
    fireEvent.click(screen.getByRole('button', { name: 'Save option' }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sentBody()).not.toHaveProperty('code');
    expect(sentBody()).toMatchObject({ name: { en: 'Looking for work' } });
  });

  it('shows the code while editing but does not let it be changed', async () => {
    renderPage();
    await screen.findByText('Open to work');
    await openRowMenu('Actions for Open to work');
    await chooseMenuItem('Edit');

    const code = screen.getByLabelText<HTMLInputElement>('Code');

    expect(code.value).toBe('open-to-work');
    expect(code.disabled).toBe(true);
  });

  it('reports a code the list already has, on the code', async () => {
    stubApi({ write: DUPLICATE });
    renderPage();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Add an option' }),
    );

    type('Code', 'open-to-work');
    type(localizedLabel('Label'), 'Open to work again');
    fireEvent.click(screen.getByRole('button', { name: 'Save option' }));

    // The code, not the name: the field directly above this message is
    // labelled "Code", and "that name is already taken" contradicted it.
    expect(
      await screen.findByText('That code is already in use.'),
    ).toBeTruthy();
  });

  it('refuses a code that is not lowercase and dashes', async () => {
    renderPage();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Add an option' }),
    );

    type('Code', 'Open To Work');
    type(localizedLabel('Label'), 'Open to work');
    fireEvent.click(screen.getByRole('button', { name: 'Save option' }));

    expect(
      await screen.findByText(
        'A code may hold only lowercase letters, digits and dashes.',
      ),
    ).toBeTruthy();
    expect(sent).toHaveLength(0);
  });

  /**
   * The commonest answer this screen gives: an option in use cannot go. It is
   * reported where the admin is looking rather than as a silent no-op.
   */
  it('says so when an option in use refuses to be deleted', async () => {
    stubApi({ write: IN_USE });
    renderPage();
    await screen.findByText('Open to work');

    await deleteRow('Actions for Open to work');

    // The count, not a generic conflict: "that conflicts with something that
    // already exists" is true of a duplicate name and no help about this.
    expect(
      await screen.findByText(/3 entries still use this option/),
    ).toBeTruthy();
  });
});

describe('a list with headings and marks', () => {
  it('offers a heading only on the list that has one', async () => {
    renderPage();
    await screen.findByText('Open to work');

    fireEvent.click(screen.getByRole('button', { name: 'Add an option' }));
    expect(screen.queryByLabelText('Heading')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await choose('List', 'Social platforms');
    fireEvent.click(screen.getByRole('button', { name: 'Add an option' }));

    expect(screen.getByRole('combobox', { name: /Heading/ })).toBeTruthy();
  });

  it('sends the heading and the mark that were chosen', async () => {
    renderPage();
    await screen.findByText('Open to work');
    await choose('List', 'Social platforms');

    fireEvent.click(screen.getByRole('button', { name: 'Add an option' }));
    type('Code', 'peertube');
    type(localizedLabel('Label'), 'PeerTube');
    await choose('Heading', 'Video & streaming');
    // The grid shows a first page until the search narrows it, and GitHub is
    // not in the first sixty of two hundred and thirty-six.
    fireEvent.change(screen.getByLabelText('Search logos'), {
      target: { value: 'github' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'GitHub' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save option' }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sentBody()).toMatchObject({
      list: 'social-platform',
      code: 'peertube',
      group: 'video',
      icon: 'github',
    });
  });

  it('shows the heading a platform sits under', async () => {
    renderPage();
    await screen.findByText('Open to work');
    await choose('List', 'Social platforms');

    expect(await screen.findByText('GitHub')).toBeTruthy();
    expect(screen.getAllByText('Code hosting').length).toBeGreaterThan(0);
  });
});
