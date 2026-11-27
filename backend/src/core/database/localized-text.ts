import type { SchemaDefinitionProperty } from 'mongoose';

import { DEFAULT_LOCALE } from '@portfolio/shared';

export { DEFAULT_LOCALE };

export function hasDefaultLocale(value: Map<string, string>) {
  return (value.get(DEFAULT_LOCALE) ?? '').trim().length > 0;
}

/**
 * The indexed path into a localized field - `localizedPath('name')` is
 * `name.en`. Unique indexes and conflict errors are keyed on the default
 * locale; this names that path once.
 */
export function localizedPath(field: string): string {
  return `${field}.${DEFAULT_LOCALE}`;
}

/**
 * Locale-keyed text, as a Map rather than fixed keys: adding a language means
 * populating the document, never editing a schema (see DATABASE.md).
 *
 * Shared infrastructure rather than a per-feature helper, because every entity
 * with content needs the same shape and the same "the launch locale is present"
 * guarantee.
 */
export const localizedText = {
  type: Map,
  of: String,
  validate: { validator: hasDefaultLocale },
} satisfies SchemaDefinitionProperty;
