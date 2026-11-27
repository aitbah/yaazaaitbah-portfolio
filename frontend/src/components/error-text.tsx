import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * A failure the reader is told about, announced as it appears.
 *
 * Renders nothing when there is nothing to say, so callers pass the message
 * they may or may not have rather than writing the condition out themselves.
 */
export function ErrorText({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  if (!children) {
    return null;
  }

  return (
    <p role="alert" className={cn('text-sm text-destructive', className)}>
      {children}
    </p>
  );
}
