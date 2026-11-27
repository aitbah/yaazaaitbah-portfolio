import { apiFetch } from '@/lib/api-client';

import type { AdminUser } from '@/features/auth/session';

import type { EmailFormInput, PasswordFormInput } from './account-schema';

/**
 * Changes the password - see docs/api-endpoints/auth-api.md.
 *
 * The confirmation is dropped here rather than by the caller: it is a client
 * check, the API has no field for it, and a form that holds one would otherwise
 * send it to an endpoint that does not want it.
 */
export async function changePassword({
  currentPassword,
  newPassword,
}: PasswordFormInput): Promise<void> {
  await apiFetch('/api/auth/password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

/**
 * Changes the sign-in address - see docs/api-endpoints/auth-api.md. The
 * confirmation is a client check the API has no field for. Answers with the
 * account, which the sidebar displays.
 */
export async function changeEmail({
  currentPassword,
  newEmail,
}: EmailFormInput): Promise<AdminUser> {
  const { user } = await apiFetch<{ user: AdminUser }>('/api/auth/email', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newEmail }),
  });

  return user;
}

/** Signs out every other device, and re-issues this one. */
export async function revokeOtherSessions(): Promise<void> {
  await apiFetch('/api/auth/revoke', { method: 'POST' });
}
