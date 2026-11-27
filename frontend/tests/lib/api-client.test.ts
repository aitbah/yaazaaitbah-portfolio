import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError, apiFetch } from '../../src/lib/api-client';

function mockResponse(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

function mockUnreadableResponse(status: number) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.reject(new SyntaxError('Unexpected token <')),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('unwraps the details of a successful envelope', async () => {
    vi.stubGlobal(
      'fetch',
      mockResponse(200, { code: 'SUCCESS', details: { user: { id: '1' } } }),
    );

    await expect(apiFetch('/api/auth/me')).resolves.toEqual({
      user: { id: '1' },
    });
  });

  it('throws the backend code so callers can map it to a message', async () => {
    vi.stubGlobal(
      'fetch',
      mockResponse(401, { code: 'INVALID_CREDENTIALS', details: {} }),
    );

    await expect(apiFetch('/api/auth/login')).rejects.toBeInstanceOf(
      ApiRequestError,
    );
    await expect(apiFetch('/api/auth/login')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  // A gateway between the browser and the API answers with HTML, not the envelope.
  it('turns an unreadable error body into UNKNOWN', async () => {
    vi.stubGlobal('fetch', mockUnreadableResponse(502));

    await expect(apiFetch('/api/auth/me')).rejects.toMatchObject({
      code: 'UNKNOWN',
    });
  });

  it('fails on a 2xx whose body is not the envelope', async () => {
    vi.stubGlobal('fetch', mockUnreadableResponse(200));

    await expect(apiFetch('/api/auth/me')).rejects.toBeInstanceOf(
      ApiRequestError,
    );
  });

  // The session is an HttpOnly cookie: without this the browser never sends it.
  it('always sends credentials', async () => {
    const fetchMock = mockResponse(200, { code: 'SUCCESS', details: {} });
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/auth/me');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/me'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });
});
