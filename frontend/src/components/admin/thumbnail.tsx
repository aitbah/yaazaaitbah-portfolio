'use client';

import { ImageOffIcon } from 'lucide-react';
import { useState } from 'react';

import { StoredImage } from '@/components/stored-image';
import { cn } from '@/lib/utils';

type ThumbnailProps = {
  /** The stored reference, or an empty string when there is no image. */
  url: string;
  alt: string;
  /** Said in the empty frame - "no cover yet" is information, not a gap. */
  emptyLabel: string;
  /** Said when a reference is stored but its file cannot be fetched. */
  unavailableLabel: string;
  /**
   * How wide this is actually drawn, as a CSS `sizes` value.
   *
   * Passed by the caller rather than guessed here, because the same component
   * frames a 64 px row thumbnail and a full-width banner, and the browser picks
   * its candidate from this alone.
   */
  sizes: string;
  /** For the one image likely to be the largest thing on first paint. */
  priority?: boolean;
  className?: string;
};

/**
 * A stored image, or a clear account of why there is none.
 *
 * Two absences, deliberately distinguished: nothing was ever chosen, and
 * something was chosen whose file has since gone - a swapped volume, a manual
 * delete. Drawing both as an empty box would hide a real problem, and drawing
 * the second as a broken image icon would blame the browser for it.
 */
export function Thumbnail({
  url,
  alt,
  emptyLabel,
  unavailableLabel,
  sizes,
  priority,
  className,
}: ThumbnailProps) {
  const [unreachable, setUnreachable] = useState(false);

  if (!url || unreachable) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-1 rounded-md border border-dashed bg-muted/30 p-2 text-center text-xs text-muted-foreground',
          className,
        )}
      >
        <ImageOffIcon className="size-4" aria-hidden />
        <span>{url ? unavailableLabel : emptyLabel}</span>
      </div>
    );
  }

  return (
    <StoredImage
      src={url}
      alt={alt}
      sizes={sizes}
      priority={priority}
      className={cn('rounded-md border bg-muted/30', className)}
      onError={() => setUnreachable(true)}
    />
  );
}
