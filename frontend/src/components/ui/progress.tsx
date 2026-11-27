'use client';

import * as React from 'react';
import { Progress as ProgressPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        'relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted',
        className,
      )}
      {...props}
    >
      {/* Sized rather than slid: upstream translates the bar, which is physical
          and would drain the wrong way in Arabic. `inline-size` follows the
          document's direction. */}
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full bg-primary transition-[inline-size]"
        style={{ inlineSize: `${value ?? 0}%` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
