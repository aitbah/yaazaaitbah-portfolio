'use client';

import * as React from 'react';
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

/**
 * A short fixed list of choices, all visible - a radio group with roving focus,
 * not `Tabs`, since there are no panels. Shared by the interface language, the
 * content language and the theme.
 */
function SegmentedControl<TValue extends string>({
  value,
  onValueChange,
  label,
  className,
  children,
}: {
  value: TValue;
  onValueChange: (value: TValue) => void;
  /** Says what is being chosen - "Theme", not the name of the current choice. */
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      // Radix answers with '' when the pressed item is pressed again. These are
      // settings, and a setting has no "none" - keep the current choice.
      onValueChange={(next) => {
        // Radix hands back a plain string. Only the values rendered as
        // options can come out of it, and the caller decides what those are -
        // so the one cast lives here rather than at every call site.
        if (next) {
          onValueChange(next as TValue);
        }
      }}
      aria-label={label}
      data-slot="segmented-control"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border p-0.5',
        className,
      )}
    >
      {children}
    </ToggleGroupPrimitive.Root>
  );
}

function SegmentedControlItem({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="segmented-control-item"
      className={cn(
        'inline-flex h-7 min-w-7 shrink-0 items-center justify-center gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] font-medium whitespace-nowrap text-muted-foreground transition-all outline-none hover:bg-muted hover:text-foreground',
        'hover:text-foreground',
        'focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'data-[state=on]:bg-muted data-[state=on]:text-foreground',
        '[&_svg]:size-3.5 [&_svg]:shrink-0',
        className,
      )}
      {...props}
    />
  );
}

export { SegmentedControl, SegmentedControlItem };
