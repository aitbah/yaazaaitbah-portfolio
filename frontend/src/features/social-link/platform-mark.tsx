import { GlobeIcon } from 'lucide-react';

import { BrandMark, findBrandMark } from '@/components/brand-mark';
import { cn } from '@/lib/utils';

type PlatformMarkProps = {
  /**
   * The vendored slug the platform's option carries, or `undefined`. Read from
   * the option, so a platform the owner adds can have a logo.
   */
  slug: string | undefined;
  /** The platform's translated name, as the mark's accessible name. */
  title: string;
  className?: string;
};

/** The mark for a platform, or a generic one for a platform with none. */
export function PlatformMark({ slug, title, className }: PlatformMarkProps) {
  if (slug && findBrandMark(slug)) {
    return <BrandMark slug={slug} title={title} className={className} />;
  }

  return <GlobeIcon aria-label={title} className={cn('shrink-0', className)} />;
}
