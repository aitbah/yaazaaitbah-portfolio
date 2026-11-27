import { findBrandMark } from '@/components/brand-mark';
import { cn } from '@/lib/utils';

const markId = (slug: string) => `mark-${slug}`;

/**
 * The brand marks a page uses, each drawn once. A logo can appear several
 * times on a page - a technology in its column, again in a project's stack -
 * and its path is long; each use is a reference here rather than a copy in
 * the HTML and in the data React hydrates from.
 */
export function MarkSprite({ slugs }: { slugs: (string | undefined)[] }) {
  const marks = [...new Set(slugs)]
    .filter((slug): slug is string => Boolean(slug))
    .map((slug) => ({ slug, mark: findBrandMark(slug) }))
    .filter((entry) => entry.mark !== undefined);

  if (!marks.length) {
    return null;
  }

  return (
    // Sized to nothing rather than hidden: a symbol inside `display: none` is
    // not drawn everywhere it is used.
    <svg aria-hidden width="0" height="0" className="absolute size-0">
      {marks.map(({ slug, mark }) => (
        <symbol key={slug} id={markId(slug)} viewBox="0 0 24 24">
          <path d={mark!.path} />
        </symbol>
      ))}
    </svg>
  );
}

/**
 * A brand mark from the page's sprite, in the current colour; nothing when the
 * set has no mark for the slug.
 */
export function SpriteMark({
  slug,
  className,
}: {
  slug: string;
  className?: string;
}) {
  return findBrandMark(slug) ? (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={cn('size-3.5 shrink-0 fill-current', className)}
    >
      <use href={`#${markId(slug)}`} />
    </svg>
  ) : null;
}
