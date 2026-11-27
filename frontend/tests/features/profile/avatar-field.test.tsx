// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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

const messages = { ...admin, ...site, ...validation, ...responses };

const STORED = '/uploads/profile/avatar-stored.webp';
const UPLOADED = '/uploads/profile/avatar-new.png';

const PROFILE = {
  firstName: { en: 'Yaaza' },
  lastName: { en: 'Ait Bah' },
  headline: { en: 'Full-stack developer' },
  photoUrl: STORED,
  updatedAt: '2026-08-30T10:00:00.000Z',
};

type Reply = { status: number; body: unknown };

const found = (profile: unknown): Reply => ({
  status: 200,
  body: { code: 'SUCCESS', details: { profile } },
});

let sent: { url: string; contentType?: string; body: unknown }[] = [];

/** Routes by path: the profile read, the profile write, and the upload. */
function stubApi({ get, upload }: { get: Reply; upload: Reply }) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      // Every screen with a dropdown reads the option lists, so every stub
      // has to answer for them - the labels come from there now.
      const options = optionsReply(String(url));

      if (options) {
        return Promise.resolve(options);
      }

      const path = String(url);
      const headers = (init?.headers ?? {}) as Record<string, string>;

      if (path.includes('/api/profile/photo')) {
        sent.push({
          url: path,
          contentType: headers['Content-Type'],
          body: init?.body,
        });

        return Promise.resolve({
          ok: upload.status >= 200 && upload.status < 300,
          status: upload.status,
          json: () => Promise.resolve(upload.body),
        });
      }

      const reply =
        init?.method === 'PUT' ? found({ ...PROFILE, photoUrl: STORED }) : get;

      if (init?.method === 'PUT') {
        sent.push({ url: path, body: init.body });
      }

      return Promise.resolve({
        ok: reply.status >= 200 && reply.status < 300,
        status: reply.status,
        json: () => Promise.resolve(reply.body),
      });
    }),
  );
}

