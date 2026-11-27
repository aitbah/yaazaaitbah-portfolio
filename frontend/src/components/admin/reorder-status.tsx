'use client';

import { useTranslations } from 'next-intl';

import { ErrorToast } from '@/components/error-toast';
import { ApiRequestError } from '@/lib/api-client';
import { toResponseCode } from '@/lib/error-codes';

type ReorderStatusProps = {
  /** Whatever the reorder mutation last failed with, or `null`. */
  error: unknown;
  /** True while an ordering is on its way to the server. */
  isReordering: boolean;
};

/**
 * Whether an ordering saved, and what to do if not - a stale one (two tabs, or
 * a row added elsewhere) needs a reload, and says so.
 */
export function ReorderStatus({ error, isReordering }: ReorderStatusProps) {
  const t = useTranslations('admin.reorder');
  const tResponse = useTranslations('responses');

  if (error) {
    return <ErrorToast>{describe(error)}</ErrorToast>;
  }

  /**
   * A move is optimistic: the row jumps at once and the save happens behind it.
   * That reads fine on screen and says nothing at all to a screen reader, which
   * is the state this message was written for and never used in.
   */
  if (isReordering) {
    return (
      <p role="status" className="sr-only">
        {t('saving')}
      </p>
    );
  }

  return null;

  function describe(failure: unknown): string {
    if (
      failure instanceof ApiRequestError &&
      failure.details.order === 'STALE'
    ) {
      return t('stale');
    }

    // An expired session has its own remedy, and "sign in again" is more use
    // than "the order could not be saved".
    if (toResponseCode(failure) === 'UNAUTHENTICATED') {
      return tResponse('UNAUTHENTICATED');
    }

    // A network failure, a server fault, anything else: all of them are this.
    return t('failed');
  }
}
