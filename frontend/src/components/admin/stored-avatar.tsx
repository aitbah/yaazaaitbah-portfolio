'use client';

import { getImageProps } from 'next/image';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { assetUrl, isStoredUpload } from '@/lib/api-client';

type StoredAvatarProps = {
  /** The stored reference, or an empty string when there is no photograph. */
  url: string;
  /** Empty where the name is already beside it - a repeated name is noise. */
  alt: string;
  /** One or two letters, drawn when there is no photograph or it fails. */
  initials: string;
  /** How wide the circle actually is, in CSS pixels. */
  width: number;
  className?: string;
  /** Styling for the initials, which differ in size from place to place. */
  fallbackClassName?: string;
};

/**
 * The account's photograph at avatar size rather than upload size.
 * `getImageProps` rather than `<Image>`: Radix's avatar loads the `src` itself,
 * so it needs an optimized `src`/`srcSet` or it would fetch both copies.
 */
export function StoredAvatar({
  url,
  alt,
  initials,
  width,
  className,
  fallbackClassName,
}: StoredAvatarProps) {
  const {
    props: { src, srcSet },
  } = getImageProps({
    src: url ? assetUrl(url) : '',
    alt,
    width,
    height: width,
    // Somebody else's host is not something the optimizer may fetch from, and
    // no `remotePatterns` entry could safely say otherwise.
    unoptimized: !isStoredUpload(url),
  });

  return (
    <Avatar className={className}>
      {url ? <AvatarImage src={src} srcSet={srcSet} alt={alt} /> : null}
      <AvatarFallback className={fallbackClassName}>{initials}</AvatarFallback>
    </Avatar>
  );
}
