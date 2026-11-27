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
import MessagesPage from '../../../src/app/[locale]/admin/(protected)/messages/page';
import { answerConfirmation } from '../../support/menus';
import { ToastViewport } from '../../../src/components/ui/toast';

// The same subset the admin layout supplies, `site` included for the shared control.
const messages = { ...admin, ...site, ...validation, ...responses };

const UNREAD = {
  id: '507f1f77bcf86cd799439011',
  name: 'Ada',
  email: 'ada@example.com',
  subject: 'About your portfolio',
  body: 'Line one.\nLine two.',
  read: false,
  receivedAt: '2026-09-02T10:00:00.000Z',
};

const READ = {
  id: '507f1f77bcf86cd799439012',
  name: 'Grace',
  email: 'grace@example.com',
  subject: 'A question',
  body: 'Are you available?',
  read: true,
  receivedAt: '2026-09-01T09:00:00.000Z',
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

let sent: { method: string; url: string; body: string | null }[] = [];

function stubApi({
  inbox = ok({
    messages: [UNREAD, READ],
    unread: 1,
    page: 0,
    pageSize: 20,
    total: 2,
  }),
  write,
}: { inbox?: Reply; write?: Reply } = {}) {
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
        method === 'GET' ? inbox : (write ?? ok({ message: UNREAD }));

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
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <ToastViewport>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </ToastViewport>
      </NextIntlClientProvider>
    );
  }

  return render(<MessagesPage />, { wrapper: Wrapper });
}

/**
 * The inbox is a list beside a reading pane, so a message's own detail - its
 * body, its address, its actions - exists only once it has been chosen.
 */
async function openMessage(subject: string) {
  fireEvent.click(
    await screen.findByRole('button', { name: new RegExp(subject) }),
  );
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

describe('the inbox', () => {
  it('lists the messages with who sent them', async () => {
    renderPage();
    await screen.findByText('About your portfolio');

    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByText('A question')).toBeTruthy();
  });

  // Nothing is chosen at first, so the pane says what to do rather than
  // guessing at a message the admin never asked for.
  it('waits to be told which message to show', async () => {
    renderPage();
    await screen.findByText('About your portfolio');

    expect(screen.getByText('Choose a message to read it')).toBeTruthy();
    expect(screen.queryByText(/Line one/)).toBeNull();

    await openMessage('About your portfolio');

    expect(await screen.findByText('From Ada (ada@example.com)')).toBeTruthy();
  });

  it('shows the unread count the API reported', async () => {
    renderPage();

    expect(await screen.findByText('1 unread')).toBeTruthy();
  });

  it('says when everything has been read', async () => {
    stubApi({
      inbox: ok({
        messages: [READ],
        unread: 0,
        page: 0,
        pageSize: 20,
        total: 1,
      }),
    });
    renderPage();

    expect(await screen.findByText('All read')).toBeTruthy();
  });

  // An inbox where everything looks alike stops being useful.
  it('marks only the unread ones', async () => {
    renderPage();
    await screen.findByText('About your portfolio');

    expect(screen.getAllByText('Unread')).toHaveLength(1);
  });

  it('says so when there are no messages at all', async () => {
    stubApi({
      inbox: ok({
        messages: [],
        unread: 0,
        page: 0,
        pageSize: 20,
        total: 0,
      }),
    });
    renderPage();

    expect(await screen.findByText('No messages yet')).toBeTruthy();
  });

  it('reports a failed read rather than an empty inbox', async () => {
    stubApi({ inbox: UNREADABLE });
    renderPage();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('No messages yet')).toBeNull();
  });

  // The sender's own line breaks are the only structure a message has.
  it('preserves the line breaks the sender typed', async () => {
    renderPage();
    await openMessage('About your portfolio');

    const body = await screen.findByText(/Line one/);

    expect(body.textContent).toBe('Line one.\nLine two.');
    // The class, not the computed style: jsdom loads no stylesheet, so a
    // computed-style assertion would be testing Tailwind rather than this page.
    expect(body.className).toContain('whitespace-pre-wrap');
  });

  it('offers a reply that opens a mail client, pre-addressed', async () => {
    renderPage();
    await openMessage('About your portfolio');

    const reply = await screen.findByRole('link', { name: 'Reply by email' });

    expect(reply?.getAttribute('href')).toBe(
      'mailto:ada@example.com?subject=Re%3A%20About%20your%20portfolio',
    );
  });
});

