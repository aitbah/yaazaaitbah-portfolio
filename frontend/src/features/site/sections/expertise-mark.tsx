import { StoredImage } from '@/components/stored-image';
import type { Expertise } from '@/features/expertise/expertise-api';
import { cn } from '@/lib/utils';

import { SpriteMark } from '../mark-sprite';

/**
 * A row's logo in the page's own ink: a vendored mark from the page's sprite
 * (`MarkSprite`), drawn in the current colour, or an uploaded one in gray.
 * Server-only, so the mark set stays on the server. Decorative: the name
 * beside it says what it is.
 */
export function ExpertiseMark({
  icon,
  className,
}: {
  icon: Expertise['icon'];
  className?: string;
}) {
  if (!icon) {
    return null;
  }

  if (icon.kind === 'upload') {
    return (
      <StoredImage
        src={icon.value}
        alt=""
        sizes="16px"
        fit="contain"
        className={cn('size-3.5 shrink-0 grayscale dark:invert', className)}
      />
    );
  }

  return <SpriteMark slug={icon.value} className={className} />;
}
