import { SKILL_ICONS } from '@portfolio/shared/skill-icons';

import { cn } from '@/lib/utils';

/**
 * A vendored brand logo, drawn from its slug; nothing user-supplied is parsed.
 * The set is 300 kB: the public site must only render this from a server
 * component, or every visitor downloads all of it.
 */
const BY_SLUG = new Map(SKILL_ICONS.map((icon) => [icon.slug, icon]));

export function findBrandMark(slug: string) {
  return BY_SLUG.get(slug as never);
}

type BrandMarkProps = {
  slug: string;
  /** The accessible name - the brand, or what the logo stands for here. */
  title: string;
  className?: string;
  /**
   * Draw the brand's own colour rather than inheriting the text colour.
   * Off in dense lists, where twenty brand colours is noise rather than
   * information, and on where the logo is the subject.
   */
  brandColor?: boolean;
};

export function BrandMark({
  slug,
  title,
  className,
  brandColor = false,
}: BrandMarkProps) {
  const mark = findBrandMark(slug);

  // Not every brand has a vendored mark - LinkedIn among them, removed upstream
  // after a trademark request. Callers draw their own fallback.
  if (!mark) {
    return null;
  }

  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
      className={cn('shrink-0', className)}
      fill={brandColor ? `#${mark.hex}` : 'currentColor'}
    >
      <path d={mark.path} />
    </svg>
  );
}
