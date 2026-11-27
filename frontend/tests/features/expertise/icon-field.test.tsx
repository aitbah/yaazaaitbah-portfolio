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
import TechnologiesPage from '../../../src/app/[locale]/admin/(protected)/technologies/page';
import { optionsReply } from '../../support/options';
import { localizedLabel } from '../../support/localized-label';
import { ToastViewport } from '../../../src/components/ui/toast';

const messages = { ...admin, ...site, ...validation, ...responses };

/** How many logos are drawn before a search narrows them down. */
const INITIAL_LIMIT = 60;

type Reply = { status: number; body: unknown };

const ok = (details: unknown): Reply => ({
  status: 200,
  body: { code: 'SUCCESS', details },
});

let sent: { url: string; body: string | null }[] = [];

function stubApi(upload: Reply = ok({ iconUrl: '/uploads/skill/a.png' })) {
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

      if (method === 'GET') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(ok({ technologies: [] }).body),
        });
      }

      sent.push({
        url,
        body: typeof init?.body === 'string' ? init.body : null,
      });

      const reply = url.includes('/icon') ? upload : ok({ technology: {} });

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

  return render(<TechnologiesPage />, { wrapper: Wrapper });
}

async function openTheForm() {
  renderPage();
  // Two offer it on an empty list: the page header and the empty state.
  const [add] = await screen.findAllByRole('button', {
    name: 'Add a technology',
  });
  fireEvent.click(add!);
  await screen.findByText('New technology');
}

function search(query: string) {
  fireEvent.change(screen.getByLabelText('Search logos'), {
    target: { value: query },
  });
}

/** The grid's buttons, which are the only ones carrying a brand as their name. */
function logoGrid() {
  return screen
    .getAllByRole('button')
    .filter((button) => button.getAttribute('aria-pressed') !== null);
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

describe('the preset picker', () => {
  /**
   * Drawing all 241 on every keystroke is slow enough to feel like the input is
   * lagging. A first page is enough to browse and two letters reaches anything,
   * so the cap is a deliberate decision rather than an accident of the data.
   */
  it('draws a first page rather than the whole set', async () => {
    await openTheForm();

    expect(logoGrid()).toHaveLength(INITIAL_LIMIT);
  });

  it('finds a brand by name', async () => {
    await openTheForm();

    search('laravel');

    await waitFor(() => expect(logoGrid()).toHaveLength(1));
    expect(screen.getByRole('button', { name: 'Laravel' })).toBeTruthy();
  });

  // Upload is the way out, so the empty result has to point at it.
  it('says so when nothing matches', async () => {
    await openTheForm();

    search('nothing-is-called-this');

    expect(
      await screen.findByText(/No logo matches .*nothing-is-called-this/),
    ).toBeTruthy();
  });

  /**
   * The security contract in one assertion: choosing a preset stores its
   * **slug**, never markup. That is what lets the admin show vector logos while
   * `docs/SECURITY.md` keeps refusing SVG uploads.
   */
  it('stores the chosen logo as a slug, never as markup', async () => {
    await openTheForm();

    search('laravel');
    fireEvent.click(await screen.findByRole('button', { name: 'Laravel' }));

    fireEvent.change(screen.getByLabelText(localizedLabel('Name')), {
      target: { value: 'Laravel' },
    });
    fireEvent.change(screen.getByLabelText('Level'), {
      target: { value: '70' },
    });
    fireEvent.keyDown(screen.getByRole('combobox', { name: /Category/ }), {
      key: 'Enter',
    });
    fireEvent.click(await screen.findByRole('option', { name: 'Backend' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sentBody().icon).toEqual({ kind: 'preset', value: 'laravel' });
  });

  it('shows which logo is chosen, and lets it be cleared', async () => {
    await openTheForm();

    search('laravel');
    fireEvent.click(await screen.findByRole('button', { name: 'Laravel' }));

    expect(screen.getByText('Laravel logo')).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: 'Laravel' })
        .getAttribute('aria-pressed'),
    ).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(screen.getAllByText('No logo').length).toBeGreaterThan(0);
  });
});
