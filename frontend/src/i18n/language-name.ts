/**
 * The name of a language in the reader's own locale, from `Intl.DisplayNames`,
 * so no name is stored or translated. Instances are cached per locale.
 */
const byLocale = new Map<string, Intl.DisplayNames>();

function namesFor(locale: string): Intl.DisplayNames | null {
  const cached = byLocale.get(locale);

  if (cached) {
    return cached;
  }

  try {
    // `fallback: 'code'` rather than throwing: an unknown subtag should render
    // as itself rather than blank the row it is in. The contract's enum is what
    // keeps one from being stored in the first place.
    const names = new Intl.DisplayNames([locale], {
      type: 'language',
      fallback: 'code',
    });

    byLocale.set(locale, names);

    return names;
  } catch {
    // A runtime without the API, or a locale it will not accept.
    return null;
  }
}

export function languageName(code: string, locale: string): string {
  return namesFor(locale)?.of(code) ?? code;
}
