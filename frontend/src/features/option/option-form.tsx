'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm, useWatch, type FieldErrors } from 'react-hook-form';
import {
  OPTION_LIST_SHAPES,
  type OptionListKey,
  type OptionListShape,
} from '@portfolio/shared';

import { BrandPicker, brandTitle } from '@/components/admin/brand-picker';
import { FormActions } from '@/components/form/form-actions';
import { FormFields, FormLayout } from '@/components/form/form-layout';
import { FormSection } from '@/components/form/form-section';
import { LocalizedField } from '@/components/form/localized-field';
import { SelectField } from '@/components/form/select-field';
import { TextField } from '@/components/form/text-field';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldTitle } from '@/components/ui/field';
import { ApiRequestError } from '@/lib/api-client';
import {
  toFieldCode,
  toFieldErrors,
  toResponseCode,
  type ResponseCode,
} from '@/lib/error-codes';
import { createFormResolver, toFieldPath } from '@/lib/form-resolver';

import type { Option } from './option-api';
import { routing } from '@/i18n/routing';

import {
  optionSchema,
  type LocalizedValues,
  type OptionFormValues,
  type OptionInput,
} from './option-schema';
import {
  useCreateOption,
  useOptionChoices,
  useUpdateOption,
} from './use-options';

/** Exactly what has an input on screen, so a message there is actually visible. */
function hasVisibleMessage(errors: FieldErrors<OptionFormValues>): boolean {
  return (
    errors.code !== undefined ||
    errors.name !== undefined ||
    errors.group !== undefined ||
    errors.icon !== undefined
  );
}

/** Every configured locale, so a language added to routing grows the form. */
function localesOf(stored: LocalizedValues | undefined): LocalizedValues {
  return Object.fromEntries(
    routing.locales.map((locale) => [locale, stored?.[locale] ?? '']),
  );
}

function toFormValues(
  list: OptionListKey,
  option: Option | null,
): OptionFormValues {
  return {
    list,
    code: option?.code ?? '',
    // Filled per locale rather than left absent: an input whose value starts
    // `undefined` is uncontrolled until the first keystroke, and React says so.
    name: localesOf(option?.name),
    group: option?.group ?? '',
    icon: option?.icon ?? null,
    order: option?.order ?? 0,
  };
}

type OptionFormProps = {
  list: OptionListKey;
  /** `null` creates a new option; an option edits that one. */
  option: Option | null;
  onDone: () => void;
};

export function OptionForm({ list, option, onDone }: OptionFormProps) {
  const t = useTranslations('admin.options');
  const tField = useTranslations('validation');
  const tResponse = useTranslations('responses');

  // Widened from the literal, whose members do not all carry both keys.
  const shape: OptionListShape = OPTION_LIST_SHAPES[list];
  const groups = useOptionChoices(shape.groupedBy ?? list);

  const create = useCreateOption();
  const update = useUpdateOption();
  const isPending = create.isPending || update.isPending;

  const [errorCode, setErrorCode] = useState<ResponseCode | null>(null);

  const form = useForm<OptionFormValues, unknown, OptionInput>({
    resolver: createFormResolver<OptionFormValues, OptionInput>(
      optionSchema(list),
      tField,
    ),
    defaultValues: toFormValues(list, option),
  });

  const icon = useWatch({ control: form.control, name: 'icon' });

  function onSubmit(input: OptionInput) {
    setErrorCode(null);

    const onError = (error: unknown) => {
      // The backend answers with the same field codes at the same paths, so
      // they land on the very fields RHF already knows. CONFLICT counts too: a
      // code or a name already in the list names the field it is about.
      if (
        error instanceof ApiRequestError &&
        (error.code === 'VALIDATION_ERROR' || error.code === 'CONFLICT')
      ) {
        for (const [path, code] of Object.entries(
          toFieldErrors(error.details),
        )) {
          form.setError(toFieldPath<OptionFormValues>(path), {
            type: code,
            message: tField(toFieldCode(code)),
          });
        }
      }

      setErrorCode(toResponseCode(error));
    };

    if (option) {
      update.mutate({ id: option.id, input }, { onSuccess: onDone, onError });

      return;
    }

    create.mutate(input, { onSuccess: onDone, onError });
  }

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
          <TextField
            control={form.control}
            name="code"
            id="option-code"
            label={t('fields.code')}
            // Rows point at the code, so changing one would strand every row
            // holding it. Shown rather than hidden while editing: it is what
            // the stored content actually says, and worth being able to read.
            description={option ? t('codeFixed') : t('codeHint')}
            disabled={option !== null}
            required
          />

          <LocalizedField
            control={form.control}
            name="name"
            label={t('fields.name')}
            required
          />

          {shape.groupedBy ? (
            <SelectField
              control={form.control}
              name="group"
              id="option-group"
              label={t('fields.group')}
              placeholder={t('chooseGroup')}
              options={groups}
            />
          ) : null}
        </FormSection>

        {shape.icons ? (
          <FormSection>
            <Field>
              <FieldTitle>{t('fields.icon')}</FieldTitle>
              <FieldDescription>
                {icon
                  ? t('iconChosen', { name: brandTitle(icon) ?? icon })
                  : t('iconNone')}
              </FieldDescription>

              {icon ? (
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => form.setValue('icon', null)}
                  >
                    {t('clearIcon')}
                  </Button>
                </div>
              ) : null}

              <BrandPicker
                value={icon}
                onChange={(slug) => form.setValue('icon', slug)}
              />
            </Field>
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
