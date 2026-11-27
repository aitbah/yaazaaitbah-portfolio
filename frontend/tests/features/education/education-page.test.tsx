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
import EducationPage from '../../../src/app/[locale]/admin/(protected)/education/page';
import { optionsReply } from '../../support/options';
import { chooseMenuItem, deleteRow, openRowMenu } from '../../support/menus';
import { localizedLabel } from '../../support/localized-label';
import { ToastViewport } from '../../../src/components/ui/toast';

const messages = { ...admin, ...site, ...validation, ...responses };

const DEGREE = {
  id: 'e1',
  institution: { en: 'University of Casablanca' },
  qualification: { en: 'BSc Computer Science' },
  fieldOfStudy: { en: 'Computer Science' },
  level: 'bachelor',
  location: { en: 'Casablanca' },
  startDate: '2015-09',
  endDate: '2018-06',
  current: false,
  description: { en: 'Systems and databases.' },
  updatedAt: '2026-09-05T10:00:00.000Z',
};

const IN_PROGRESS = {
  id: 'e2',
  institution: { en: 'Open University' },
  qualification: { en: 'MSc Distributed Systems' },
  level: 'master',
  startDate: '2024-09',
  current: true,
  updatedAt: '2026-09-05T10:00:00.000Z',
};

type Reply = { status: number; body: unknown };

const listed = (rows: unknown[]): Reply => ({
  status: 200,
  body: { code: 'SUCCESS', details: { education: rows } },
});
const saved: Reply = {
  status: 200,
  body: { code: 'SUCCESS', details: { entry: DEGREE } },
};
const UNREADABLE: Reply = {
  status: 500,
  body: { code: 'SERVER_ERROR', details: {} },
};
const DUPLICATE: Reply = {
  status: 409,
  body: { code: 'CONFLICT', details: { 'institution.en': 'ALREADY_EXISTS' } },
};

/** Every write, so a test can assert what actually went over the wire. */
let sent: { method: string; url: string; body: string | null }[] = [];

