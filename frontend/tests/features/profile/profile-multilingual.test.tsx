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
import ProfilePage from '../../../src/app/[locale]/admin/(protected)/profile/page';
import { optionsReply } from '../../support/options';
import { ToastViewport } from '../../../src/components/ui/toast';

/**
 * A *third* locale exists only here. The site ships English and French; this
 * mock adds Arabic, so the claim under test stays the one it was written for -
 * the form grows with `routing.locales` alone, with no other edit - rather than
 * re-testing the configuration that happens to be shipped.
 *
 * Arabic on purpose: it is the one that also exercises `localeDirection`.
 */
vi.mock('@/i18n/routing', () => ({
  routing: { locales: ['en', 'ar'], defaultLocale: 'en' },
}));

const messages = { ...admin, ...site, ...validation, ...responses };

const BILINGUAL = {
  firstName: { en: 'Yaaza', ar: 'ياعزى' },
  lastName: { en: 'Ait Bah', ar: 'أيت بها' },
  headline: { en: 'Full-stack developer', ar: 'مطور ويب' },
  updatedAt: '2026-08-30T10:00:00.000Z',
};

type Reply = { status: number; body: unknown };

const found = (profile: unknown): Reply => ({
  status: 200,
  body: { code: 'SUCCESS', details: { profile } },
});
const NOT_FOUND: Reply = {
  status: 404,
  body: { code: 'NOT_FOUND', details: {} },
};

let sent: string[] = [];

function stubApi(get: Reply) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      // Every screen with a dropdown reads the option lists, so every stub
      // has to answer for them - the labels come from there now.
      const options = optionsReply(String(url));

      if (options) {
        return Promise.resolve(options);
      }

      const isWrite = init?.method === 'PUT';

      if (isWrite && typeof init?.body === 'string') {
        sent.push(init.body);
      }

      const reply = isWrite ? found(BILINGUAL) : get;

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

  return render(<ProfilePage />, { wrapper: Wrapper });
}

async function formOf(container: HTMLElement) {
  // The profile now opens read-only, so the form is behind an explicit action:
  // "Edit profile" over a saved one, "Create profile" over an empty page.
  fireEvent.click(
    await screen.findByRole('button', { name: /^(Edit|Create) profile$/ }),
  );

  return waitFor(() => {
    const form = container.querySelector('form');
    if (!form) throw new Error('form not rendered yet');
    return form;
  });
}

