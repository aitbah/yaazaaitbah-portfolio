import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** A section's number, two digits. */
export const sectionNumber = (index: number) => String(index).padStart(2, '0');

/**
 * A section's head: its number in red beside its name, set large in the serif.
 * The name's lines rise as it comes into view (`data-lines`, by the motion);
 * the number is decoration, out of the accessible name. An aside, when there
 * is one, sits at the head's far end.
 */
export function SectionHead({
  index,
  id,
  title,
  aside,
  className,
}: {
  index: number;
  id: string;
  title: string;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'mb-[clamp(48px,9vh,112px)] grid items-end gap-x-10 gap-y-6 md:grid-cols-[1fr_auto]',
        className,
      )}
    >
      <h2
        id={id}
        className="site-display flex items-start gap-4 text-site-title"
      >
        <span
          aria-hidden
          className="site-label mt-[0.35em] shrink-0 text-site-red [font-feature-settings:'tnum']"
        >
          {sectionNumber(index)}
        </span>
        <span data-lines>{title}</span>
      </h2>
      {aside ? (
        <div className="max-w-[36ch] text-sm leading-relaxed text-site-muted md:pb-3 md:text-end">
          {aside}
        </div>
      ) : null}
    </header>
  );
}
