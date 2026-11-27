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
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import admin from '../../../messages/en/admin.json';
import site from '../../../messages/en/site.json';
import responses from '../../../messages/en/responses.json';
import validation from '../../../messages/en/validation.json';
import CertificationsPage from '../../../src/app/[locale]/admin/(protected)/certifications/page';
import CoursesPage from '../../../src/app/[locale]/admin/(protected)/courses/page';
import { chooseMenuItem, deleteRow, openRowMenu } from '../../support/menus';
import { localizedLabel } from '../../support/localized-label';
import { ToastViewport } from '../../../src/components/ui/toast';

const messages = { ...admin, ...site, ...validation, ...responses };

/**
 * A fixed "now", because "expired" is a comparison against today and a test
 * that read the real clock would start failing on a date nobody chose.
 */
const NOW = new Date('2026-04-15T12:00:00.000Z');

const VALID = {
  id: 'c1',
  kind: 'certification',
  name: { en: 'AWS Certified Developer' },
  issuer: { en: 'Amazon Web Services' },
  issuedAt: '2023-04',
  expiresAt: '2027-04',
  credentialId: 'AWS-123',
  credentialUrl: 'https://verify.example.com/AWS-123',
  updatedAt: '2026-09-05T10:00:00.000Z',
};

const EXPIRED = {
  id: 'c2',
  kind: 'certification',
  name: { en: 'Old Certification' },
  issuer: { en: 'Some Body' },
  issuedAt: '2016-01',
  expiresAt: '2019-01',
  updatedAt: '2026-09-05T10:00:00.000Z',
};

const FOREVER = {
  id: 'c3',
  kind: 'course',
  name: { en: 'Advanced TypeScript' },
  issuer: { en: 'Frontend Masters' },
  issuedAt: '2024-02',
  updatedAt: '2026-09-05T10:00:00.000Z',
};

type Reply = { status: number; body: unknown };

const listed = (envelope: string, rows: unknown[]): Reply => ({
  status: 200,
  body: { code: 'SUCCESS', details: { [envelope]: rows } },
});
const saved: Reply = {
  status: 200,
  body: { code: 'SUCCESS', details: { credential: VALID } },
};
const DUPLICATE: Reply = {
  status: 409,
  body: { code: 'CONFLICT', details: { 'name.en': 'ALREADY_EXISTS' } },
};

/** Every write, so a test can assert what actually went over the wire. */
let sent: { method: string; url: string; body: string | null }[] = [];

function stubApi(list: Reply, write: Reply = saved) {
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

function renderPage(Page: () => ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      // A fixed zone, so the month formatting asserts the component rather than
      // the machine the tests happen to run on.
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

  return render(<Page />, { wrapper: Wrapper });
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function sentBody(index = 0): Record<string, unknown> {
  const write = sent[index];
  if (!write?.body) throw new Error(`no request was sent at ${index}`);

  return JSON.parse(write.body) as Record<string, unknown>;
}

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  sent = [];
  stubApi(listed('certifications', [VALID, EXPIRED]));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the certifications page', () => {
  it('lists what the API returned, under the resource name', async () => {
    renderPage(CertificationsPage);

    expect(await screen.findByText('AWS Certified Developer')).toBeTruthy();
    expect(screen.getByText('Old Certification')).toBeTruthy();
  });

  /**
   * The one thing this section does that the others do not. An expired
   * credential is stored and shown rather than refused - it is a true fact
   * about someone's history - so saying which is the admin's job.
   */
  it('marks an expired credential and leaves a valid one alone', async () => {
    renderPage(CertificationsPage);

    const expired = (await screen.findByText('Old Certification')).closest(
      'li',
    );
    const valid = screen.getByText('AWS Certified Developer').closest('li');

    expect(expired?.textContent).toContain('Expired');
    expect(valid?.textContent).not.toContain('Expired');
  });

  it('says a credential with no expiry does not expire', async () => {
    stubApi(listed('certifications', [FOREVER]));
    renderPage(CertificationsPage);

    const row = (await screen.findByText('Advanced TypeScript')).closest('li');

    expect(row?.textContent).toContain('does not expire');
    expect(row?.textContent).not.toContain('Expired');
  });

  it('links to the issuer for verification, opened safely', async () => {
    renderPage(CertificationsPage);

    const link = await screen.findByRole<HTMLAnchorElement>('link', {
      name: 'Verify',
    });

    expect(link.href).toBe('https://verify.example.com/AWS-123');
    expect(link.rel).toContain('noopener');
  });

  it('says so when there are none yet', async () => {
    stubApi(listed('certifications', []));
    renderPage(CertificationsPage);

    expect(await screen.findByText('No certifications yet')).toBeTruthy();
  });

  /** The dates are the order, so there is nothing to drag. */
  it('offers no reorder controls', async () => {
    renderPage(CertificationsPage);
    await screen.findByText('AWS Certified Developer');

    expect(screen.queryByRole('button', { name: /Move .* up/ })).toBeNull();
  });
});

