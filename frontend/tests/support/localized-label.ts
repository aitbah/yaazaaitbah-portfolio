import { languageName } from '../../src/i18n/language-name';
import { routing } from '../../src/i18n/routing';

/**
 * How a localized input is labelled on screen.
 *
 * With one locale a field is just "Headline". With two it is "Headline
 * (English)" and "Headline (French)", because an unlabelled pair of identical
 * boxes is not a form. Adding French therefore renamed every localized input in
 * the admin, and every test that reached for one by its bare label stopped
 * finding it - seventy-four of them.
 *
 * The tests keep naming the field, and this names the input: they are about
 * what the admin types into the headline, not about how many languages the site
 * happens to offer this year.
 */
export function localizedLabel(
  label: string,
  locale: string = routing.defaultLocale,
): string {
  return routing.locales.length > 1
    ? `${label} (${languageName(locale, routing.defaultLocale)})`
    : label;
}
