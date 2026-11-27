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
import AccountPage from '../../../src/app/[locale]/admin/(protected)/account/page';
import { ToastViewport } from '../../../src/components/ui/toast';

const messages = { ...admin, ...site, ...validation, ...responses };

const EMAIL = 'admin@example.com';
const CURRENT = 'correct-horse-battery';
const NEXT = 'a-longer-different-passphrase';

type Reply = { status: number; body: unknown };

const SESSION: Reply = {
  status: 200,
  body: {
    code: 'SUCCESS',
    details: { user: { id: 'u1', email: EMAIL, role: 'admin' } },
  },
};
const OK: Reply = { status: 200, body: { code: 'SUCCESS', details: {} } };
const WRONG_PASSWORD: Reply = {
  status: 401,
  body: { code: 'INVALID_CREDENTIALS', details: {} },
};
const SERVER_ERROR: Reply = {
  status: 500,
  body: { code: 'SERVER_ERROR', details: {} },
};

/** Every write, so a test can assert what actually went over the wire. */
let sent: { method: string; url: string; body: string | null }[] = [];

function stubApi({ write = OK }: { write?: Reply } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';

      if (method !== 'GET') {
        sent.push({
          method,
          url: String(url),
          body: typeof init?.body === 'string' ? init.body : null,
        });
      }

      const reply = method === 'GET' ? SESSION : write;

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

  return render(<AccountPage />, { wrapper: Wrapper });
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillPasswords({
  current = CURRENT,
  next = NEXT,
  confirm = NEXT,
} = {}) {
  type('Current password', current);
  type('New password', next);
  type('Repeat the new password', confirm);
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
}

const NEW_EMAIL = 'moved@example.com';

function fillEmail({
  current = CURRENT,
  next = NEW_EMAIL,
  confirm = NEW_EMAIL,
} = {}) {
  type('Your password, to confirm', current);
  type('New email address', next);
  type('Repeat the new address', confirm);
}

function submitEmail() {
  fireEvent.click(screen.getByRole('button', { name: 'Change address' }));
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

describe('the account page', () => {
  it('shows the address the session is signed in with', async () => {
    renderPage();

    expect(await screen.findByText(EMAIL)).toBeTruthy();
  });
});

describe('changing the password', () => {
  it('sends the current and the new one', async () => {
    renderPage();
    await screen.findByText(EMAIL);

    fillPasswords();
    submit();

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.method).toBe('PUT');
    expect(sent[0]?.url).toContain('/api/auth/password');
    expect(sentBody()).toEqual({
      currentPassword: CURRENT,
      newPassword: NEXT,
    });
  });

  /**
   * The confirmation is a client check with no field behind it on the API. A
   * form that sent it would be sending something the endpoint refuses to name.
   */
  it('never sends the confirmation', async () => {
    renderPage();
    await screen.findByText(EMAIL);

    fillPasswords();
    submit();

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sentBody()).not.toHaveProperty('confirmPassword');
  });

  /**
   * There is no password reset by email in this project, so a typo in a new
   * password locks the owner out until someone runs a script inside a
   * container. This is the only thing standing between them and that.
   */
  it('refuses a mismatched confirmation without asking the server', async () => {
    renderPage();
    await screen.findByText(EMAIL);

    fillPasswords({ confirm: 'not-the-same-passphrase' });
    submit();

    expect(
      await screen.findByText('The two entries do not match.'),
    ).toBeTruthy();
    expect(sent).toHaveLength(0);
  });

  it('refuses a new password that is the current one', async () => {
    renderPage();
    await screen.findByText(EMAIL);

    fillPasswords({ next: CURRENT, confirm: CURRENT });
    submit();

    expect(
      await screen.findByText('This is the same as the current one.'),
    ).toBeTruthy();
    expect(sent).toHaveLength(0);
  });

  // The policy is applied here as well as on the server, so the admin is not
  // told about the minimum by a round trip.
  it('refuses a new password shorter than the policy allows', async () => {
    renderPage();
    await screen.findByText(EMAIL);

    fillPasswords({ next: 'short', confirm: 'short' });
    submit();

    expect(await screen.findByText('This value is too small.')).toBeTruthy();
    expect(sent).toHaveLength(0);
  });

  /**
   * A wrong current password answers `INVALID_CREDENTIALS`, which carries no
   * field path - so it is put on the field it is about rather than left as a
   * banner over a form whose first box is the problem.
   */
  it('reports a wrong current password on that field', async () => {
    stubApi({ write: WRONG_PASSWORD });
    renderPage();
    await screen.findByText(EMAIL);

    fillPasswords();
    submit();

    const field = await screen.findByLabelText('Current password');
    await waitFor(() =>
      expect(field.getAttribute('aria-describedby')).toContain(
        'current-password-error',
      ),
    );
  });

  it('says so on success, and stops holding either password', async () => {
    renderPage();
    await screen.findByText(EMAIL);

    fillPasswords();
    submit();

    expect(
      await screen.findByText(
        'Password changed. Every other device has been signed out.',
      ),
    ).toBeTruthy();

    for (const label of [
      'Current password',
      'New password',
      'Repeat the new password',
    ]) {
      expect(screen.getByLabelText<HTMLInputElement>(label).value).toBe('');
    }
  });

  it('reports a failure that is not about a field', async () => {
    stubApi({ write: SERVER_ERROR });
    renderPage();
    await screen.findByText(EMAIL);

    fillPasswords();
    submit();

    expect(
      await screen.findByText('Something went wrong. Please try again.'),
    ).toBeTruthy();
  });
});