/** The same component, a different kind - so the resource must follow. */
describe('the courses page', () => {
  it('reads its own resource, not the other kind’s', async () => {
    const seen: string[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        seen.push(url);

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              code: 'SUCCESS',
              details: { courses: [FOREVER] },
            }),
        });
      }),
    );

    renderPage(CoursesPage);

    expect(await screen.findByText('Advanced TypeScript')).toBeTruthy();
    expect(seen.some((url) => url.endsWith('/api/courses'))).toBe(true);
    expect(seen.some((url) => url.includes('/api/certifications'))).toBe(false);
  });

  it('names the section as courses, not as certifications', async () => {
    stubApi(listed('courses', []));
    renderPage(CoursesPage);

    expect(await screen.findByText('No courses yet')).toBeTruthy();
    expect(screen.queryByText('No certifications yet')).toBeNull();
  });
});

describe('creating a credential', () => {
  async function openTheForm() {
    renderPage(CertificationsPage);
    const [add] = await screen.findAllByRole('button', {
      name: 'Add a certification',
    });
    fireEvent.click(add!);
    await screen.findByText('New certification');
  }

  it('sends what was filled in, and nothing that was left blank', async () => {
    await openTheForm();

    type(localizedLabel('Name'), 'AWS Certified Developer');
    type(localizedLabel('Issuer'), 'Amazon Web Services');
    type('Issued', '2023-04');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sent[0]?.method).toBe('POST');
    expect(sent[0]?.url).toContain('/api/certifications');
    expect(sentBody()).toEqual({
      name: { en: 'AWS Certified Developer' },
      issuer: { en: 'Amazon Web Services' },
      issuedAt: '2023-04',
    });
  });

  /**
   * An expiry in the past is a true fact rather than an error, so the form
   * sends it - the list is what says it has expired.
   */
  it('accepts an expiry that is already in the past', async () => {
    await openTheForm();

    type(localizedLabel('Name'), 'Old Certification');
    type(localizedLabel('Issuer'), 'Some Body');
    type('Issued', '2016-01');
    type('Expires', '2019-01');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(sent.length).toBe(1));
    expect(sentBody().expiresAt).toBe('2019-01');
  });

  /**
   * The shared rule, reaching the admin before a request is made - the only
   * rule about the two dates, because the rest would be refusing the truth.
   */
  it('refuses an expiry that precedes the issue, without asking the server', async () => {
    await openTheForm();

    type(localizedLabel('Name'), 'Backwards');
    type(localizedLabel('Issuer'), 'Some Body');
    type('Issued', '2023-04');
    type('Expires', '2022-01');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('The expiry cannot be before the issue date.'),
    ).toBeTruthy();
    expect(sent).toEqual([]);
  });

  it('refuses a verification URL that is not a link', async () => {
    await openTheForm();

    type(localizedLabel('Name'), 'Unsafe');
    type(localizedLabel('Issuer'), 'Some Body');
    type('Issued', '2023-04');
    type('Verification URL', 'javascript:alert(1)');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(
        screen.getByLabelText('Verification URL').getAttribute('aria-invalid'),
      ).toBe('true');
    });
    expect(sent).toEqual([]);
  });

  it('refuses an empty form and sends nothing', async () => {
    await openTheForm();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findAllByText('This field is required.');
    expect(sent).toEqual([]);
  });

  // Nothing "went wrong": the same credential exists, and the message belongs
  // on the field it is about rather than in a banner.
  it('puts a duplicate on the name and keeps the form open', async () => {
    stubApi(listed('certifications', [VALID, EXPIRED]), DUPLICATE);
    await openTheForm();

    type(localizedLabel('Name'), 'AWS Certified Developer');
    type(localizedLabel('Issuer'), 'Amazon Web Services');
    type('Issued', '2023-04');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(await screen.findByText('That name is already taken.')).toBeTruthy();
    expect(screen.queryByText('New certification')).toBeTruthy();
  });
});

describe('editing and deleting', () => {
  it('loads the credential into the form and replaces it by id', async () => {
    renderPage(CertificationsPage);
    await screen.findByText('AWS Certified Developer');

    await openRowMenu('Actions for AWS Certified Developer');
    await chooseMenuItem('Edit');
    await screen.findByText('Edit AWS Certified Developer');

    expect(
      screen.getByLabelText<HTMLInputElement>(localizedLabel('Issuer')).value,
    ).toBe('Amazon Web Services');
    expect(screen.getByLabelText<HTMLInputElement>('Credential ID').value).toBe(
      'AWS-123',
    );

    type(localizedLabel('Issuer'), 'AWS');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sent[0]?.method).toBe('PUT');
    expect(sent[0]?.url).toContain('/api/certifications/c1');
    expect(sentBody().issuer).toEqual({ en: 'AWS' });
  });

  /** `PUT` replaces, so clearing the expiry must actually send it cleared. */
  it('clears an expiry the admin removed', async () => {
    renderPage(CertificationsPage);
    await screen.findByText('AWS Certified Developer');

    await openRowMenu('Actions for AWS Certified Developer');
    await chooseMenuItem('Edit');
    await screen.findByText('Edit AWS Certified Developer');

    type('Expires', '');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(sent.length).toBe(1));
    expect(sentBody()).not.toHaveProperty('expiresAt');
  });

  it('deletes by id once the admin confirms', async () => {
    renderPage(CertificationsPage);
    await screen.findByText('AWS Certified Developer');

    await deleteRow('Actions for AWS Certified Developer');

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sent[0]?.method).toBe('DELETE');
    expect(sent[0]?.url).toContain('/api/certifications/c1');
  });
});
