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
import { MAX_GALLERY_IMAGES } from '@portfolio/shared';

import admin from '../../../messages/en/admin.json';
import site from '../../../messages/en/site.json';
import responses from '../../../messages/en/responses.json';
import validation from '../../../messages/en/validation.json';
import ProjectsPage from '../../../src/app/[locale]/admin/(protected)/projects/page';
import { localizedLabel } from '../../support/localized-label';
import { ToastViewport } from '../../../src/components/ui/toast';

const messages = { ...admin, ...site, ...validation, ...responses };

const TYPESCRIPT = {
  id: '507f1f77bcf86cd799439011',
  name: { en: 'TypeScript' },
  category: 'frontend',
  level: 80,
  order: 0,
  updatedAt: '2026-09-02T10:00:00.000Z',
};

type Reply = { status: number; body: unknown };

const ok = (details: unknown): Reply => ({
  status: 200,
  body: { code: 'SUCCESS', details },
});

const REJECTED: Reply = {
  status: 422,
  body: { code: 'VALIDATION_ERROR', details: { gallery: 'IMAGE_TOO_LARGE' } },
};

/** Every upload that reached the endpoint, in order. */
let uploads: string[] = [];

/**
 * `uploadReplies` is consumed one per upload, so a test can make the second
 * file fail and leave the others alone. Anything left over repeats the last.
 */
