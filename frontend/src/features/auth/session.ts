import { apiFetch } from '@/lib/api-client';

import type { LoginInput } from './login-schema';

export type AdminUser = {
  id: string;
  email: string;
  role: 'admin';
};

/** `null` means "not logged in" - an answer, not an error. */
/** Who is signed in, if anyone; `/session` answers "nobody" without a 401. */
export async function fetchSession(): Promise<AdminUser | null> {
  const { user } = await apiFetch<{ user: AdminUser | null }>(
    '/api/auth/session',
  );

  return user;
}

export async function login(credentials: LoginInput): Promise<AdminUser> {
  const { user } = await apiFetch<{ user: AdminUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });

  return user;
}

export async function logout(): Promise<void> {
  await apiFetch('/api/auth/logout', { method: 'POST' });
}
