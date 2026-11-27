'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';

import { SelectField } from '@/components/form/select-field';
import { TextField } from '@/components/form/text-field';
import { FieldRow } from '@/components/form/field-row';
import { FormActions } from '@/components/form/form-actions';
import { FormFields, FormLayout } from '@/components/form/form-layout';
import { useGroupedOptionChoices } from '@/features/option/use-options';
import { ApiRequestError } from '@/lib/api-client';
import {
  toFieldCode,
  toFieldErrors,
  toResponseCode,
  type ResponseCode,
} from '@/lib/error-codes';
import { createFormResolver, toFieldPath } from '@/lib/form-resolver';

import type { SocialLink } from './social-link-api';
import {
  socialLinkSchema,
  type SocialLinkFormValues,
  type SocialLinkInput,
} from './social-link-schema';
import { useCreateSocialLink, useUpdateSocialLink } from './use-social-links';

function toFormValues(link: SocialLink | null): SocialLinkFormValues {
  return {
    platform: link?.platform ?? '',
    url: link?.url ?? '',
    order: link?.order ?? 0,
  };
}

/** Exactly what has an input on screen. */
function hasVisibleMessage(errors: FieldErrors<SocialLinkFormValues>): boolean {
  return errors.platform !== undefined || errors.url !== undefined;
}

type SocialLinkFormProps = {
  /** `null` creates a new link; a link edits that one. */
  link: SocialLink | null;
  onDone: () => void;
};

export function SocialLinkForm({ link, onDone }: SocialLinkFormProps) {
  const t = useTranslations('admin.socialLinks');
  // Grouped rather than flat: thirty-odd platforms in one run is a list you
  // read instead of one you scan, and the groups are how "where do I put a
  // GitLab link" answers itself. Both the platforms and the headings are rows.
  const platforms = useGroupedOptionChoices('social-platform');
  const tField = useTranslations('validation');
  const tResponse = useTranslations('responses');

  const create = useCreateSocialLink();
  const update = useUpdateSocialLink();
  const isPending = create.isPending || update.isPending;

  const [errorCode, setErrorCode] = useState<ResponseCode | null>(null);

  const form = useForm<SocialLinkFormValues, unknown, SocialLinkInput>({
    resolver: createFormResolver<SocialLinkFormValues, SocialLinkInput>(
      socialLinkSchema,
      tField,
    ),
    defaultValues: toFormValues(link),
  });

  function onSubmit(input: SocialLinkInput) {
    setErrorCode(null);

    const onError = (error: unknown) => {
      // CONFLICT counts too: a duplicate URL names the field it is about.
      if (
        error instanceof ApiRequestError &&
        (error.code === 'VALIDATION_ERROR' || error.code === 'CONFLICT')
      ) {
        for (const [path, code] of Object.entries(
          toFieldErrors(error.details),
        )) {
          form.setError(toFieldPath<SocialLinkFormValues>(path), {
            type: code,
            message: tField(toFieldCode(code)),
          });
        }
      }

      setErrorCode(toResponseCode(error));
    };

    if (link) {
      update.mutate({ id: link.id, input }, { onSuccess: onDone, onError });

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
        {/* Two short fields and nothing else: a single row is the whole form. */}
        <FieldRow>
          <SelectField
            control={form.control}
            name="platform"
            id="social-platform"
            label={t('fields.platform')}
            placeholder={t('choosePlatform')}
            options={platforms}
            required
          />
          <TextField
            control={form.control}
            name="url"
            id="social-url"
            label={t('fields.url')}
            type="url"
            required
          />
        </FieldRow>
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
