'use client';

import type { Control, FieldValues } from 'react-hook-form';

import {
  LanguageTabs,
  useLocalizedLabel,
} from '@/components/form/field-language';
import { TextField } from '@/components/form/text-field';
import { routing } from '@/i18n/routing';
import { toTextFieldPath } from '@/lib/form-resolver';

import { useLocalizedFieldState } from './editing-locale';

type LocalizedFieldProps<TValues extends FieldValues, TPayload> = {
  control: Control<TValues, unknown, TPayload>;
  /** The localized field itself - `headline`, not `headline.en`. */
  name: string;
  label: string;
  /** Whether the field is required at all. Only the default locale carries it. */
  required?: boolean;
  multiline?: boolean;
};

/**
 * One input and a control for which language it holds, so a form is as long as
 * its fields, not fields times languages. The language is in the accessible
 * name, not on screen. It reads the locales itself, so no caller can pass them
 * wrongly.
 *
 * The per-locale path is built at runtime, so it reuses the one cast that
 * exists for that.
 */
export function LocalizedField<TValues extends FieldValues, TPayload>({
  control,
  name,
  label,
  required,
  multiline,
}: LocalizedFieldProps<TValues, TPayload>) {
  const localizedLabel = useLocalizedLabel();
  const { locales, defaultLocale } = routing;
  const { locale, setLocale, invalid } = useLocalizedFieldState(control, name);

  // With one locale there is nothing to choose between and nothing to tell
  // apart: it is an ordinary field, labelled the ordinary way.
  if (locales.length < 2) {
    return (
      <TextField
        control={control}
        name={toTextFieldPath<TValues>(`${name}.${defaultLocale}`)}
        id={`${name}-${defaultLocale}`}
        label={label}
        required={required}
        multiline={multiline}
      />
    );
  }

  return (
    <TextField
      // Remounted per language rather than renamed in place: the input is a
      // different field now, and reusing the node is how a stale value or a
      // stale error ends up under the new language's label.
      key={locale}
      control={control}
      name={toTextFieldPath<TValues>(`${name}.${locale}`)}
      id={`${name}-${locale}`}
      label={localizedLabel(label, locale)}
      // A required field is required in the default locale only. The others are
      // translations, and demanding one before a row can be saved would mean
      // adding a language invalidates every row already stored.
      required={required === true && locale === defaultLocale}
      multiline={multiline}
      aside={
        <LanguageTabs
          value={locale}
          onValueChange={setLocale}
          invalid={invalid}
        />
      }
    />
  );
}
