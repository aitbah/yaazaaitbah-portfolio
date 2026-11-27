'use client';

import { useTranslations } from 'next-intl';

import { PageHeader } from '@/components/admin/page-header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmailForm } from '@/features/account/email-form';
import { MailCard } from '@/features/account/mail-card';
import { PasswordForm } from '@/features/account/password-form';
import { SessionsCard } from '@/features/account/sessions-card';
import { useAuth } from '@/features/auth/use-auth';

/**
 * The account: the password, the sign-in address and the sessions. Managing
 * locales from a screen was ruled out - a language needs translations shipped
 * with it, which a runtime toggle cannot check.
 */
export default function AccountPage() {
  const t = useTranslations('admin.account');
  // No loading state of its own: the protected layout renders a spinner until
  // the session is known and redirects when there is none, so by the time this
  // page renders there is an account.
  const { user } = useAuth();

  return (
    <div className="flex w-full flex-col gap-8">
      <PageHeader title={t('title')} description={t('description')} />

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('signedInTitle')}</CardTitle>
            <CardDescription>{t('signedInDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {/* The address, which is also the identifier signed in with. Shown
                above the form rather than inside it: what is being replaced is
                not what is being typed. */}
            <p className="text-sm font-medium">{user?.email}</p>

            {/* Only once the session is known. The schema is built around the
                current address - it is what "unchanged" is measured against -
                so a form rendered before it arrived would be built around the
                wrong one. */}
            {user ? <EmailForm currentEmail={user.email} /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('passwordTitle')}</CardTitle>
            <CardDescription>{t('passwordDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('sessionsTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <SessionsCard />
          </CardContent>
        </Card>

        {/* Last, and read-only: it is the only card that is about the
            deployment rather than the account. */}
        <Card>
          <CardHeader>
            <CardTitle>{t('mailTitle')}</CardTitle>
            <CardDescription>{t('mailDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <MailCard />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
