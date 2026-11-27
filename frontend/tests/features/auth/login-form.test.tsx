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
import { LoginForm } from '../../../src/features/auth/login-form';
import { ToastViewport } from '../../../src/components/ui/toast';

const replace = vi.fn();
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ replace }) }));

// The same subset the admin layout supplies.
const messages = { ...admin, ...site, ...validation, ...responses };

const EMAIL = 'admin@example.com';
const PASSWORD = 'correct-horse-battery';

type Reply = { status: number; body: unknown };

const NO_SESSION: Reply = {
  status: 200,
  body: { code: 'SUCCESS', details: { user: null } },
};

/** `/api/auth/session` always answers "nobody"; only the login reply varies. */
function stubApi(loginReply: Reply) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const reply = String(url).includes('/api/auth/login')
        ? loginReply
        : NO_SESSION;

      return Promise.resolve({
        ok: reply.status >= 200 && reply.status < 300,
        status: reply.status,
        json: () => Promise.resolve(reply.body),
      });
    }),
  );
}

function renderForm() {
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

  return render(<LoginForm />, { wrapper: Wrapper });
}

/** The form only appears once the session check has answered. */
function formOf(container: HTMLElement) {
  return waitFor(() => {
    const found = container.querySelector('form');
    if (!found) throw new Error('form not rendered yet');
    return found;
  });
}

function fillCredentials() {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: EMAIL },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: PASSWORD },
  });
}

beforeEach(() => {
  replace.mockClear();
  stubApi(NO_SESSION);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('LoginForm rendered output', () => {
  it('shows the form once the session check says nobody is signed in', async () => {
    renderForm();

    expect(await screen.findByLabelText('Email')).toBeDefined();
    expect(screen.getByLabelText('Password')).toBeDefined();
  });

  // The bug this suite exists for: a raw key path reaching the screen.
  it('renders written field errors, never a translation key', async () => {
    const { container } = renderForm();
    const form = await formOf(container);

    form.requestSubmit();

    const emailError = await screen.findByText('Enter a valid email address.');
    const passwordError = screen.getByText('This field is required.');

    expect(emailError).toBeDefined();
    expect(passwordError).toBeDefined();
    expect(container.textContent).not.toContain('validation.');
    expect(container.textContent).not.toContain('admin.login');
  });

  // The shared field component must keep carrying these through.
  it('keeps the input type and autofill hints', async () => {
    const { container } = renderForm();
    await formOf(container);

    const email = screen.getByLabelText('Email');
    const password = screen.getByLabelText('Password');

    expect(email.getAttribute('type')).toBe('email');
    expect(email.getAttribute('autocomplete')).toBe('username');
    expect(password.getAttribute('type')).toBe('password');
    expect(password.getAttribute('autocomplete')).toBe('current-password');
  });

  it('announces field errors to assistive technology', async () => {
    const { container } = renderForm();
    const form = await formOf(container);

    form.requestSubmit();

    await waitFor(() => {
      expect(container.querySelectorAll('[role="alert"]').length).toBe(2);
    });
  });
});

describe('LoginForm accessibility', () => {
  it('marks an invalid field and points it at its own message', async () => {
    const { container } = renderForm();
    const form = await formOf(container);

    form.requestSubmit();

    await waitFor(() => {
      expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe(
        'true',
      );
    });
    expect(
      screen.getByLabelText('Email').getAttribute('aria-describedby'),
    ).toBe('email-error');
    expect(container.querySelector('#email-error')).not.toBeNull();
  });

  it('clears a field error once the value is corrected', async () => {
    const { container } = renderForm();
    const form = await formOf(container);

    form.requestSubmit();
    await screen.findByText('Enter a valid email address.');

    fillCredentials();

    await waitFor(() => {
      expect(screen.queryByText('Enter a valid email address.')).toBeNull();
    });
  });
});

describe('LoginForm submission', () => {
  it('signs in with valid credentials and leaves for the admin area', async () => {
    stubApi({
      status: 200,
      body: {
        code: 'SUCCESS',
        details: { user: { id: '1', email: EMAIL, role: 'admin' } },
      },
    });

    const { container } = renderForm();
    const form = await formOf(container);

    fillCredentials();
    form.requestSubmit();

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/admin');
    });
  });

  // The rate limiter answers with a code like any other rejection.
  it('shows a throttled attempt as a global message', async () => {
    stubApi({
      status: 429,
      body: { code: 'TOO_MANY_REQUESTS', details: {} },
    });

    const { container } = renderForm();
    const form = await formOf(container);

    fillCredentials();
    form.requestSubmit();

    expect(
      await screen.findByText(
        'Too many attempts. Please wait a few minutes and try again.',
      ),
    ).toBeDefined();
    expect(replace).not.toHaveBeenCalled();
  });

  it('lands a server field code on the field it belongs to', async () => {
    stubApi({
      status: 422,
      body: {
        code: 'VALIDATION_ERROR',
        details: { email: 'INVALID_EMAIL' },
      },
    });

    const { container } = renderForm();
    const form = await formOf(container);

    fillCredentials();
    form.requestSubmit();

    expect(
      await screen.findByText('Enter a valid email address.'),
    ).toBeDefined();
    expect(
      screen.getByLabelText('Email').getAttribute('aria-describedby'),
    ).toBe('email-error');

    // The field already says what to fix; the banner would only repeat it.
    expect(
      screen.queryByText('Please check the highlighted fields and try again.'),
    ).toBeNull();
  });

  it('explains a rejected password in words and stays on the page', async () => {
    stubApi({
      status: 401,
      body: { code: 'INVALID_CREDENTIALS', details: {} },
    });

    const { container } = renderForm();
    const form = await formOf(container);

    fillCredentials();
    form.requestSubmit();

    expect(
      await screen.findByText('Incorrect email or password.'),
    ).toBeDefined();
    expect(container.textContent).not.toContain('responses.');
    expect(replace).not.toHaveBeenCalled();
  });
});
