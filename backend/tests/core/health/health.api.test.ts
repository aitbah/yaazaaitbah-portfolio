import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../src/app.js';
import { isDatabaseConnected } from '../../../src/core/database/connection.js';

// Hoisted so the assertions can name the stub directly rather than reaching
// through `ProfileModel`, which reads as an unbound method.
const { findProfile } = vi.hoisted(() => ({ findProfile: vi.fn() }));

vi.mock('../../../src/core/database/connection.js', () => ({
  isDatabaseConnected: vi.fn(),
}));

// Empty, the way a freshly started stack is. The deadlock this endpoint exists
// to break was a readiness gate that waited for a profile nobody had written.
vi.mock('../../../src/features/profile/profile.model.js', () => ({
  ProfileModel: { findOne: findProfile },
  SINGLETON_KEY: 'profile',
}));

const app = createApp();
const connected = vi.mocked(isDatabaseConnected);

/** supertest types the body as `any`; narrow it in one place. */
function bodyOf(response: request.Response): {
  code: string;
  details: Record<string, unknown>;
} {
  return response.body as { code: string; details: Record<string, unknown> };
}

describe('the health endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connected.mockReturnValue(true);
    findProfile.mockResolvedValue(null);
  });

  it('answers a database that holds nothing', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(bodyOf(response).code).toBe('SUCCESS');
  });

  /**
   * The regression, stated as the two answers that used to be one.
   *
   * `/api/profile` is what the pipeline used to poll, and on an empty database
   * it is a 404 forever - the step that writes a profile runs after the wait.
   * Both routes are asked here, in one test, because the bug was never in
   * either of them alone: it was in the belief that they answer the same
   * question. If someone ever points a readiness gate back at content, this is
   * the test that has to be argued with.
   */
  it('is 200 on the same empty database that leaves the profile a 404', async () => {
    const health = await request(app).get('/api/health');
    const profile = await request(app).get('/api/profile');

    expect(health.status).toBe(200);
    expect(profile.status).toBe(404);
  });

  it('reads no content to answer', async () => {
    await request(app).get('/api/health');

    expect(findProfile).not.toHaveBeenCalled();
  });

  it('reports 503 when the database has gone away', async () => {
    connected.mockReturnValue(false);

    const response = await request(app).get('/api/health');

    // Not 500: the instance is up and the answer may differ in a second. A
    // waiting gate keeps waiting instead of seeding a database that is not
    // there.
    expect(response.status).toBe(503);
    expect(bodyOf(response).code).toBe('SERVICE_UNAVAILABLE');
  });

  it('needs no session', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
  });

  it('describes nothing about the deployment', async () => {
    const response = await request(app).get('/api/health');

    // No version, no uptime, no database name: an unauthenticated endpoint that
    // describes its host helps only whoever is enumerating it.
    expect(bodyOf(response).details).toEqual({});
  });
});
