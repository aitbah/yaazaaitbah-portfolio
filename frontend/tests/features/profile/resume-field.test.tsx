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
import { localizedLabel } from '../../support/localized-label';
import { ToastViewport } from '../../../src/components/ui/toast';

const messages = { ...admin, ...site, ...validation, ...responses };

const PROFILE = {
  firstName: { en: 'Yaaza' },
  lastName: { en: 'Ait Bah' },
  headline: { en: 'Developer' },
  updatedAt: '2026-09-04T10:00:00.000Z',
};

const STORED = '/uploads/resume/cv-abc.pdf';

type Reply = { status: number; body: unknown };

const ok = (details: unknown): Reply => ({
  status: 200,
  body: { code: 'SUCCESS', details },
});

const REJECTED: Reply = {
  status: 422,
  body: { code: 'VALIDATION_ERROR', details: { resume: 'INVALID_DOCUMENT' } },
};

/** Every write, so a test can assert what actually went over the wire. */
let sent: { url: string; type: string; body: unknown }[] = [];

function stubApi({
  profile = ok({ profile: PROFILE }),
  upload = ok({ resumeUrl: STORED }),
} = {}) {
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
        const headers = (init?.headers ?? {}) as Record<string, string>;

        sent.push({
          url,
          type: headers['Content-Type'] ?? '',
          body: init?.body,
        });
      }

      const reply =
        method === 'GET'
          ? profile
          : url.includes('/resume')
            ? upload
            : ok({ profile: PROFILE });

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

async function openTheEditor() {
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Edit profile' }));
  await screen.findByLabelText(localizedLabel('First name'));
}

function pdf(name = 'cv.pdf') {
  return new File(['%PDF-1.7'], name, { type: 'application/pdf' });
}

beforeEach(() => {
  sent = [];
  stubApi();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the resume control', () => {
  it('says there is none before one is chosen', async () => {
    await openTheEditor();

    // One control, showing the language the form is on - so the empty state
    // is said once however many languages the site ships.
    expect(screen.getAllByText('No resume yet').length).toBe(1);
    expect(screen.getByLabelText(localizedLabel('Choose a PDF'))).toBeTruthy();
  });

  /**
   * Not an image control with a flag: a PDF has no thumbnail without a
   * renderer, and a renderer is a dependency and an attack surface for a file
   * this application deliberately never opens.
   */
  it('previews nothing, because there is nothing to preview', async () => {
    stubApi({
      profile: ok({ profile: { ...PROFILE, resume: { en: STORED } } }),
    });
    await openTheEditor();

    expect(screen.queryByAltText(/resume/i)).toBeNull();
    expect(screen.getByRole('link', { name: 'Resume (PDF)' })).toBeTruthy();
  });

  it('uploads on selection and offers to replace it afterwards', async () => {
    await openTheEditor();

    fireEvent.change(screen.getByLabelText(localizedLabel('Choose a PDF')), {
      target: { files: [pdf()] },
    });

    await waitFor(() => expect(sent.length).toBe(1));

    expect(sent[0]?.url).toContain('/api/profile/resume');
    // The whole body, so no client filename is ever sent.
    expect(sent[0]?.type).toBe('application/pdf');
    expect(
      await screen.findByLabelText(localizedLabel('Replace the PDF')),
    ).toBeTruthy();
  });

  it('saves the stored path with the profile, per locale', async () => {
    await openTheEditor();

    fireEvent.change(screen.getByLabelText(localizedLabel('Choose a PDF')), {
      target: { files: [pdf()] },
    });
    await screen.findByLabelText(localizedLabel('Replace the PDF'));

    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(sent.length).toBe(2));

    const body = JSON.parse(String(sent[1]?.body)) as Record<string, unknown>;
    expect(body.resume).toEqual({ en: STORED });
  });

  it('explains a rejected file on the field itself', async () => {
    stubApi({ upload: REJECTED });
    await openTheEditor();

    fireEvent.change(screen.getByLabelText(localizedLabel('Choose a PDF')), {
      target: { files: [pdf('notes.txt')] },
    });

    expect(await screen.findByText('Choose a PDF file.')).toBeTruthy();
    // And nothing is stored: the control still offers to choose one.
    expect(screen.getByLabelText(localizedLabel('Choose a PDF'))).toBeTruthy();
  });

  /**
   * Removing clears the field; the file is deleted when the form is saved, and
   * `PUT` replaces, so an absent field is what clears the stored one.
   */
  it('drops the field from the saved profile when removed', async () => {
    stubApi({
      profile: ok({ profile: { ...PROFILE, resume: { en: STORED } } }),
    });
    await openTheEditor();

    fireEvent.click(
      // Matched by prefix: the language is in the name but the separator
      // between the two is whitespace between nodes, which every
      // implementation of the naming algorithm collapses differently.
      screen.getByRole('button', { name: /^Remove the resume/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(sent.length).toBe(1));

    const body = JSON.parse(String(sent[0]?.body)) as Record<string, unknown>;
    expect(body).not.toHaveProperty('resume');
  });
});
