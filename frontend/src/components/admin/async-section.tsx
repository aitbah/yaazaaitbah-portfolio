'use client';

import type { ReactNode } from 'react';

import { ErrorText } from '@/components/error-text';
import { Skeleton } from '@/components/ui/skeleton';
import { useErrorMessages } from '@/lib/error-messages';

type AsyncSectionProps = {
  isPending: boolean;
  /** The first failure among the queries this section needs, or null. */
  error: unknown;
  /** What is being loaded, for anyone who cannot see the skeleton. */
  loadingLabel: string;
  /** A shape closer to the real content than the default rows. */
  skeleton?: ReactNode;
  children: ReactNode;
};

/**
 * The loading and failure states of every admin section. It never renders
 * content over a failed read: a `PUT` replaces, so an empty form saved over a
 * failed GET would wipe the data. A skeleton, so the page does not jump.
 */
export function AsyncSection({
  isPending,
  error,
  loadingLabel,
  skeleton,
  children,
}: AsyncSectionProps) {
  const errorMessage = useErrorMessages();

  if (isPending) {
    return (
      <div role="status" aria-label={loadingLabel} aria-busy>
        {skeleton ?? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return <ErrorText>{errorMessage.response(error)}</ErrorText>;
  }

  return <>{children}</>;
}
