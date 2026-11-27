import { BrandMark } from '@/components/brand-mark';
import { StoredImage } from '@/components/stored-image';

import type { ExpertiseIconValue } from './expertise-schema';

type ExpertiseIconProps = {
  icon: ExpertiseIconValue | undefined;
  /** The row's name, for the accessible name of whichever logo is drawn. */
  name: string;
  className?: string;
  /** Draw the brand's own colour rather than inheriting the text colour. */
  brandColor?: boolean;
};

/**
 * A technology's or a tool's logo, whichever of the two shapes it is: a
 * vendored preset named by slug, or a raster the admin uploaded.
 *
 * The preset half is `BrandMark`, shared with the social links; this component
 * is only the part that knows the icon is a discriminated union. A skill never
 * has one, and passing `undefined` draws nothing.
 */
export function ExpertiseIcon({
  icon,
  name,
  className,
  brandColor = false,
}: ExpertiseIconProps) {
  if (!icon) {
    return null;
  }

  if (icon.kind === 'upload') {
    return (
      <StoredImage
        src={icon.value}
        alt=""
        // A logo, never wider than the largest place one is drawn.
        sizes="96px"
        fit="contain"
        className={className}
      />
    );
  }

  // A slug validation accepts but the set cannot draw should be impossible -
  // the two are generated together and a test pins them. `BrandMark` renders
  // nothing rather than a broken box if that ever stops being true.
  return (
    <BrandMark
      slug={icon.value}
      title={name}
      className={className}
      brandColor={brandColor}
    />
  );
}
