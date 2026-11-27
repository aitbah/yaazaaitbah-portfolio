'use client';

import { useTranslations } from 'next-intl';

import { ErrorToast } from '@/components/error-toast';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { ApiRequestError } from '@/lib/api-client';
import { useErrorMessages } from '@/lib/error-messages';

import { useMailStatus, useSendTestMail } from './use-mail';

/**
 * Why the send failed, when the server said which.
 *
 * The two cases are worth telling apart because the fix is different: nothing
 * is configured, or something is and the server refused it. Falling back to the
 * response code would render both as "Something went wrong", which is the exact
 * answer this card exists to replace.
 */
function failureKey(
  error: unknown,
): 'mailNotConfigured' | 'mailSendFailed' | null {
  if (!(error instanceof ApiRequestError)) {
    return null;
  }

  if (error.details.mail === 'NOT_CONFIGURED') {
    return 'mailNotConfigured';
  }

  return error.details.mail === 'SEND_FAILED' ? 'mailSendFailed' : null;
}

/**
 * Whether mail works, and a test send to find out. Read-only: SMTP settings
 * live in the environment, since a password in the database could be read back
 * from every backup.
 */
export function MailCard() {
  const t = useTranslations('admin.account');
  const errorMessage = useErrorMessages();

  const { data: mail, isPending } = useMailStatus();
  const test = useSendTestMail();
  const toast = useToast();

  if (isPending) {
    return <p className="text-sm text-muted-foreground">{t('mailLoading')}</p>;
  }

  if (!mail?.configured) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t('mailOff')}</p>
        <p className="max-w-prose text-sm text-muted-foreground">
          {t('mailOffHint')}
        </p>
      </div>
    );
  }

  const failed = failureKey(test.error);

  return (
    <div className="flex flex-col items-start gap-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t('mailServer')}</dt>
        <dd className="font-medium">
          {mail.host}:{mail.port}
        </dd>
        <dt className="text-muted-foreground">{t('mailFrom')}</dt>
        <dd className="font-medium">{mail.from}</dd>
        <dt className="text-muted-foreground">{t('mailNotifyTo')}</dt>
        <dd className="font-medium">{mail.notifyTo}</dd>
      </dl>

      <p className="max-w-prose text-sm text-muted-foreground">
        {t('mailHint')}
      </p>

      <ErrorToast>
        {test.error
          ? failed
            ? t(failed)
            : errorMessage.response(test.error)
          : null}
      </ErrorToast>

      <Button
        type="button"
        variant="outline"
        disabled={test.isPending}
        onClick={() => {
          test.mutate(undefined, {
            // Where it went, not just that it went: the question is whether it
            // reaches an inbox the owner reads.
            onSuccess: (address) =>
              toast({
                title: t('mailSent', {
                  address: address ?? mail.notifyTo ?? '',
                }),
                tone: 'success',
              }),
          });
        }}
      >
        {test.isPending ? (
          <>
            <Spinner aria-hidden />
            {t('mailSending')}
          </>
        ) : (
          t('mailSendTest')
        )}
      </Button>
    </div>
  );
}
