import type admin from './messages/en/admin.json';
import type errors from './messages/en/errors.json';
import type metadata from './messages/en/metadata.json';
import type responses from './messages/en/responses.json';
import type site from './messages/en/site.json';
import type validation from './messages/en/validation.json';
import type home from './messages/en/home.json';
import type { routing } from './src/i18n/routing';

// Makes locales and translation keys type-safe across the app.
declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof metadata &
      typeof site &
      typeof home &
      typeof admin &
      typeof validation &
      typeof responses &
      typeof errors;
  }
}
