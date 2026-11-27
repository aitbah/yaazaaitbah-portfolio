import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';

const app = createApp();

describe('application skeleton', () => {
  it('answers unmatched routes with the centralized NOT_FOUND format', async () => {
    const response = await request(app).get('/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ code: 'NOT_FOUND', details: {} });
  });

  it('applies the same format under the /api prefix', async () => {
    const response = await request(app).get('/api/unknown');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
  });

  /**
   * The body parser throws its own 4xx errors before any route runs. They were
   * answered 500 and logged as unhandled failures - a client's typo reported as
   * the server breaking.
   */
  it('answers a malformed JSON body as a validation error, not a server error', async () => {
    const response = await request(app)
      .put('/api/profile')
      .set('Content-Type', 'application/json')
      .send('{"firstName": ');

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      code: 'VALIDATION_ERROR',
      details: { body: 'INVALID_VALUE' },
    });
  });

  it('answers a JSON body over the limit as too big, not a server error', async () => {
    const response = await request(app)
      .put('/api/profile')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ bio: 'a'.repeat(200_000) }));

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      code: 'VALIDATION_ERROR',
      details: { body: 'TOO_BIG' },
    });
  });

  /**
   * The router decodes a route parameter before any handler runs, and throws a
   * 400 `URIError` when it cannot. A path that cannot be decoded names nothing,
   * so it is answered like any other path that names nothing.
   */
  it('answers a path it cannot decode as not found, not a server error', async () => {
    const response = await request(app).get('/api/projects/%E0%A4%A');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ code: 'NOT_FOUND', details: {} });
  });

  it('sets security headers and hides the server technology', async () => {
    const response = await request(app).get('/');

    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
});
