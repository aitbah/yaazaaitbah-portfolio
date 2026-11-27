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
import SocialLinksPage from '../../../src/app/[locale]/admin/(protected)/social-links/page';
import { optionsReply } from '../../support/options';
import { chooseMenuItem, deleteRow, openRowMenu } from '../../support/menus';
import { ToastViewport } from '../../../src/components/ui/toast';

const messages = { ...admin, ...site, ...validation, ...responses };

const GITHUB = {
  id: '507f1f77bcf86cd799439011',
  platform: 'github',
  url: 'https://github.com/me',
  order: 0,
  updatedAt: '2026-09-02T10:00:00.000Z',
};

const LINKEDIN = {
  id: '507f1f77bcf86cd799439012',
  platform: 'linkedin',
  url: 'https://linkedin.com/in/me',
  order: 1,
  updatedAt: '2026-09-02T10:00:00.000Z',
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
const DUPLICATE: Reply = {
  status: 409,
  body: { code: 'CONFLICT', details: { url: 'ALREADY_EXISTS' } },
};

let sent: { method: string; url: string; body: string | null }[] = [];

function stubApi({
  list = ok({ socialLinks: [GITHUB, LINKEDIN] }),
  write,
}: { list?: Reply; write?: Reply } = {}) {
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

      const reply =
        method === 'GET' ? list : (write ?? ok({ socialLink: GITHUB }));

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

  return render(<SocialLinksPage />, { wrapper: Wrapper });
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

async function openTheForm() {
  renderPage();
  await screen.findByText('GitHub');
  fireEvent.click(screen.getByRole('button', { name: 'Add a link' }));
  await screen.findByText('New link');
}

beforeEach(() => {
  sent = [];
  stubApi();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the social links page', () => {
  it('shows the platform as a translated label, never as the stored code', async () => {
    renderPage();
    await screen.findByText('GitHub');

    expect(screen.getByText('LinkedIn')).toBeTruthy();
    expect(screen.queryByText('linkedin')).toBeNull();
  });

  it('shows each URL so the admin can tell two accounts apart', async () => {
    renderPage();
    await screen.findByText('GitHub');

    expect(screen.getByText('https://github.com/me')).toBeTruthy();
  });

  it('says so when there are no links yet', async () => {
    stubApi({ list: ok({ socialLinks: [] }) });
    renderPage();

    expect(await screen.findByText('No links yet')).toBeTruthy();
  });

  it('reports a failed read instead of offering an editor', async () => {
    stubApi({ list: UNREADABLE });
    renderPage();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add a link' })).toBeNull();
  });
});

describe('creating a link', () => {
  it('sends the chosen platform code and the URL', async () => {
    await openTheForm();

    await choose('Platform', 'Mastodon');
    type('URL', 'https://mastodon.social/@me');
    fireEvent.click(screen.getByRole('button', { name: 'Save link' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sent[0]?.method).toBe('POST');
    expect(sentBody()).toEqual({
      platform: 'mastodon',
      url: 'https://mastodon.social/@me',
      order: 0,
    });
  });

  it('refuses an empty form and sends nothing', async () => {
    await openTheForm();

    fireEvent.click(screen.getByRole('button', { name: 'Save link' }));

    await screen.findAllByText('This field is required.');
    expect(sent).toEqual([]);
  });

  // Rendered as an href, so an unsafe protocol must never reach the API.
  it.each(['javascript:alert(1)', 'not a url'])(
    'rejects %s before sending',
    async (url) => {
      await openTheForm();

      await choose('Platform', 'Website');
      type('URL', url);
      fireEvent.click(screen.getByRole('button', { name: 'Save link' }));

      expect(await screen.findByText('Enter a valid URL.')).toBeTruthy();
      expect(sent).toEqual([]);
    },
  );

  it('puts a duplicate URL on the URL field and keeps the form open', async () => {
    stubApi({ list: ok({ socialLinks: [GITHUB] }), write: DUPLICATE });
    await openTheForm();

    await choose('Platform', 'GitHub');
    type('URL', 'https://github.com/me');
    fireEvent.click(screen.getByRole('button', { name: 'Save link' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(await screen.findByText('That name is already taken.')).toBeTruthy();
    expect(screen.queryByText('New link')).toBeTruthy();
  });
});

describe('editing a link', () => {
  it('loads it into the form and replaces it by id', async () => {
    renderPage();
    await screen.findByText('LinkedIn');

    await openRowMenu('Actions for LinkedIn');
    await chooseMenuItem('Edit');
    await screen.findByText('Edit LinkedIn');

    expect(screen.getByLabelText<HTMLInputElement>('URL').value).toBe(
      'https://linkedin.com/in/me',
    );

    type('URL', 'https://linkedin.com/in/me-again');
    fireEvent.click(screen.getByRole('button', { name: 'Save link' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sent[0]?.method).toBe('PUT');
    expect(sent[0]?.url).toContain(
      '/api/social-links/507f1f77bcf86cd799439012',
    );
    // The position it already had is preserved rather than reset.
    expect(sentBody().order).toBe(1);
  });
});

describe('deleting a link', () => {
  it('asks first, and does nothing when the admin declines', async () => {
    renderPage();
    await screen.findByText('GitHub');

    await openRowMenu('Actions for GitHub');
    await chooseMenuItem('Delete');

    expect(await screen.findByRole('alertdialog')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(sent).toEqual([]);
  });

  it('deletes by id once the admin confirms', async () => {
    renderPage();
    await screen.findByText('GitHub');

    await deleteRow('Actions for GitHub');

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sent[0]?.method).toBe('DELETE');
    expect(sent[0]?.url).toContain(
      '/api/social-links/507f1f77bcf86cd799439011',
    );
  });
});
