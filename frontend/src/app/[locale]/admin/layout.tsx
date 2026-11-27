import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { connection } from 'next/server';
import type { ReactNode } from 'react';

import { MutationNotices } from '@/components/admin/mutation-notices';
import { QueryProvider } from '@/components/providers/query-provider';
import { pickAdminMessages } from '@/i18n/message-scopes';

// The admin area is not public-facing: keep it out of search results.
export const metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  /**
   * Rendered per request, which the admin's nonce CSP needs: Next nonces its
   * scripts only when it renders for the request, and a prerendered page's
   * scripts would be blocked.
   */
  await connection();

  const messages = pickAdminMessages(await getMessages());

  return (
    <NextIntlClientProvider messages={messages}>
      {/* The admin's server state; the public site renders on the server. */}
      <QueryProvider>
        <MutationNotices />
        <div className="min-h-svh">{children}</div>
      </QueryProvider>
    </NextIntlClientProvider>
  );
}