describe('signing out other devices', () => {
  function revoke() {
    fireEvent.click(
      screen.getByRole('button', { name: 'Sign out other devices' }),
    );
  }

  it('asks the server to revoke them', async () => {
    renderPage();
    await screen.findByText(EMAIL);

    revoke();

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.method).toBe('POST');
    expect(sent[0]?.url).toContain('/api/auth/revoke');
  });

  // Nothing on screen changes when it works - the sessions it ends are
  // elsewhere - so saying so is the only feedback there is.
  it('says so afterwards', async () => {
    renderPage();
    await screen.findByText(EMAIL);

    revoke();

    expect(
      await screen.findByText('Every other device has been signed out.'),
    ).toBeTruthy();
  });

  it('reports a failure rather than claiming it worked', async () => {
    stubApi({ write: SERVER_ERROR });
    renderPage();
    await screen.findByText(EMAIL);

    revoke();

    expect(
      await screen.findByText('Something went wrong. Please try again.'),
    ).toBeTruthy();
    expect(
      screen.queryByText('Every other device has been signed out.'),
    ).toBeNull();
  });
});

/**
 * The other credential nothing could rotate. The address is the account's
 * identity, so the form is guarded the way the password's is.
 */
describe('changing the address', () => {
  const MOVED: Reply = {
    status: 200,
    body: {
      code: 'SUCCESS',
      details: { user: { id: 'u1', email: NEW_EMAIL, role: 'admin' } },
    },
  };

  it('sends the current password and the new address', async () => {
    stubApi({ write: MOVED });
    renderPage();
    await screen.findByText(EMAIL);

    fillEmail();
    submitEmail();

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.method).toBe('PUT');
    expect(sent[0]?.url).toContain('/api/auth/email');
    expect(sentBody()).toEqual({
      currentPassword: CURRENT,
      newEmail: NEW_EMAIL,
    });
  });

  it('never sends the confirmation', async () => {
    stubApi({ write: MOVED });
    renderPage();
    await screen.findByText(EMAIL);

    fillEmail();
    submitEmail();

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sentBody()).not.toHaveProperty('confirmEmail');
  });

  /**
   * There is no confirmation email - this project has no mail transport - so a
   * typo here is the address the owner will have to sign in with. Typing it
   * twice is what stands between them and `npm run admin:email` in a container.
   */
  it('refuses a mismatched confirmation without asking the server', async () => {
    renderPage();
    await screen.findByText(EMAIL);

    fillEmail({ confirm: 'moved@example.org' });
    submitEmail();

    await waitFor(() =>
      expect(screen.getByText('The two entries do not match.')).toBeTruthy(),
    );
    expect(sent).toEqual([]);
  });

  // Writing it would report a change that changed nothing and take every
  // session down for it.
  it('refuses the address already stored, without asking the server', async () => {
    renderPage();
    await screen.findByText(EMAIL);

    fillEmail({ next: EMAIL, confirm: EMAIL });
    submitEmail();

    await waitFor(() => expect(sent).toEqual([]));
  });

  /**
   * The same claim login checks, so the same code - and it belongs on the field
   * it is about rather than over a form whose first box is the problem.
   */
  it('reports a wrong current password on that field', async () => {
    stubApi({ write: WRONG_PASSWORD });
    renderPage();
    await screen.findByText(EMAIL);

    fillEmail();
    submitEmail();

    await waitFor(() => expect(sent).toHaveLength(1));

    const field = screen.getByLabelText('Your password, to confirm');
    expect(field.getAttribute('aria-invalid')).toBe('true');
  });

  // The sidebar and this card are showing the old address until the response
  // says otherwise, and the response already carries the new one.
  it('shows the new address without asking the server again', async () => {
    stubApi({ write: MOVED });
    renderPage();
    await screen.findByText(EMAIL);

    fillEmail();
    submitEmail();

    expect(await screen.findByText(NEW_EMAIL)).toBeTruthy();
    expect(sent.filter((write) => write.method === 'GET')).toEqual([]);
  });
});
