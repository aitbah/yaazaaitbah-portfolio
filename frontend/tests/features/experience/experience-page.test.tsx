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
import ExperiencePage from '../../../src/app/[locale]/admin/(protected)/experience/page';
import { optionsReply } from '../../support/options';
import { chooseMenuItem, deleteRow, openRowMenu } from '../../support/menus';
import { localizedLabel } from '../../support/localized-label';
import { ToastViewport } from '../../../src/components/ui/toast';

const messages = { ...admin, ...site, ...validation, ...responses };

const PAST = {
  id: 'p1',
  role: { en: 'Backend Engineer' },
  organisation: { en: 'Acme' },
  location: { en: 'Casablanca' },
  employmentType: 'full-time',
  startDate: '2021-03',
  endDate: '2023-06',
  current: false,
  description: { en: 'Order and inventory services.' },
  updatedAt: '2026-09-04T10:00:00.000Z',
};

const CURRENT = {
  id: 'p2',
  role: { en: 'Lead Engineer' },
  organisation: { en: 'Globex' },
  employmentType: 'freelance',
  startDate: '2023-07',
  current: true,
  updatedAt: '2026-09-04T10:00:00.000Z',
};

type Reply = { status: number; body: unknown };

const listed = (rows: unknown[]): Reply => ({
  status: 200,
  body: { code: 'SUCCESS', details: { experience: rows } },
});
const saved: Reply = {
  status: 200,
  body: { code: 'SUCCESS', details: { position: PAST } },
};
const UNREADABLE: Reply = {
  status: 500,
  body: { code: 'SERVER_ERROR', details: {} },
};
const DUPLICATE: Reply = {
  status: 409,
  body: { code: 'CONFLICT', details: { 'role.en': 'ALREADY_EXISTS' } },
};

/** Every write, so a test can assert what actually went over the wire. */
let sent: { method: string; url: string; body: string | null }[] = [];

