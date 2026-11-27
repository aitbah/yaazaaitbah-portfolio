import { routing } from '@/i18n/routing';

/** A localized field as a form holds it: every rendered locale, blank or not. */
type LocaleValues = Record<string, string>;

/** Every configured locale, so a language added to routing grows the form. */
export const LOCALES = routing.locales;

/** The one locale every row must carry - see DATABASE.md. */
export const DEFAULT_LOCALE = routing.defaultLocale;

const CONFIGURED: readonly string[] = LOCALES;

/** Every configured locale gets a value, so no input starts uncontrolled. */
export function localesOf(stored: LocaleValues | undefined): LocaleValues {
  return Object.fromEntries(
    LOCALES.map((locale) => [locale, stored?.[locale] ?? '']),
  );
}

/**
 * Keeps what was stored under a locale the form never rendered: `PUT` replaces,
 * so an ordinary save would delete it.
 */
export function keepUnrendered<T extends LocaleValues>(
  stored: LocaleValues | undefined,
  edited: T,
): T {
  const unrendered = Object.entries(stored ?? {}).filter(
    ([locale]) => !CONFIGURED.includes(locale),
  );

  return { ...Object.fromEntries(unrendered), ...edited };
}

/**
 * Which languages a form is refusing to save, so a field showing one language
 * at a time can mark and switch to the invalid one. It walks the error tree,
 * since errors nest to any depth.
 */
export function localesWithErrors(errors: unknown): Set<string> {
  const found = new Set<string>();

  walk(errors);

  return found;

  function walk(node: unknown): void {
    if (typeof node !== 'object' || node === null) {
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      if (isFieldError(value)) {
        if (CONFIGURED.includes(key)) {
          found.add(key);
        }

        continue;
      }

      walk(value);
    }
  }
}

function isFieldError(node: unknown): boolean {
  return (
    typeof node === 'object' &&
    node !== null &&
    ('type' in node || 'message' in node)
  );
}
