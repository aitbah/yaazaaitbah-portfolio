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
import { MailCard } from '../../../src/features/account/mail-card';
import { ToastViewport } from '../../../src/components/ui/toast';

const messages = { ...admin, ...site, ...validation, ...responses };

const CONFIGURED = {
  configured: true,
  host: 'smtp.example.test',
  port: 587,
  from: 'site@example.test',
  notifyTo: 'owner@example.test',
};

type Reply = { status: number; body: unknown };

let sent: string[] = [];

/**
 * Routed by method, because this card both reads and writes: the status is a
 * GET and the test send is a POST to a different path.
 */
function stubApi(status: unknown, send: Reply) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';

      if (method === 'GET') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({ code: 'SUCCESS', details: { mail: status } }),
        });
      }

      sent.push(String(url));

      return Promise.resolve({
        ok: send.status >= 200 && send.status < 300,
        status: send.status,
        json: () => Promise.resolve(send.body),
      });
    }),
  );
}

const SENT: Reply = {
  status: 200,
  body: { code: 'SUCCESS', details: { sentTo: 'owner@example.test' } },
};

function renderCard() {
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

  return render(<MailCard />, { wrapper: Wrapper });
}

beforeEach(() => {
  sent = [];
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the mail card with no transport', () => {
  /**
   * The state the project ships in, and the one a deployment starts in. It has
   * to say what still works, or it reads as a broken contact form.
   */
  it('says mail is off and that messages are still kept', async () => {
    stubApi({ configured: false }, SENT);
    renderCard();

    expect(
      await screen.findByText('No mail server is configured.'),
    ).toBeTruthy();
    expect(
      screen.getByText(/still stored and shown in the inbox/),
    ).toBeTruthy();
  });

  it('offers no test to send', async () => {
    stubApi({ configured: false }, SENT);
    renderCard();

    await screen.findByText('No mail server is configured.');
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('the mail card with a transport', () => {
  it('shows what the settings are', async () => {
    stubApi(CONFIGURED, SENT);
    renderCard();

    expect(await screen.findByText('smtp.example.test:587')).toBeTruthy();
    expect(screen.getByText('site@example.test')).toBeTruthy();
    expect(screen.getByText('owner@example.test')).toBeTruthy();
  });

  it('sends a test and names where it went', async () => {
    stubApi(CONFIGURED, SENT);
    renderCard();

    fireEvent.click(await screen.findByRole('button'));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toContain('/api/mail/test');
    expect(await screen.findByText(/Sent to owner@example.test/)).toBeTruthy();
  });

  /**
   * The reason the endpoint answers 503 with a reason rather than a success
   * carrying a flag. Both of these used to be reachable only as "Something
   * went wrong", which is the answer this card exists to replace.
   */
  it('says the server refused, rather than something went wrong', async () => {
    stubApi(CONFIGURED, {
      status: 503,
      body: { code: 'SERVICE_UNAVAILABLE', details: { mail: 'SEND_FAILED' } },
    });
    renderCard();

    fireEvent.click(await screen.findByRole('button'));

    expect(
      await screen.findByText(/The mail server refused the message/),
    ).toBeTruthy();
    expect(screen.queryByText(/Something went wrong/)).toBeNull();
  });

  it('distinguishes having nothing to send with', async () => {
    stubApi(CONFIGURED, {
      status: 503,
      body: {
        code: 'SERVICE_UNAVAILABLE',
        details: { mail: 'NOT_CONFIGURED' },
      },
    });
    renderCard();

    fireEvent.click(await screen.findByRole('button'));

    expect(
      await screen.findByText(/there was nothing to send with/),
    ).toBeTruthy();
  });

  // Anything the server did not explain still has to say something true.
  it('falls back to the response code for an unexplained failure', async () => {
    stubApi(CONFIGURED, {
      status: 429,
      body: { code: 'TOO_MANY_REQUESTS', details: {} },
    });
    renderCard();

    fireEvent.click(await screen.findByRole('button'));

    expect(await screen.findByText(/Too many attempts/)).toBeTruthy();
  });
});