function stubApi({ list = listed([IN_PROGRESS, DEGREE]), write = saved } = {}) {
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

  return render(<EducationPage />, { wrapper: Wrapper });
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

describe('the education page', () => {
  it('lists what the API returned, in the order it returned it', async () => {
    renderPage();
    await screen.findByText('MSc Distributed Systems');

    const rows = screen
      .getAllByRole('listitem')
      .map((item) => item.textContent);

    expect(rows[0]).toContain('MSc Distributed Systems');
    expect(rows[1]).toContain('BSc Computer Science');
  });

  /**
   * The months are stored as `YYYY-MM` and formatted in UTC, by the very same
   * helper a career uses. Rendered in the viewer's zone instead, a negative
   * offset turns midnight on the first into the previous month.
   */
  it('formats a month in UTC, whatever zone the reader is in', async () => {
    renderPage();
    await screen.findByText('BSc Computer Science');

    expect(screen.getByText(/Sep 2015/)).toBeTruthy();
    expect(screen.queryByText(/Aug 2015/)).toBeNull();
  });

  it('marks a course in progress rather than inventing an end date', async () => {
    renderPage();

    const row = (await screen.findByText('MSc Distributed Systems')).closest(
      'li',
    );

    expect(row?.textContent).toContain('Present');
    expect(row?.textContent).toContain('In progress');
  });

  it('shows the level as a translated label, never as the stored code', async () => {
    renderPage();
    await screen.findByText('BSc Computer Science');

    expect(screen.getByText("Bachelor's degree")).toBeTruthy();
    expect(screen.queryByText('bachelor')).toBeNull();
  });

  it('says so when nothing has been studied yet', async () => {
    stubApi({ list: listed([]) });
    renderPage();

    expect(await screen.findByText('No education yet')).toBeTruthy();
  });

  it('reports a failed read instead of offering an editor', async () => {
    stubApi({ list: UNREADABLE });
    renderPage();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add an entry' })).toBeNull();
  });

  /**
   * The dates are the order, so there is nothing to drag - the same rule a
   * career follows, and for the same reason.
   */
  it('offers no reorder controls', async () => {
    renderPage();
    await screen.findByText('BSc Computer Science');

    expect(screen.queryByRole('button', { name: /Move .* up/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Move .* down/ })).toBeNull();
  });
});

describe('creating an entry', () => {
  async function openTheForm() {
    renderPage();
    const [add] = await screen.findAllByRole('button', {
      name: 'Add an entry',
    });
    fireEvent.click(add!);
    await screen.findByText('New entry');
  }

  function fillRequired() {
    type(localizedLabel('Qualification'), 'BSc Computer Science');
    type(localizedLabel('Institution'), 'University of Casablanca');
    type('Started', '2015-09');
    type('Ended', '2018-06');
  }

  it('sends what was filled in', async () => {
    await openTheForm();

    fillRequired();
    await choose('Level', "Bachelor's degree");
    fireEvent.click(screen.getByRole('button', { name: 'Save entry' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sent[0]?.method).toBe('POST');
    expect(sentBody()).toEqual({
      institution: { en: 'University of Casablanca' },
      qualification: { en: 'BSc Computer Science' },
      level: 'bachelor',
      startDate: '2015-09',
      endDate: '2018-06',
      current: false,
    });
  });

  // An untouched optional localized field must be absent, not an empty object.
  it('omits the optional fields left blank', async () => {
    await openTheForm();

    fillRequired();
    await choose('Level', "Bachelor's degree");
    fireEvent.click(screen.getByRole('button', { name: 'Save entry' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sentBody()).not.toHaveProperty('fieldOfStudy');
    expect(sentBody()).not.toHaveProperty('location');
    expect(sentBody()).not.toHaveProperty('description');
  });

  it('refuses an empty form and sends nothing', async () => {
    await openTheForm();

    fireEvent.click(screen.getByRole('button', { name: 'Save entry' }));

    await screen.findAllByText('This field is required.');
    expect(sent).toEqual([]);
  });

  /**
   * The rule relating the three date fields is the same `checkPeriod` a career
   * uses, so the admin is told before a request is made - by the rule the
   * server would have used.
   */
  it('refuses an end before the start, without asking the server', async () => {
    await openTheForm();

    type(localizedLabel('Qualification'), 'BSc Computer Science');
    type(localizedLabel('Institution'), 'University of Casablanca');
    await choose('Level', "Bachelor's degree");
    type('Started', '2018-06');
    type('Ended', '2015-09');
    fireEvent.click(screen.getByRole('button', { name: 'Save entry' }));

    expect(
      await screen.findByText('The end cannot be before the start.'),
    ).toBeTruthy();
    expect(sent).toEqual([]);
  });

  /**
   * Ticking "I am still studying this" clears the end date and disables it, so
   * the form cannot show a contradiction it is about to reject.
   */
  it('clears and disables the end date for a course in progress', async () => {
    await openTheForm();

    type('Ended', '2018-06');
    fireEvent.click(
      screen.getByRole('checkbox', { name: /I am still studying this/ }),
    );

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>('Ended').value).toBe('');
    });
    expect(screen.getByLabelText('Ended')).toHaveProperty('disabled', true);
  });

  it('sends a course in progress with no end date at all', async () => {
    await openTheForm();

    type(localizedLabel('Qualification'), 'MSc Distributed Systems');
    type(localizedLabel('Institution'), 'Open University');
    await choose('Level', "Master's degree");
    type('Started', '2024-09');
    fireEvent.click(
      screen.getByRole('checkbox', { name: /I am still studying this/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save entry' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sentBody().current).toBe(true);
    expect(sentBody()).not.toHaveProperty('endDate');
  });

  // Nothing "went wrong": the same entry exists, and the message belongs on the
  // field it is about rather than in a banner.
  it('puts a duplicate on the institution and keeps the form open', async () => {
    stubApi({ write: DUPLICATE });
    await openTheForm();

    fillRequired();
    await choose('Level', "Bachelor's degree");
    fireEvent.click(screen.getByRole('button', { name: 'Save entry' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(await screen.findByText('That name is already taken.')).toBeTruthy();
    expect(screen.queryByText('New entry')).toBeTruthy();
  });
});

describe('editing and deleting', () => {
  it('loads the entry into the form and replaces it by id', async () => {
    renderPage();
    await screen.findByText('BSc Computer Science');

    await openRowMenu('Actions for BSc Computer Science');
    await chooseMenuItem('Edit');
    await screen.findByText('Edit BSc Computer Science');

    expect(
      screen.getByLabelText<HTMLInputElement>(localizedLabel('Institution'))
        .value,
    ).toBe('University of Casablanca');
    expect(screen.getByLabelText<HTMLInputElement>('Started').value).toBe(
      '2015-09',
    );

    type(localizedLabel('Qualification'), 'BSc Software Engineering');
    fireEvent.click(screen.getByRole('button', { name: 'Save entry' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sent[0]?.method).toBe('PUT');
    expect(sent[0]?.url).toContain('/api/education/e1');
    expect(sentBody().qualification).toEqual({
      en: 'BSc Software Engineering',
    });
  });

  it('closes the editor without sending anything on cancel', async () => {
    renderPage();
    await screen.findByText('BSc Computer Science');

    await openRowMenu('Actions for BSc Computer Science');
    await chooseMenuItem('Edit');
    await screen.findByText('Edit BSc Computer Science');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await screen.findByRole('button', { name: 'Add an entry' });
    expect(sent).toEqual([]);
  });

  it('deletes by id once the admin confirms', async () => {
    renderPage();
    await screen.findByText('BSc Computer Science');

    await deleteRow('Actions for BSc Computer Science');

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sent[0]?.method).toBe('DELETE');
    expect(sent[0]?.url).toContain('/api/education/e1');
  });
});
