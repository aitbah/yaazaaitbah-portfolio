'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { LANGUAGE_CODES } from '@portfolio/shared';

import { FieldRow } from '@/components/form/field-row';
import { FormActions } from '@/components/form/form-actions';
import { FormFields, FormLayout } from '@/components/form/form-layout';
import { FormSection } from '@/components/form/form-section';
import { SelectField } from '@/components/form/select-field';
import { useOptionChoices } from '@/features/option/use-options';
import { ApiRequestError } from '@/lib/api-client';
import {
  toFieldCode,
  toFieldErrors,
  toResponseCode,
  type ResponseCode,
} from '@/lib/error-codes';
import { createFormResolver, toFieldPath } from '@/lib/form-resolver';

import type { Language } from './language-api';
import { languageName } from '@/i18n/language-name';
import {
  languageSchema,
  type LanguageFormValues,
  type LanguageInput,
} from './language-schema';
import { useCreateLanguage, useUpdateLanguage } from './use-languages';

/** Exactly what has an input on screen, so a message there is actually visible. */
function hasVisibleMessage(errors: FieldErrors<LanguageFormValues>): boolean {
  return errors.code !== undefined || errors.level !== undefined;
}

function toFormValues(language: Language | null): LanguageFormValues {
  return {
    code: (language?.code ?? '') as LanguageFormValues['code'],
    level: language?.level ?? '',
  };
}

type LanguageFormProps = {
  /** `null` creates a new language; a language edits that one. */
  language: Language | null;
  onDone: () => void;
};

export function LanguageForm({ language, onDone }: LanguageFormProps) {
  const t = useTranslations('admin.languages');
  const levels = useOptionChoices('language-level');
  const tField = useTranslations('validation');
  const tResponse = useTranslations('responses');
  const locale = useLocale();

  const create = useCreateLanguage();
  const update = useUpdateLanguage();
  const isPending = create.isPending || update.isPending;

  const [errorCode, setErrorCode] = useState<ResponseCode | null>(null);

  const form = useForm<LanguageFormValues, unknown, LanguageInput>({
    resolver: createFormResolver<LanguageFormValues, LanguageInput>(
      languageSchema,
      tField,
    ),
    defaultValues: toFormValues(language),
  });

  function onSubmit(input: LanguageInput) {
    setErrorCode(null);

    const onError = (error: unknown) => {
      // The backend answers with the same field codes at the same paths, so
      // they land on the very fields RHF already knows. CONFLICT counts too:
      // a language already listed names the field it is about.
      if (
        error instanceof ApiRequestError &&
        (error.code === 'VALIDATION_ERROR' || error.code === 'CONFLICT')
      ) {
        for (const [path, code] of Object.entries(
          toFieldErrors(error.details),
        )) {
          form.setError(toFieldPath<LanguageFormValues>(path), {
            type: code,
            message: tField(toFieldCode(code)),
          });
        }
      }

      setErrorCode(toResponseCode(error));
    };

    if (language) {
      update.mutate({ id: language.id, input }, { onSuccess: onDone, onError });

      return;
    }

    create.mutate(input, { onSuccess: onDone, onError });
  }

  /**
   * Named at render time and sorted by the name the reader sees, not by the
   * subtag: a list sorted by code puts German under D for nobody.
   */
  const codes = LANGUAGE_CODES.map((value) => ({
    value,
    label: languageName(value, locale),
  })).sort((a, b) => a.label.localeCompare(b.label, locale));

  // Read unconditionally: `formState` is a proxy that subscribes the component
  // to whatever it touches during render.
  const { errors } = form.formState;
  const globalError =
    errorCode !== null && !hasVisibleMessage(errors)
      ? tResponse(errorCode)
      : null;

  return (
    <FormLayout
      onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
      isDirty={form.formState.isDirty}
    >
      <FormFields>
        <FormSection>
          {/* Two short choices and nothing else: a single row is the form. */}
          <FieldRow>
            <SelectField
              control={form.control}
              name="code"
              id="language-code"
              label={t('fields.code')}
              placeholder={t('chooseLanguage')}
              options={codes}
              required
            />
            <SelectField
              control={form.control}
              name="level"
              id="language-level"
              label={t('fields.level')}
              placeholder={t('chooseLevel')}
              options={levels}
              required
            />
          </FieldRow>
        </FormSection>
      </FormFields>

      <FormActions
        submitLabel={t('submit')}
        submittingLabel={t('submitting')}
        isPending={isPending}
        cancelLabel={t('cancel')}
        onCancel={onDone}
        error={globalError}
      />
    </FormLayout>
  );
}
