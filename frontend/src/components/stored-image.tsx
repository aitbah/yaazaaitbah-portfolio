'use client';

import NextImage from 'next/image';

import { assetUrl, isStoredUpload } from '@/lib/api-client';
import { cn } from '@/lib/utils';

type StoredImageProps = {
  /** The stored reference: a managed `/uploads/…` path, or an external URL. */
  src: string;
  alt: string;
  /**
   * The rendered width, as a CSS `sizes` value. Required: without it the
   * browser assumes the full viewport and downloads a candidate many times too
   * large.
   */
  sizes: string;
  /** Sizes the frame. The image fills it, as it did when it was an `img`. */
  className?: string;
  /** `contain` for a logo, which must not be cropped; `cover` for a photo. */
  fit?: 'cover' | 'contain';
  /** For the one image above the fold on a page - never for a list of them. */
  priority?: boolean;
  /** Called when the file behind a stored reference cannot be fetched. */
  onError?: () => void;
};

/**
 * A stored image, delivered at the size it is drawn. Uploads are same-origin
 * through the rewrite in `next.config.ts`, so the optimizer can fetch them and
 * `remotePatterns` stays empty. `fill`, because callers know their box, not the
 * file's proportions. External URLs are left unoptimized.
 */
export function StoredImage({
  src,
  alt,
  sizes,
  className,
  fit = 'cover',
  priority,
  onError,
}: StoredImageProps) {
  return (
    <span className={cn('relative block overflow-hidden', className)}>
      <NextImage
        src={assetUrl(src)}
        alt={alt}
        fill
        sizes={sizes}
        unoptimized={!isStoredUpload(src)}
        priority={priority}
        onError={onError}
        className={fit === 'contain' ? 'object-contain' : 'object-cover'}
      />
    </span>
  );
}