const uploaded = (photoUrl: string): Reply => ({
  status: 200,
  body: { code: 'SUCCESS', details: { photoUrl } },
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
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

/**
 * The avatar's own field.
 *
 * The form renders two images now, and both empty states read "No image" -
 * true of each, and ambiguous across the page. Anything asserted about *this*
 * image is scoped here rather than searched for globally.
 */
function avatarField(container: HTMLElement): HTMLElement {
  const field = container.querySelector('#photo-file')?.closest('[data-slot]');

  if (!(field instanceof HTMLElement)) {
    throw new Error('the avatar field is not rendered');
  }

  return field;
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

/** The nth captured request, asserted present so a missing one fails here. */
function request(index: number) {
  const captured = sent[index];
  if (!captured) throw new Error(`no request captured at ${index}`);
  return captured;
}

function chooseFile(label: string, file: File) {
  const input = screen.getByLabelText(label);
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
}

const png = () =>
  new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'holiday snap.png', {
    type: 'image/png',
  });

beforeEach(() => {
  sent = [];
  stubApi({ get: found(PROFILE), upload: uploaded(UPLOADED) });
});

/**
 * Which stored reference the preview is actually showing.
 *
 * Read back out of the optimizer's `url` parameter rather than compared against
 * a whole URL: the rest of it - the width, the quality - is next/image's to
 * choose, and pinning it here would make these tests fail for a change that
 * only ever made the image smaller.
 */
function shownPhoto(): string | null {
  const src = screen.getByAltText('Current profile photo').getAttribute('src');

  if (!src) {
    return null;
  }

  return new URL(src, 'http://localhost:3000').searchParams.get('url');
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the stored photo', () => {
  // The value is relative, so rendering has to add the API host back.
  /**
   * Through the optimizer, at the size the frame draws rather than the size the
   * file was uploaded at. The stored path is the `url` parameter now, not the
   * `src`, because uploads are served same-origin - see `next.config.ts`.
   */
  it('asks the optimizer for the stored photo', async () => {
    const { container } = renderPage();
    await formOf(container);

    expect(shownPhoto()).toBe(STORED);
  });

  it('offers to replace it rather than to choose one', async () => {
    const { container } = renderPage();
    await formOf(container);

    expect(screen.getByLabelText('Replace the photo')).toBeDefined();
    expect(screen.queryByLabelText('Choose a photo')).toBeNull();
  });

  it('offers to choose when the profile has no photo', async () => {
    stubApi({
      get: found({ ...PROFILE, photoUrl: undefined }),
      upload: uploaded(UPLOADED),
    });
    const { container } = renderPage();
    await formOf(container);

    expect(screen.getByLabelText('Choose a photo')).toBeDefined();
    expect(screen.queryByAltText('Current profile photo')).toBeNull();
  });
});

describe('uploading', () => {
  it('sends the file as the body under its own content type', async () => {
    const { container } = renderPage();
    await formOf(container);

    chooseFile('Replace the photo', png());

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(request(0).url).toContain('/api/profile/photo');
    expect(request(0).contentType).toBe('image/png');
    expect(request(0).body).toBeInstanceOf(File);
  });

  it('shows the uploaded image once it is stored', async () => {
    const { container } = renderPage();
    await formOf(container);

    chooseFile('Replace the photo', png());

    await waitFor(() => {
      expect(shownPhoto()).toBe(UPLOADED);
    });
  });

  // Uploading only sets the field; the profile still has to be saved.
  it('saves the uploaded path with the profile', async () => {
    const { container } = renderPage();
    const form = await formOf(container);

    chooseFile('Replace the photo', png());
    await waitFor(() => expect(sent).toHaveLength(1));

    form.requestSubmit();

    await waitFor(() => expect(sent).toHaveLength(2));
    expect(
      JSON.parse(String(request(1).body)) as Record<string, unknown>,
    ).toEqual(expect.objectContaining({ photoUrl: UPLOADED }));
  });

  it('explains a rejected file on the field itself', async () => {
    stubApi({
      get: found(PROFILE),
      upload: {
        status: 422,
        body: {
          code: 'VALIDATION_ERROR',
          details: { photo: 'INVALID_IMAGE' },
        },
      },
    });
    const { container } = renderPage();
    await formOf(container);

    chooseFile('Replace the photo', png());

    expect(
      await screen.findByText('Choose a PNG, JPEG or WebP image.'),
    ).toBeDefined();
    expect(container.textContent).not.toContain('validation.');
  });

  it('reports an oversized file with wording that fits a file', async () => {
    stubApi({
      get: found(PROFILE),
      upload: {
        status: 422,
        body: {
          code: 'VALIDATION_ERROR',
          details: { photo: 'IMAGE_TOO_LARGE' },
        },
      },
    });
    const { container } = renderPage();
    await formOf(container);

    chooseFile('Replace the photo', png());

    expect(
      await screen.findByText('Image must be 2 MB or smaller.'),
    ).toBeDefined();
  });

  // Not a rejected file but a failed request: a different vocabulary.
  it('reports a failed request through the response codes', async () => {
    stubApi({
      get: found(PROFILE),
      upload: { status: 401, body: { code: 'UNAUTHENTICATED', details: {} } },
    });
    const { container } = renderPage();
    await formOf(container);

    chooseFile('Replace the photo', png());

    expect(
      await screen.findByText(
        'Your session has expired. Please sign in again.',
      ),
    ).toBeDefined();
  });

  it('keeps the previous image when the upload fails', async () => {
    stubApi({
      get: found(PROFILE),
      upload: { status: 500, body: { code: 'SERVER_ERROR', details: {} } },
    });
    const { container } = renderPage();
    await formOf(container);

    chooseFile('Replace the photo', png());
    await screen.findByRole('alert');

    expect(shownPhoto()).toBe(STORED);
  });
});

// A stored reference can outlive its file: a swapped volume, a manual delete.
describe('a photo whose file has gone', () => {
  it('falls back to the empty state instead of a broken image', async () => {
    const { container } = renderPage();
    await formOf(container);

    const image = screen.getByAltText('Current profile photo');
    fireEvent.error(image);

    await waitFor(() => {
      expect(screen.queryByAltText('Current profile photo')).toBeNull();
    });

    // Says what is true: a photo is stored, it just cannot be shown.
    const avatar = within(avatarField(container));
    expect(avatar.getByText('Image unavailable')).toBeDefined();
    expect(avatar.queryByText('No image')).toBeNull();
    expect(screen.getByLabelText('Replace the photo')).toBeDefined();
  });

  // Precisely when it matters most: the admin has to be able to clear it.
  it('still offers to remove the dangling reference', async () => {
    const { container } = renderPage();
    const form = await formOf(container);

    fireEvent.error(screen.getByAltText('Current profile photo'));
    await waitFor(() => {
      expect(screen.queryByAltText('Current profile photo')).toBeNull();
    });

    fireEvent.click(screen.getByText('Remove the photo'));
    form.requestSubmit();

    await waitFor(() => expect(sent).toHaveLength(1));
    const body = JSON.parse(String(request(0).body)) as Record<string, unknown>;
    expect(Object.keys(body)).not.toContain('photoUrl');
  });
});

describe('removing', () => {
  it('clears the preview and drops the field from the saved profile', async () => {
    const { container } = renderPage();
    const form = await formOf(container);

    fireEvent.click(screen.getByText('Remove the photo'));

    expect(screen.queryByAltText('Current profile photo')).toBeNull();
    expect(screen.getByLabelText('Choose a photo')).toBeDefined();

    form.requestSubmit();

    await waitFor(() => expect(sent).toHaveLength(1));
    const body = JSON.parse(String(request(0).body)) as Record<string, unknown>;
    expect(Object.keys(body)).not.toContain('photoUrl');
  });

  it('is offered only while there is an image', async () => {
    stubApi({
      get: found({ ...PROFILE, photoUrl: undefined }),
      upload: uploaded(UPLOADED),
    });
    const { container } = renderPage();
    await formOf(container);

    expect(screen.queryByText('Remove the photo')).toBeNull();
  });
});