describe('showing more', () => {
  /** A page of `count` messages starting at `index`, out of `total`. */
  function page(index: number, count: number, total: number) {
    return ok({
      messages: Array.from({ length: count }, (_, offset) => ({
        ...UNREAD,
        id: `m-${index}-${offset}`,
        subject: `Message ${index}-${offset}`,
      })),
      unread: 0,
      page: index,
      pageSize: 2,
      total,
    });
  }

  /** Answers each page the API is asked for, and records the asks. */
  function stubPages(total: number, requested: string[] = []) {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        requested.push(url);
        const index = Number(/page=(\d+)/.exec(url)?.[1] ?? 0);
        const reply = page(index, Math.min(2, total - index * 2), total);

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(reply.body),
        });
      }),
    );

    return requested;
  }

  // A control under a single page of messages is noise.
  it('is not shown when everything fits on one page', async () => {
    renderPage();
    await screen.findByText('About your portfolio');

    expect(
      screen.queryByRole('button', { name: 'Show more messages' }),
    ).toBeNull();
    expect(screen.queryByText(/Showing/)).toBeNull();
  });

  it('says how many are showing once there is more than a page', async () => {
    stubPages(5);
    renderPage();

    await screen.findByText('Message 0-0');

    expect(screen.getByText('Showing 2 of 5')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Show more messages' }),
    ).toBeTruthy();
  });

  it('fetches the next page and adds it under the first', async () => {
    const requested = stubPages(5);
    renderPage();
    await screen.findByText('Message 0-0');

    fireEvent.click(screen.getByRole('button', { name: 'Show more messages' }));

    await screen.findByText('Message 1-0');
    expect(requested.some((url) => url.includes('page=1'))).toBe(true);
    // Appended, not replaced: the first page is still there.
    expect(screen.getByText('Message 0-0')).toBeTruthy();
    expect(screen.getByText('Showing 4 of 5')).toBeTruthy();
  });

  it('moves focus to the first message that arrived', async () => {
    stubPages(5);
    renderPage();
    await screen.findByText('Message 0-0');

    fireEvent.click(screen.getByRole('button', { name: 'Show more messages' }));

    await waitFor(() =>
      expect(document.activeElement?.textContent).toContain('Message 1-0'),
    );
  });

  it('drops the button once everything is shown, and keeps the count', async () => {
    stubPages(3);
    renderPage();
    await screen.findByText('Message 0-0');

    fireEvent.click(screen.getByRole('button', { name: 'Show more messages' }));

    await screen.findByText('Message 1-0');
    expect(screen.getByText('Showing 3 of 3')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Show more messages' }),
    ).toBeNull();
  });
});

describe('marking read', () => {
  it('marks an unread message read', async () => {
    renderPage();
    await openMessage('About your portfolio');

    fireEvent.click(
      await screen.findByRole('button', { name: 'Mark as read' }),
    );

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sent[0]?.method).toBe('PATCH');
    expect(sent[0]?.url).toContain(
      '/api/messages/507f1f77bcf86cd799439011/read',
    );
    expect(sentBody()).toEqual({ read: true });
  });

  /**
   * Without a guard, clicking twice before the first answer sends a second
   * request that undoes the first - and the row ends up back where it started.
   */
  it('ignores a second click while the first is still in flight', async () => {
    renderPage();
    await openMessage('About your portfolio');

    const button = await screen.findByRole('button', { name: 'Mark as read' });

    fireEvent.click(button);

    // Checked here rather than after the wait: once the request settles the
    // guard is released, which is correct and would hide the thing under test.
    expect(button).toHaveProperty('disabled', true);

    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sent).toHaveLength(1);
  });

  // The guard is per message, not per pane: one still saving must not disable
  // the next one the admin opens.
  it('leaves another message usable while one is saving', async () => {
    renderPage();
    await openMessage('About your portfolio');

    fireEvent.click(
      await screen.findByRole('button', { name: 'Mark as read' }),
    );
    await openMessage('A question');

    expect(
      await screen.findByRole('button', { name: 'Mark as unread' }),
    ).toHaveProperty('disabled', false);
  });

  it('marks a read message unread again', async () => {
    renderPage();
    await openMessage('A question');

    fireEvent.click(
      await screen.findByRole('button', { name: 'Mark as unread' }),
    );

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sentBody()).toEqual({ read: false });
    expect(sent[0]?.url).toContain(
      '/api/messages/507f1f77bcf86cd799439012/read',
    );
  });
});

describe('deleting a message', () => {
  it('asks first, and does nothing when the admin declines', async () => {
    renderPage();
    await openMessage('About your portfolio');

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alertdialog')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(sent).toEqual([]);
  });

  it('deletes by id once the admin confirms', async () => {
    renderPage();
    await openMessage('About your portfolio');

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await answerConfirmation('Delete');

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sent[0]?.method).toBe('DELETE');
    expect(sent[0]?.url).toContain('/api/messages/507f1f77bcf86cd799439011');
  });
});
