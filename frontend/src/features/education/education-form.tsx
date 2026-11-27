'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm, useWatch, type FieldErrors } from 'react-hook-form';

import { CheckboxField } from '@/components/form/checkbox-field';
import { FieldRow } from '@/components/form/field-row';
import { FormActions } from '@/components/form/form-actions';
import { FormFields, FormLayout } from '@/components/form/form-layout';
import { FormSection } from '@/components/form/form-section';
import { LocalizedField } from '@/components/form/localized-field';
import { MonthField } from '@/components/form/month-field';
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

import type { Education } from './education-api';
import {
  educationSchema,
  type EducationFormValues,
  type EducationInput,
} from './education-schema';
import { useCreateEducation, useUpdateEducation } from './use-education';
import { LOCALES, keepUnrendered, localesOf } from '@/lib/localized-form';

/** The localized fields, which are not themselves rendered - one input per locale. */
const LOCALIZED = [
  'institution',
  'qualification',
  'fieldOfStudy',
  'location',
  'description',
] as const;

/** Exactly what has an input on screen, so a message there is actually visible. */
function hasVisibleMessage(errors: FieldErrors<EducationFormValues>): boolean {
  return (
    LOCALIZED.some((field) => {
      const value = errors[field] as Record<string, unknown> | undefined;

      return LOCALES.some((locale) => value?.[locale] !== undefined);
    }) ||
    errors.level !== undefined ||
    errors.startDate !== undefined ||
    errors.endDate !== undefined ||
    errors.current !== undefined
  );
}

function toFormValues(entry: Education | null): EducationFormValues {
  return {
    institution: localesOf(entry?.institution),
    qualification: localesOf(entry?.qualification),
    fieldOfStudy: localesOf(entry?.fieldOfStudy),
    level: entry?.level ?? '',
    location: localesOf(entry?.location),
    startDate: entry?.startDate ?? '',
    // The empty string, not undefined: a controlled input cannot hold undefined
    // without React reporting it as becoming uncontrolled.
    endDate: entry?.endDate ?? '',
    current: entry?.current ?? false,
    description: localesOf(entry?.description),
  };
}

/**
 * `PUT` replaces the document, so a locale the form did not render - one
 * written straight through the API, or left from a language since removed from
 * `routing.locales` - would be deleted by an ordinary save.
 */
function withUnrenderedLocales(
  input: EducationInput,
  entry: Education | null,
): EducationInput {
  if (!entry) {
    return input;
  }

  return {
    ...input,
    institution: keepUnrendered(entry.institution, input.institution),
    qualification: keepUnrendered(entry.qualification, input.qualification),
    // A field the admin cleared is left cleared: resurrecting it from its other
    // locales would fail validation anyway, since the launch locale is required.
    fieldOfStudy: input.fieldOfStudy
      ? keepUnrendered(entry.fieldOfStudy, input.fieldOfStudy)
      : input.fieldOfStudy,
    location: input.location
      ? keepUnrendered(entry.location, input.location)
      : input.location,
    description: input.description
      ? keepUnrendered(entry.description, input.description)
      : input.description,
  };
}

type EducationFormProps = {
  /** `null` creates a new entry; an entry edits that one. */
  entry: Education | null;
  onDone: () => void;
};

export function EducationForm({ entry, onDone }: EducationFormProps) {
  const t = useTranslations('admin.education');
  const levels = useOptionChoices('education-level');
  const tField = useTranslations('validation');
  const tResponse = useTranslations('responses');

  const create = useCreateEducation();
  const update = useUpdateEducation();
  const isPending = create.isPending || update.isPending;

  const [errorCode, setErrorCode] = useState<ResponseCode | null>(null);

  const form = useForm<EducationFormValues, unknown, EducationInput>({
    resolver: createFormResolver<EducationFormValues, EducationInput>(
      educationSchema,
      tField,
    ),
    defaultValues: toFormValues(entry),
  });

  const current = useWatch({ control: form.control, name: 'current' });

  /**
   * Ticking "I am still studying this" clears the end date rather than leaving
   * a value the schema will refuse. The rule is enforced in validation either
   * way; this is so the form never *shows* a contradiction it is about to
   * reject.
   */
  useEffect(() => {
    if (current && form.getValues('endDate') !== '') {
      form.setValue('endDate', '', { shouldValidate: true });
    }
  }, [current, form]);

  function onSubmit(input: EducationInput) {
    setErrorCode(null);

    const payload = withUnrenderedLocales(input, entry);

    const onError = (error: unknown) => {
      // The backend answers with the same field codes at the same paths, so
      // they land on the very fields RHF already knows. CONFLICT counts too:
      // a duplicate entry names the field it is about.
      if (
        error instanceof ApiRequestError &&
        (error.code === 'VALIDATION_ERROR' || error.code === 'CONFLICT')
      ) {
        for (const [path, code] of Object.entries(
          toFieldErrors(error.details),
        )) {
          form.setError(toFieldPath<EducationFormValues>(path), {
            type: code,
            message: tField(toFieldCode(code)),
          });
        }
      }

      setErrorCode(toResponseCode(error));
    };

    if (entry) {
      update.mutate(
        { id: entry.id, input: payload },
        { onSuccess: onDone, onError },
      );

      return;
    }

    create.mutate(payload, { onSuccess: onDone, onError });
  }

  // Read unconditionally: `formState` is a proxy that subscribes the component
  // to whatever it touches during render, and reading it behind a short-circuit
  // means the first render never subscribes.
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
        <FormSection title={t('groups.study')}>
          {/* The qualification and where it came from are one fact in two
              halves, and are always filled in together. */}
          <FieldRow>
            <LocalizedField
              control={form.control}
              name="qualification"
              required
              label={t('fields.qualification')}
            />
            <LocalizedField
              control={form.control}
              name="institution"
              required
              label={t('fields.institution')}
            />
          </FieldRow>

          <FieldRow>
            <SelectField
              control={form.control}
              name="level"
              id="education-level"
              label={t('fields.level')}
              placeholder={t('chooseLevel')}
              options={levels}
              required
            />
            <LocalizedField
              control={form.control}
              name="fieldOfStudy"
              label={t('fields.fieldOfStudy')}
            />
          </FieldRow>

          <FieldRow>
            <LocalizedField
              control={form.control}
              name="location"
              label={t('fields.location')}
            />
          </FieldRow>
        </FormSection>

        <FormSection title={t('groups.period')}>
          {/* The checkbox comes first because it decides whether the end date
              is a field at all. */}
          <CheckboxField
            control={form.control}
            name="current"
            id="education-current"
            label={t('fields.current')}
            description={t('currentHint')}
          />

          <FieldRow>
            <MonthField
              control={form.control}
              name="startDate"
              id="education-start"
              label={t('fields.startDate')}
              required
            />
            <MonthField
              control={form.control}
              name="endDate"
              id="education-end"
              label={t('fields.endDate')}
              // Disabled rather than hidden: a field that disappears takes its
              // label with it, and the reason it is unavailable with it.
              disabled={current}
              description={t('endHint')}
            />
          </FieldRow>
        </FormSection>

        <FormSection title={t('groups.detail')}>
          <LocalizedField
            control={form.control}
            name="description"
            label={t('fields.description')}
            multiline
          />
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
