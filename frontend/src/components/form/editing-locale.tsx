'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  get,
  useFormState,
  type Control,
  type FieldValues,
} from 'react-hook-form';

import { routing } from '@/i18n/routing';
import { localesWithErrors } from '@/lib/localized-form';

type EditingLocale = {
  /** The language every localized field on this form is currently showing. */
  locale: string;
  setLocale: (locale: string) => void;
};

const EditingLocaleContext = createContext<EditingLocale | null>(null);

/**
 * One editing language per form, not per field, so the form is always visibly
 * in one language. It starts on the default locale, the one a new row must
 * carry first.
 */
export function EditingLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<string>(routing.defaultLocale);

  const value = useMemo(() => ({ locale, setLocale }), [locale]);

  return (
    <EditingLocaleContext.Provider value={value}>
      {children}
    </EditingLocaleContext.Provider>
  );
}

function useEditingLocale(): EditingLocale {
  const context = useContext(EditingLocaleContext);

  if (!context) {
    // Loud on purpose. Falling back to per-field state would produce exactly
    // the form this provider exists to prevent, and it would look fine.
    throw new Error('A localized field must be rendered inside a FormLayout.');
  }

  return context;
}

/**
 * What a localized field needs about languages: which one to show, how to
 * change it, and where it is invalid. A failed submit switches to the first
 * language with an error, so the reason is never hidden.
 */
export function useLocalizedFieldState<TValues extends FieldValues, TPayload>(
  control: Control<TValues, unknown, TPayload>,
  name: string,
) {
  const { locale, setLocale } = useEditingLocale();
  const { errors, submitCount } = useFormState({ control });
  const handled = useRef(submitCount);

  useEffect(() => {
    // Only a *new* refusal moves the reader. Errors also change as they type,
    // and yanking the language out from under someone mid-sentence is not help.
    if (submitCount === handled.current) {
      return;
    }

    handled.current = submitCount;

    const invalid = localesWithErrors(errors);

    // Nothing to go to, or the message is already on screen.
    if (invalid.size === 0 || invalid.has(locale)) {
      return;
    }

    const first = routing.locales.find((candidate) => invalid.has(candidate));

    if (first) {
      setLocale(first);
    }
  }, [errors, locale, setLocale, submitCount]);

  return {
    locale,
    setLocale,
    /** This field's own languages - not the form's, which would mark every
        field because one of them is wrong. */
    invalid: new Set(
      routing.locales.filter(
        (candidate) => get(errors, `${name}.${candidate}`) !== undefined,
      ),
    ),
  };
}
