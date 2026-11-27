'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import {
  OPTION_LIST_BY_KIND,
  KIND_HAS_ICON,
  MAX_EXPERTISE_LEVEL,
  MIN_EXPERTISE_LEVEL,
  type ExpertiseKind,
} from '@portfolio/shared';

import { FieldRow } from '@/components/form/field-row';
import { FormSection } from '@/components/form/form-section';
import { LocalizedField } from '@/components/form/localized-field';
import { NumberField } from '@/components/form/number-field';
import { SelectField } from '@/components/form/select-field';
import { FormActions } from '@/components/form/form-actions';
import { FormFields, FormLayout } from '@/components/form/form-layout';
import { routing } from '@/i18n/routing';
import { useOptionChoices } from '@/features/option/use-options';
import { ApiRequestError } from '@/lib/api-client';
import {
  toFieldCode,
  toFieldErrors,
  toResponseCode,
  type ResponseCode,
} from '@/lib/error-codes';
import { createFormResolver, toFieldPath } from '@/lib/form-resolver';

import { IconField } from './icon-field';
import type { Expertise } from './expertise-api';
import {
  expertiseSchema,
  type ExpertiseFormValues,
  type ExpertiseInput,
  type LocalizedValues,
} from './expertise-schema';
import { useCreateExpertise, useUpdateExpertise } from './use-expertise';

/** Every configured locale, so a language added to routing grows the form. */
const LOCALES = routing.locales;

const CONFIGURED: readonly string[] = LOCALES;

/**
 * Exactly what has an input on screen. `name` is not itself rendered - one
 * input exists per configured locale - and `order` is not rendered at all,
 * since there is no reorder UI yet.
 */
function hasVisibleMessage(errors: FieldErrors<ExpertiseFormValues>): boolean {
  const name = errors.name as Record<string, unknown> | undefined;

  return (
    LOCALES.some((locale) => name?.[locale] !== undefined) ||
    errors.category !== undefined ||
    errors.level !== undefined ||
    errors.icon !== undefined
  );
}

/** Every configured locale gets a value, so no input starts uncontrolled. */
function localesOf(stored: LocalizedValues | undefined): LocalizedValues {
  return Object.fromEntries(
    LOCALES.map((locale) => [locale, stored?.[locale] ?? '']),
  );
}

function toFormValues(row: Expertise | null): ExpertiseFormValues {
  return {
    name: localesOf(row?.name),
    category: row?.category ?? '',
    // NaN renders as an empty box and reports REQUIRED, so a new row has to be
    // given a level rather than defaulting to a number nobody chose.
    level: row ? row.level : Number.NaN,
    // `null` rather than `undefined`: a controlled field cannot hold undefined
    // without React reporting it as becoming uncontrolled.
    icon: row?.icon ?? null,
    order: row?.order ?? 0,
  };
}

/**
 * Carries over what was stored under a locale this form never rendered an input
 * for - one written straight through the API, or left from a language since
 * removed from `routing.locales`. PUT replaces the document, so an ordinary
 * save would otherwise delete it.
 */
function withUnrenderedLocales(
  input: ExpertiseInput,
  row: Expertise | null,
): ExpertiseInput {
  if (!row) {
    return input;
  }

  const unrendered = Object.entries(row.name).filter(
    ([locale]) => !CONFIGURED.includes(locale),
  );

  return {
    ...input,
    name: { ...Object.fromEntries(unrendered), ...input.name },
  };
}

type ExpertiseFormProps = {
  kind: ExpertiseKind;
  /** `null` creates a new row; a row edits that one. */
  row: Expertise | null;
  onDone: () => void;
};

export function ExpertiseForm({ kind, row, onDone }: ExpertiseFormProps) {
  const t = useTranslations('admin.expertise');
  // Only this kind's categories: the whole point of the split is that a
  // technology cannot be `collaboration` and a skill cannot be `database`.
  const categories = useOptionChoices(OPTION_LIST_BY_KIND[kind]);
  const tField = useTranslations('validation');
  const tResponse = useTranslations('responses');

  const create = useCreateExpertise(kind);
  const update = useUpdateExpertise(kind);
  const isPending = create.isPending || update.isPending;

  const [errorCode, setErrorCode] = useState<ResponseCode | null>(null);

  const form = useForm<ExpertiseFormValues, unknown, ExpertiseInput>({
    resolver: createFormResolver<ExpertiseFormValues, ExpertiseInput>(
      expertiseSchema(kind),
      tField,
    ),
    defaultValues: toFormValues(row),
  });

  function onSubmit(input: ExpertiseInput) {
    setErrorCode(null);

    const payload = withUnrenderedLocales(input, row);

    const onError = (error: unknown) => {
      // The backend answers with the same field codes at the same paths, so
      // they land on the very fields RHF already knows. CONFLICT counts too:
      // a duplicate name names the field it is about, and "that name is taken"
      // belongs on the name rather than in a banner saying something went
      // wrong - nothing did.
      if (
        error instanceof ApiRequestError &&
        (error.code === 'VALIDATION_ERROR' || error.code === 'CONFLICT')
      ) {
        for (const [path, code] of Object.entries(
          toFieldErrors(error.details),
        )) {
          form.setError(toFieldPath<ExpertiseFormValues>(path), {
            type: code,
            message: tField(toFieldCode(code)),
          });
        }
      }

      setErrorCode(toResponseCode(error));
    };

    if (row) {
      update.mutate(
        { id: row.id, input: payload },
        { onSuccess: onDone, onError },
      );

      return;
    }

    create.mutate(payload, { onSuccess: onDone, onError });
  }

  // A field already says what to fix; repeating it globally would only add
  // noise. A code naming nothing on screen - an unrenderable locale key, say -
  // still shows, rather than leaving the admin with nothing.
  // Read unconditionally: `formState` is a proxy that subscribes the component
  // to whatever it touches during render, and reading it behind a short-circuit
  // means the first render never subscribes - the banner then shows alongside a
  // field message it was meant to suppress.
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
        <FormSection title={t('groups.details')}>
          <LocalizedField
            control={form.control}
            name="name"
            required
            label={t('fields.name')}
          />
          {/* Both are short and are always set together, so they share a row
              instead of each taking a full one. */}
          <FieldRow>
            <SelectField
              control={form.control}
              name="category"
              id="expertise-category"
              label={t('fields.category')}
              placeholder={t('chooseCategory')}
              options={categories}
              required
            />
            <NumberField
              control={form.control}
              name="level"
              id="expertise-level"
              label={t('fields.level')}
              min={MIN_EXPERTISE_LEVEL}
              max={MAX_EXPERTISE_LEVEL}
              step={1}
              suffix="%"
              required
            />
          </FieldRow>
        </FormSection>

        {/* Only for the kinds that have a logo. A skill has none - there is no
            brand mark for "Problem Solving" - so it gets no picker rather than
            one that can never match anything. */}
        {KIND_HAS_ICON[kind] ? (
          <FormSection title={t('groups.branding')}>
            <IconField kind={kind} form={form} />
          </FormSection>
        ) : null}
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