function stubApi({ list = listed([CURRENT, PAST]), write = saved } = {}) {
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
      // A fixed zone, so the month formatting below is asserting the component
      // rather than the machine the tests happen to run on.
      <NextIntlClientProvider
        locale="en"
        messages={messages}
        timeZone="America/Los_Angeles"
      >
        <ToastViewport>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </ToastViewport>
      </NextIntlClientProvider>
    );
  }

  return render(<ExperiencePage />, { wrapper: Wrapper });
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function choose(field: string, option: string) {
  const trigger = screen.getByRole('combobox', { name: new RegExp(field) });

  fireEvent.keyDown(trigger, { key: 'Enter' });
  fireEvent.click(await screen.findByRole('option', { name: option }));
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

describe('the experience page', () => {
  it('lists what the API returned, in the order it returned it', async () => {
    renderPage();
    await screen.findByText('Lead Engineer');

    const roles = screen
      .getAllByRole('listitem')
      .map((item) => item.textContent);

    expect(roles[0]).toContain('Lead Engineer');
    expect(roles[1]).toContain('Backend Engineer');
  });

  /**
   * The months are stored as `YYYY-MM` and formatted in UTC. Rendered in the
   * viewer's zone instead, a negative offset turns midnight on the first into
   * the previous month - "Mar 2021" would read as "Feb 2021" for every reader
   * west of Greenwich, and never for whoever wrote the code.
   */
  it('formats a month in UTC, whatever zone the reader is in', async () => {
    renderPage();
    await screen.findByText('Backend Engineer');

    expect(screen.getByText(/Mar 2021/)).toBeTruthy();
    expect(screen.queryByText(/Feb 2021/)).toBeNull();
  });

  it('marks a current position rather than inventing an end date', async () => {
    renderPage();

    const row = (await screen.findByText('Lead Engineer')).closest('li');

    expect(row?.textContent).toContain('Present');
    expect(row?.textContent).toContain('Current');
  });

  it('shows the type as a translated label, never as the stored code', async () => {
    renderPage();
    await screen.findByText('Backend Engineer');

    expect(screen.getByText('Full-time')).toBeTruthy();
    expect(screen.queryByText('full-time')).toBeNull();
  });

  it('says so when there is no experience yet', async () => {
    stubApi({ list: listed([]) });
    renderPage();

    expect(await screen.findByText('No experience yet')).toBeTruthy();
  });

  it('reports a failed read instead of offering an editor', async () => {
    stubApi({ list: UNREADABLE });
    renderPage();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add a position' })).toBeNull();
  });

  /**
   * A career is ordered by date, so there is nothing to drag. Every other admin
   * list has arrows; this one must not, because a stored position could then
   * disagree with the dates without the admin seeing it.
   */
  it('offers no reorder controls', async () => {
    renderPage();
    await screen.findByText('Backend Engineer');

    expect(screen.queryByRole('button', { name: /Move .* up/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Move .* down/ })).toBeNull();
  });
});

describe('creating a position', () => {
  async function openTheForm() {
    renderPage();
    const [add] = await screen.findAllByRole('button', {
      name: 'Add a position',
    });
    fireEvent.click(add!);
    await screen.findByText('New position');
  }

  it('sends what was filled in', async () => {
    await openTheForm();

    type(localizedLabel('Role'), 'Backend Engineer');
    type(localizedLabel('Organisation'), 'Acme');
    await choose('Type', 'Full-time');
    type('Started', '2021-03');
    type('Ended', '2023-06');
    fireEvent.click(screen.getByRole('button', { name: 'Save position' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sent[0]?.method).toBe('POST');
    expect(sentBody()).toEqual({
      role: { en: 'Backend Engineer' },
      organisation: { en: 'Acme' },
      employmentType: 'full-time',
      startDate: '2021-03',
      endDate: '2023-06',
      current: false,
    });
  });

  // An untouched optional localized field must be absent, not an empty object.
  it('omits the optional fields left blank', async () => {
    await openTheForm();

    type(localizedLabel('Role'), 'Backend Engineer');
    type(localizedLabel('Organisation'), 'Acme');
    await choose('Type', 'Full-time');
    type('Started', '2021-03');
    type('Ended', '2023-06');
    fireEvent.click(screen.getByRole('button', { name: 'Save position' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sentBody()).not.toHaveProperty('location');
    expect(sentBody()).not.toHaveProperty('description');
  });

  it('refuses an empty form and sends nothing', async () => {
    await openTheForm();

    fireEvent.click(screen.getByRole('button', { name: 'Save position' }));

    await screen.findAllByText('This field is required.');
    expect(sent).toEqual([]);
  });

  /**
   * The rule that relates the three date fields is shared with the backend, so
   * the admin is told before a request is made - and by the same rule the
   * server would have used.
   */
  it('refuses an end before the start, without asking the server', async () => {
    await openTheForm();

    type(localizedLabel('Role'), 'Backend Engineer');
    type(localizedLabel('Organisation'), 'Acme');
    await choose('Type', 'Full-time');
    type('Started', '2023-06');
    type('Ended', '2021-03');
    fireEvent.click(screen.getByRole('button', { name: 'Save position' }));

    expect(
      await screen.findByText('The end cannot be before the start.'),
    ).toBeTruthy();
    expect(sent).toEqual([]);
  });

  it('requires an end date on a position that is not current', async () => {
    await openTheForm();

    type(localizedLabel('Role'), 'Backend Engineer');
    type(localizedLabel('Organisation'), 'Acme');
    await choose('Type', 'Full-time');
    type('Started', '2021-03');
    fireEvent.click(screen.getByRole('button', { name: 'Save position' }));

    await waitFor(() => {
      const required = screen.getAllByText('This field is required.');
      expect(required.length).toBeGreaterThan(0);
    });
    expect(sent).toEqual([]);
  });

  /**
   * Ticking "I still hold this position" clears the end date and disables it,
   * so the form cannot show a contradiction it is about to reject.
   */
  it('clears and disables the end date when the position is current', async () => {
    await openTheForm();

    type('Ended', '2023-06');
    fireEvent.click(
      screen.getByRole('checkbox', { name: /I still hold this position/ }),
    );

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>('Ended').value).toBe('');
    });
    expect(screen.getByLabelText('Ended')).toHaveProperty('disabled', true);
  });

  it('sends a current position with no end date at all', async () => {
    await openTheForm();

    type(localizedLabel('Role'), 'Lead Engineer');
    type(localizedLabel('Organisation'), 'Globex');
    await choose('Type', 'Freelance');
    type('Started', '2023-07');
    fireEvent.click(
      screen.getByRole('checkbox', { name: /I still hold this position/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save position' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sentBody().current).toBe(true);
    expect(sentBody()).not.toHaveProperty('endDate');
  });

  // Nothing "went wrong": the same position exists, and the message belongs on
  // the field it is about rather than in a banner.
  it('puts a duplicate on the role and keeps the form open', async () => {
    stubApi({ write: DUPLICATE });
    await openTheForm();

    type(localizedLabel('Role'), 'Backend Engineer');
    type(localizedLabel('Organisation'), 'Acme');
    await choose('Type', 'Full-time');
    type('Started', '2021-03');
    type('Ended', '2023-06');
    fireEvent.click(screen.getByRole('button', { name: 'Save position' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(await screen.findByText('That name is already taken.')).toBeTruthy();
    expect(screen.queryByText('New position')).toBeTruthy();
  });
});

describe('editing and deleting', () => {
  it('loads the position into the form and replaces it by id', async () => {
    renderPage();
    await screen.findByText('Backend Engineer');

    await openRowMenu('Actions for Backend Engineer');
    await chooseMenuItem('Edit');
    await screen.findByText('Edit Backend Engineer');

    expect(
      screen.getByLabelText<HTMLInputElement>(localizedLabel('Role')).value,
    ).toBe('Backend Engineer');
    expect(screen.getByLabelText<HTMLInputElement>('Started').value).toBe(
      '2021-03',
    );

    type(localizedLabel('Role'), 'Senior Backend Engineer');
    fireEvent.click(screen.getByRole('button', { name: 'Save position' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sent[0]?.method).toBe('PUT');
    expect(sent[0]?.url).toContain('/api/experience/p1');
    expect(sentBody().role).toEqual({ en: 'Senior Backend Engineer' });
  });

  it('closes the editor without sending anything on cancel', async () => {
    renderPage();
    await screen.findByText('Backend Engineer');

    await openRowMenu('Actions for Backend Engineer');
    await chooseMenuItem('Edit');
    await screen.findByText('Edit Backend Engineer');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await screen.findByRole('button', { name: 'Add a position' });
    expect(sent).toEqual([]);
  });

  it('asks first, and does nothing when the admin declines', async () => {
    renderPage();
    await screen.findByText('Backend Engineer');

    await openRowMenu('Actions for Backend Engineer');
    await chooseMenuItem('Delete');

    expect(await screen.findByRole('alertdialog')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(sent).toEqual([]);
  });

  it('deletes by id once the admin confirms', async () => {
    renderPage();
    await screen.findByText('Backend Engineer');

    await deleteRow('Actions for Backend Engineer');

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sent[0]?.method).toBe('DELETE');
    expect(sent[0]?.url).toContain('/api/experience/p1');
  });
});
