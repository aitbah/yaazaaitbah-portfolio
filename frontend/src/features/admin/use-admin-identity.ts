'use client';

import { useLocale } from 'next-intl';

import { useProfile } from '@/features/profile/use-profile';
import { useAuth } from '@/features/auth/use-auth';
import { localizedValue } from '@/i18n/localized-value';

export type AdminIdentity = {
  /** The owner's name, or an empty string while there is no profile. */
  name: string;
  /** The account's address, which is the one detail an account always has. */
  email: string;
  /** The stored photo path, or an empty string. */
  photoUrl: string;
  /** One or two letters for the avatar, from the name if there is one. */
  initials: string;
};

/**
 * Who the shell says is signed in: the person from the profile, falling back to
 * the account from the session, so a new install still renders a footer. Both
 * queries are shared with other pages through the cache.
 */
export function useAdminIdentity(): AdminIdentity {
  const { user } = useAuth();
  const { profile } = useProfile();
  const locale = useLocale();

  const email = user?.email ?? '';
  const first = localizedValue(profile?.firstName, locale);
  const last = localizedValue(profile?.lastName, locale);
  const name = [first, last].filter(Boolean).join(' ');

  const fromName = [first, last]
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('');

  return {
    name,
    email,
    photoUrl: profile?.photoUrl ?? '',
    // The address is all a 2 rem circle can hold before there is a name.
    initials: fromName || email.slice(0, 1).toUpperCase(),
  };
}