function stubApi(uploadReplies: Reply[] = []) {
  let index = 0;

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';

      if (method === 'GET') {
        const body = url.includes('/api/skills')
          ? ok({ skills: [TYPESCRIPT] })
          : ok({ projects: [] });

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(body.body),
        });
      }

      if (url.includes('/api/projects/gallery')) {
        const position = index;
        index += 1;
        uploads.push(url);

        const reply =
          uploadReplies[position] ??
          uploadReplies.at(-1) ??
          ok({ imageUrl: `/uploads/project/g-${position}.png` });

        return Promise.resolve({
          ok: reply.status >= 200 && reply.status < 300,
          status: reply.status,
          json: () => Promise.resolve(reply.body),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(ok({ project: {} }).body),
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

  return render(<ProjectsPage />, { wrapper: Wrapper });
}

function png(name: string) {
  return new File(['bytes'], name, { type: 'image/png' });
}

async function openTheEditor() {
  renderPage();
  // Two offer it on an empty list: the page header and the empty state.
  const [add] = await screen.findAllByRole('button', {
    name: 'Add a project',
  });
  fireEvent.click(add!);
  await screen.findByText('New project');
}

function choose(files: File[]) {
  fireEvent.change(screen.getByLabelText('Add images'), { target: { files } });
}

beforeEach(() => {
  uploads = [];
  stubApi();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('choosing several files at once', () => {
  /**
   * The regression this file exists for. React Query fires the callbacks passed
   * to `mutate` only for the *last* call, so a loop of three uploads appended
   * one entry - two files stored on disk that nothing referenced, and no error
   * anywhere. Only `mutateAsync` returns per file.
   */
  it('keeps every file, not just the last', async () => {
    await openTheEditor();

    choose([png('a.png'), png('b.png'), png('c.png')]);

    await waitFor(() => expect(uploads).toHaveLength(3));

    expect(await screen.findByText('Image 1 of 3')).toBeTruthy();
    expect(screen.getByText('Image 2 of 3')).toBeTruthy();
    expect(screen.getByText('Image 3 of 3')).toBeTruthy();
  });

  it('gives each entry its own description field', async () => {
    await openTheEditor();

    choose([png('a.png'), png('b.png')]);

    await screen.findByText('Image 2 of 2');

    // "Description" alone is the project's own field, the cover's, and every
    // entry's - each has to say which image it belongs to.
    expect(
      screen.getByLabelText(localizedLabel('Description of image 1'), {
        exact: true,
      }),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(localizedLabel('Description of image 2'), {
        exact: true,
      }),
    ).toBeTruthy();
  });

  /**
   * The gallery was the last place rendering one input per language: six
   * screenshots meant twelve description boxes.
   *
   * It follows the form's editing language now, which is the point of that
   * language being the form's - a caption cannot end up in French while the
   * project's title beside it is in English.
   */
  it("gives each entry one description, in the form's language", async () => {
    await openTheEditor();

    choose([png('a.png'), png('b.png')]);

    await screen.findByText('Image 2 of 2');

    expect(
      screen.queryByLabelText(localizedLabel('Description of image 1', 'fr'), {
        exact: true,
      }),
    ).toBeNull();

    // Any language control on the form moves all of them, including the
    // project's own fields - so this reaches for the first one there is.
    const [french] = screen.getAllByRole('radio', { name: 'French' });
    fireEvent.click(french!);

    expect(
      screen.getByLabelText(localizedLabel('Description of image 2', 'fr'), {
        exact: true,
      }),
    ).toBeTruthy();
    // The project's own field moved with it.
    expect(
      screen.getByLabelText(localizedLabel('Title', 'fr'), { exact: true }),
    ).toBeTruthy();
  });

  // A gallery of twelve arriving at once is exactly the burst the endpoint's
  // rate limit exists for.
  it('uploads them one at a time', async () => {
    await openTheEditor();

    choose([png('a.png'), png('b.png')]);

    await waitFor(() => expect(uploads).toHaveLength(2));
  });
});

describe('when a file is refused', () => {
  it('reports it without dropping the rest of the selection', async () => {
    stubApi([
      ok({ imageUrl: '/uploads/project/g-0.png' }),
      REJECTED,
      ok({ imageUrl: '/uploads/project/g-2.png' }),
    ]);
    await openTheEditor();

    choose([png('a.png'), png('too-big.png'), png('c.png')]);

    await waitFor(() => expect(uploads).toHaveLength(3));

    // The two that were accepted are kept.
    expect(await screen.findByText('Image 2 of 2')).toBeTruthy();
    // And the one that was not says why, in words.
    expect(screen.getByText('Image must be 2 MB or smaller.')).toBeTruthy();
  });
});

describe('the cap', () => {
  it('never uploads more than the gallery can hold', async () => {
    await openTheEditor();

    choose(
      Array.from({ length: MAX_GALLERY_IMAGES + 3 }, (_, index) =>
        png(`${index}.png`),
      ),
    );

    await waitFor(() => expect(uploads).toHaveLength(MAX_GALLERY_IMAGES));

    expect(
      await screen.findByText(
        `Image ${MAX_GALLERY_IMAGES} of ${MAX_GALLERY_IMAGES}`,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('That is the maximum. Remove one to add another.'),
    ).toBeTruthy();
  });
});

describe('ordering', () => {
  /**
   * Position in the list *is* the display order - there is no order field.
   * Moving an entry has to carry its description with it, or the images and
   * their alt text drift apart silently.
   */
  it('moves an image and its description together', async () => {
    await openTheEditor();

    choose([png('a.png'), png('b.png')]);
    await screen.findByText('Image 2 of 2');

    fireEvent.change(
      screen.getByLabelText(localizedLabel('Description of image 1'), {
        exact: true,
      }),
      { target: { value: 'the first' } },
    );
    fireEvent.change(
      screen.getByLabelText(localizedLabel('Description of image 2'), {
        exact: true,
      }),
      { target: { value: 'the second' } },
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Move image 2 earlier' }),
    );

    await waitFor(() => {
      expect(
        screen.getByLabelText<HTMLInputElement>(
          localizedLabel('Description of image 1'),
          {
            exact: true,
          },
        ).value,
      ).toBe('the second');
    });
  });

  it('removes an entry', async () => {
    await openTheEditor();

    choose([png('a.png'), png('b.png')]);
    await screen.findByText('Image 2 of 2');

    fireEvent.click(screen.getByRole('button', { name: 'Remove image 1' }));

    expect(await screen.findByText('Image 1 of 1')).toBeTruthy();
  });
});
