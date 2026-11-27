'use client';

import { useTranslations } from 'next-intl';

import { ErrorToast } from '@/components/error-toast';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { useErrorMessages } from '@/lib/error-messages';

import { useRevokeSessions } from './use-account';

/**
 * "Sign out everywhere else", for a lost device when the password is fine. This
 * session is re-issued and stays signed in.
 */
export function SessionsCard() {
  const t = useTranslations('admin.account');
  const errorMessage = useErrorMessages();

  const revoke = useRevokeSessions();
  const toast = useToast();

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="max-w-prose text-sm text-muted-foreground">
        {t('sessionsDescription')}
      </p>

      <ErrorToast>
        {revoke.error ? errorMessage.response(revoke.error) : null}
      </ErrorToast>

      <Button
        type="button"
        variant="outline"
        disabled={revoke.isPending}
        onClick={() => {
          // Nothing on screen changes when this works - the sessions it ends
          // are on other machines - so the toast is the only feedback there is.
          revoke.mutate(undefined, {
            onSuccess: () =>
              toast({ title: t('sessionsRevoked'), tone: 'success' }),
          });
        }}
      >
        {revoke.isPending ? (
          <>
            <Spinner aria-hidden />
            {t('revoking')}
          </>
        ) : (
          t('revoke')
        )}
      </Button>
    </div>
  );
}