function input(label: string) {
  return screen.getByLabelText<HTMLInputElement>(label);
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function sentBody(): Record<string, unknown> {
  const body = sent[0];
  if (!body) throw new Error('no request was sent');

  return JSON.parse(body) as Record<string, unknown>;
}

beforeEach(() => {
  sent = [];
  stubApi(found(BILINGUAL));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Every language control on the form; the choice they share is the form's. */
function languageTabs(language: RegExp) {
  return screen.getAllByRole('radio', { name: language });
}

/**
 * Clicks one field's language control.
 *
 * Which one does not matter, and that is the point being relied on: the choice
 * belongs to the form, so any of them moves all of them.
 */
function switchTo(language: RegExp) {
  const [first] = languageTabs(language);

  if (!first) {
    throw new Error(`no control offers ${String(language)}`);
  }

  fireEvent.click(first);
}

const ENGLISH = /^English/;
const ARABIC = /^Arabic/;

describe('a second configured locale', () => {
  it('shows one input per field, in the launch locale', async () => {
    const { container } = renderPage();
    await formOf(container);

    expect(input('First name (English)').value).toBe('Yaaza');
    // Not two boxes side by side. The form is as long as the number of things
    // it is about, and the other language is one click away.
    expect(screen.queryByLabelText('First name (Arabic)')).toBeNull();
  });

  it('shows the other translation once the language is switched', async () => {
    const { container } = renderPage();
    await formOf(container);

    switchTo(ARABIC);

    expect(input('First name (Arabic)').value).toBe('ياعزى');
    expect(input('Headline (Arabic)').value).toBe('مطور ويب');
  });

  /**
   * The reason the choice is the form's rather than each field's.
   *
   * Per-field tabs would let the headline sit in English while the biography
   * sits in Arabic, and then nothing on screen says which language the form is
   * in - which is one unnoticed tab away from typing a sentence into the wrong
   * language's field.
   */
  it('moves every field, not only the one that was clicked', async () => {
    const { container } = renderPage();
    await formOf(container);

    switchTo(ARABIC);

    expect(screen.queryByLabelText('Headline (English)')).toBeNull();
    expect(input('Headline (Arabic)').value).toBe('مطور ويب');
  });

  it('keeps what was typed in a language switched away from', async () => {
    const { container } = renderPage();
    await formOf(container);

    type('First name (English)', 'Written in English');
    switchTo(ARABIC);
    type('First name (Arabic)', 'مكتوب بالعربية');
    switchTo(ENGLISH);

    expect(input('First name (English)').value).toBe('Written in English');
  });

  // photoUrl is a single reference, not text to translate.
  it('leaves the non-localized field alone', async () => {
    const { container } = renderPage();
    await formOf(container);

    expect(screen.getByLabelText('Choose a photo')).toBeDefined();
    expect(screen.queryByLabelText('Choose a photo (English)')).toBeNull();
  });

  // Only the launch locale is required; the others are translations.
  it('marks the launch locale required and the others not', async () => {
    const { container } = renderPage();
    await formOf(container);

    expect(input('First name (English)').required).toBe(true);

    switchTo(ARABIC);

    expect(input('First name (Arabic)').required).toBe(false);
  });

  it('sends every locale that was filled in', async () => {
    const { container } = renderPage();
    const form = await formOf(container);

    form.requestSubmit();

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sentBody().firstName).toEqual({ en: 'Yaaza', ar: 'ياعزى' });
  });

  // A blank locale means "not translated yet"; sending "" would be rejected
  // and would block saving a field the admin has not translated.
  it('drops a locale left blank instead of sending an empty string', async () => {
    stubApi(NOT_FOUND);
    const { container } = renderPage();
    const form = await formOf(container);

    type('First name (English)', 'Yaaza');
    type('Last name (English)', 'Ait Bah');
    type('Headline (English)', 'Full-stack developer');
    switchTo(ARABIC);
    type('Headline (Arabic)', 'مطور ويب');
    form.requestSubmit();

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sentBody().firstName).toEqual({ en: 'Yaaza' });
    expect(sentBody().headline).toEqual({
      en: 'Full-stack developer',
      ar: 'مطور ويب',
    });
  });

  /**
   * The thing that decides whether one input at a time is an improvement or a
   * trap.
   *
   * The launch locale is blank, the form refuses to save, and the reason is on
   * a language that is not on screen. Without the switch the admin presses Save
   * and nothing happens - no message, no field, no explanation. The row of
   * inputs this replaced never had that failure mode, so earning the change
   * means not introducing it.
   */
  it('switches to the language it is refusing to save', async () => {
    stubApi(NOT_FOUND);
    const { container } = renderPage();
    const form = await formOf(container);

    type('Last name (English)', 'Ait Bah');
    type('Headline (English)', 'Full-stack developer');
    switchTo(ARABIC);
    type('First name (Arabic)', 'ياعزى');

    // Submitted from Arabic, with the missing value in English.
    form.requestSubmit();

    await waitFor(() =>
      expect(input('First name (English)').getAttribute('aria-invalid')).toBe(
        'true',
      ),
    );
    expect(screen.getByText('This field is required.')).toBeDefined();
    expect(sent).toHaveLength(0);
  });

  /**
   * And the marker, for the case the switch cannot cover: two languages both
   * invalid, only one of them on screen.
   *
   * It marks the field that is invalid rather than every field on the form -
   * a marker on all of them names nothing and is worth no more than none.
   */
  it('marks the language a field is invalid in, and only that field', async () => {
    stubApi(NOT_FOUND);
    const { container } = renderPage();
    const form = await formOf(container);

    type('Last name (English)', 'Ait Bah');
    type('Headline (English)', 'Full-stack developer');
    form.requestSubmit();

    await waitFor(() =>
      expect(input('First name (English)').getAttribute('aria-invalid')).toBe(
        'true',
      ),
    );
    expect(languageTabs(/^English, has an error$/)).toHaveLength(1);
  });

  // The optional field follows the same rule once it carries anything at all.
  it('requires the launch locale for an optional field that is filled', async () => {
    stubApi(NOT_FOUND);
    const { container } = renderPage();
    const form = await formOf(container);

    type('First name (English)', 'Yaaza');
    type('Last name (English)', 'Ait Bah');
    type('Headline (English)', 'Full-stack developer');
    switchTo(ARABIC);
    type('Bio (Arabic)', 'نبذة');
    form.requestSubmit();

    await waitFor(() => {
      expect(input('Bio (English)').getAttribute('aria-invalid')).toBe('true');
    });
    expect(sent).toHaveLength(0);
  });
});
