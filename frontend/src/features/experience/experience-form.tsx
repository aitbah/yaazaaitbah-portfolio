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

import type { Experience } from './experience-api';
import {
  experienceSchema,
  type ExperienceFormValues,
  type ExperienceInput,
} from './experience-schema';
import { useCreateExperience, useUpdateExperience } from './use-experience';
import { LOCALES, keepUnrendered, localesOf } from '@/lib/localized-form';

/** The localized fields, which are not themselves rendered - one input per locale. */
const LOCALIZED = ['role', 'organisation', 'location', 'description'] as const;

/** Exactly what has an input on screen, so a message there is actually visible. */
function hasVisibleMessage(errors: FieldErrors<ExperienceFormValues>): boolean {
  return (
    LOCALIZED.some((field) => {
      const value = errors[field] as Record<string, unknown> | undefined;

      return LOCALES.some((locale) => value?.[locale] !== undefined);
    }) ||
    errors.employmentType !== undefined ||
    errors.startDate !== undefined ||
    errors.endDate !== undefined ||
    errors.current !== undefined
  );
}

function toFormValues(position: Experience | null): ExperienceFormValues {
  return {
    role: localesOf(position?.role),
    organisation: localesOf(position?.organisation),
    location: localesOf(position?.location),
    employmentType: position?.employmentType ?? '',
    startDate: position?.startDate ?? '',
    // The empty string, not undefined: a controlled input cannot hold undefined
    // without React reporting it as becoming uncontrolled.
    endDate: position?.endDate ?? '',
    current: position?.current ?? false,
    description: localesOf(position?.description),
  };
}

/**
 * `PUT` replaces the document, so a locale the form did not render - one
 * written straight through the API, or left from a language since removed from
 * `routing.locales` - would be deleted by an ordinary save.
 */
function withUnrenderedLocales(
  input: ExperienceInput,
  position: Experience | null,
): ExperienceInput {
  if (!position) {
    return input;
  }

  return {
    ...input,
    role: keepUnrendered(position.role, input.role),
    organisation: keepUnrendered(position.organisation, input.organisation),
    // A field the admin cleared is left cleared: resurrecting it from its other
    // locales would fail validation anyway, since the launch locale is required.
    location: input.location
      ? keepUnrendered(position.location, input.location)
      : input.location,
    description: input.description
      ? keepUnrendered(position.description, input.description)
      : input.description,
  };
}

type ExperienceFormProps = {
  /** `null` creates a new position; a position edits that one. */
  position: Experience | null;
  onDone: () => void;
};

export function ExperienceForm({ position, onDone }: ExperienceFormProps) {
  const t = useTranslations('admin.experience');
  const types = useOptionChoices('employment-type');
  const tField = useTranslations('validation');
  const tResponse = useTranslations('responses');

  const create = useCreateExperience();
  const update = useUpdateExperience();
  const isPending = create.isPending || update.isPending;

  const [errorCode, setErrorCode] = useState<ResponseCode | null>(null);

  const form = useForm<ExperienceFormValues, unknown, ExperienceInput>({
    resolver: createFormResolver<ExperienceFormValues, ExperienceInput>(
      experienceSchema,
      tField,
    ),
    defaultValues: toFormValues(position),
  });

  const current = useWatch({ control: form.control, name: 'current' });

  /**
   * Ticking "I still work here" clears the end date rather than leaving a value
   * the schema will refuse. The rule is enforced in validation either way; this
   * is so the form never *shows* a contradiction it is about to reject.
   */
  useEffect(() => {
    if (current && form.getValues('endDate') !== '') {
      form.setValue('endDate', '', { shouldValidate: true });
    }
  }, [current, form]);

  function onSubmit(input: ExperienceInput) {
    setErrorCode(null);

    const payload = withUnrenderedLocales(input, position);

    const onError = (error: unknown) => {
      // The backend answers with the same field codes at the same paths, so
      // they land on the very fields RHF already knows. CONFLICT counts too:
      // a duplicate position names the field it is about.
      if (
        error instanceof ApiRequestError &&
        (error.code === 'VALIDATION_ERROR' || error.code === 'CONFLICT')
      ) {
        for (const [path, code] of Object.entries(
          toFieldErrors(error.details),
        )) {
          form.setError(toFieldPath<ExperienceFormValues>(path), {
            type: code,
            message: tField(toFieldCode(code)),
          });
        }
      }

      setErrorCode(toResponseCode(error));
    };

    if (position) {
      update.mutate(
        { id: position.id, input: payload },
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
        <FormSection title={t('groups.position')}>
          {/* The role and the employer are one fact in two halves, and are
              always filled in together. */}
          <FieldRow>
            <LocalizedField
              control={form.control}
              name="role"
              required
              label={t('fields.role')}
            />
            <LocalizedField
              control={form.control}
              name="organisation"
              required
              label={t('fields.organisation')}
            />
          </FieldRow>

          <FieldRow>
            <SelectField
              control={form.control}
              name="employmentType"
              id="experience-type"
              label={t('fields.employmentType')}
              placeholder={t('chooseType')}
              options={types}
              required
            />
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
            id="experience-current"
            label={t('fields.current')}
            description={t('currentHint')}
          />

          <FieldRow>
            <MonthField
              control={form.control}
              name="startDate"
              id="experience-start"
              label={t('fields.startDate')}
              required
            />
            <MonthField
              control={form.control}
              name="endDate"
              id="experience-end"
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
