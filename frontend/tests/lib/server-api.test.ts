import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PUBLIC_REVALIDATE_SECONDS,
  readFromApi,
  storedFileExists,
} from '../../src/lib/server-api';

const OK = {
  ok: true,
  status: 200,
  json: () =>
    Promise.resolve({ code: 'SUCCESS', details: { profile: { id: 'p' } } }),
};

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('reading the API from the server', () => {
  it('answers the details of a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(OK)),
    );

    expect(await readFromApi('/api/profile')).toEqual({ profile: { id: 'p' } });
  });

  /**
   * The property every caller depends on: a public page renders whatever it can
   * say without the API rather than answering 500. A crawler arriving during a
   * restart should read something true, not an error page.
   */
  it('answers null when the API cannot be reached, and does not throw', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('ECONNREFUSED'))),
    );

    await expect(readFromApi('/api/profile')).resolves.toBeNull();
  });

  it('answers null for a failing status rather than parsing it', async () => {
    const json = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 503, json })),
    );

    expect(await readFromApi('/api/profile')).toBeNull();
    expect(json).not.toHaveBeenCalled();
  });

  // A 200 whose body is not the shape we expect is still not a crash.
  it('answers null when the envelope carries no details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
        }),
      ),
    );

    expect(await readFromApi('/api/profile')).toBeNull();
  });

  /**
   * The window reaches the request. The value itself is deliberately zero
   * outside production - a stale public page in development reads as a failed
   * save - so this asserts the wiring rather than the number.
   */
  it('reads through the configured revalidation window', async () => {
    const fetcher = vi.fn(() => Promise.resolve(OK));
    vi.stubGlobal('fetch', fetcher);

    await readFromApi('/api/profile');

    const [, init] = fetcher.mock.calls[0] as unknown as [
      string,
      { next?: { revalidate?: number } },
    ];
    expect(init.next?.revalidate).toBe(PUBLIC_REVALIDATE_SECONDS);
  });

  it('caches nothing outside production', () => {
    expect(PUBLIC_REVALIDATE_SECONDS).toBe(0);
  });
});

describe('whether a stored file answers', () => {
  it('asks with HEAD, and answers by the status', async () => {
    const fetch = vi.fn((_url: string, init?: RequestInit) =>
      Promise.resolve({ ok: init?.method === 'HEAD', status: 200 }),
    );

    vi.stubGlobal('fetch', fetch);

    expect(await storedFileExists('/uploads/resume/cv.pdf')).toBe(true);
    expect(fetch.mock.calls[0]?.[0]).toMatch(/\/uploads\/resume\/cv\.pdf$/);
  });

  it('answers false for a missing file, and for an API that cannot be reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 404 })),
    );
    expect(await storedFileExists('/uploads/resume/gone.pdf')).toBe(false);

    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('ECONNREFUSED'))),
    );
    expect(await storedFileExists('/uploads/resume/cv.pdf')).toBe(false);
  });
});
