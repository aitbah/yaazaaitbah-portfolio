import { hasLocale, type Messages } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { routing } from './routing';

/** One namespace file. The import is dynamic, so its shape is stated here. */
async function load(locale: string, namespace: string): Promise<Messages> {
  const file = (await import(`../../messages/${locale}/${namespace}.json`)) as {
    default: Messages;
  };

  return file.default;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    // One file per namespace; adding a locale means copying the folder.
    messages: Object.assign(
      {},
      ...(await Promise.all(
        [
          'metadata',
          'site',
          'home',
          'admin',
          'validation',
          'responses',
          'errors',
        ].map((namespace) => load(locale, namespace)),
      )),
    ) as Messages,
  };
});
