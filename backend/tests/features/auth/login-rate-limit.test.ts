import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../src/app.js';
import { stubUserLookup } from './admin.fixture.js';

vi.mock('../../../src/features/auth/user.model.js', () => ({
  UserModel: {
    findOne: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

// Own test file on purpose: the limiter counts per process, so it needs a store
// no other test has already spent.
const app = createApp();

const LOGIN_MAX_ATTEMPTS = 10;

beforeEach(() => {
  stubUserLookup(null);
});

describe('login rate limiting', () => {
  it('blocks further attempts with TOO_MANY_REQUESTS once the limit is reached', async () => {
    for (let attempt = 0; attempt < LOGIN_MAX_ATTEMPTS; attempt += 1) {
      const allowed = await request(app)
        .post('/api/auth/login')
        .send({ email: 'attacker@example.com', password: 'guess' });

      expect(allowed.status).toBe(401);
    }

    const blocked = await request(app)
      .post('/api/auth/login')
      .send({ email: 'attacker@example.com', password: 'guess' });

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ code: 'TOO_MANY_REQUESTS', details: {} });
  });
});
